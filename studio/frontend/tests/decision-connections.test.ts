// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import type * as ExternalProviders from "../src/features/chat/external-providers.ts";
import type * as ProvidersApi from "../src/features/chat/api/providers-api.ts";
import { installLocalStorageFake } from "./helpers/kit.ts";

installLocalStorageFake();
Object.assign(window.location, { href: "http://localhost/" });
const vite = await createServer({ server: { middlewareMode: true } });
after(() => vite.close());

/** Swap the global fetch without touching it across an await in the test body. */
function installFetch(fake: typeof fetch): () => void {
  const previous = globalThis.fetch;
  globalThis.fetch = fake;
  return () => {
    globalThis.fetch = previous;
  };
}

test("System One connections stay decision-only after a reload", async () => {
  const api = (await vite.ssrLoadModule(
    "/src/features/chat/api/providers-api.ts",
  )) as typeof ProvidersApi;
  const providers = (await vite.ssrLoadModule(
    "/src/features/chat/external-providers.ts",
  )) as typeof ExternalProviders;
  const bodies: Record<string, unknown>[] = [];
  const restoreFetch = installFetch(async (_url, init) => {
    await Promise.resolve();
    const body = init?.body;
    if (typeof body !== "string") throw new Error("expected a string body");
    bodies.push(JSON.parse(body) as Record<string, unknown>);
    return Response.json({});
  });
  try {
    await api.createProviderConfig({ providerType: "custom", displayName: "Decider", apiType: "systemone" });
  } finally {
    restoreFetch();
  }
  assert.equal(bodies[0].api_type, "systemone");

  const decider = { id: "decider", providerType: "custom", name: "Decider", baseUrl: "http://localhost:8080/v1",
    models: ["jev-latest"], createdAt: 1, updatedAt: 1, ...providers.connectionApiFields("systemone") };
  providers.saveExternalProviders([decider]);
  assert.ok(providers.isDecisionConnection(providers.loadExternalProviders()[0]));
  for (const providerType of ["typesafe", "liquid"]) {
    assert.ok(providers.isDecisionConnection({ providerType }), providerType);
  }
  for (const apiType of ["chat_completions", "responses", undefined] as const) {
    const chat = { providerType: "custom", ...providers.connectionApiFields(apiType) };
    assert.equal(providers.isDecisionConnection(chat), false, String(apiType));
  }
  assert.equal(providers.isDecisionConnection({ providerType: "openrouter" }), false);
});
