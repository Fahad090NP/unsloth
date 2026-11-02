// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// #11837: Retry sends the current time budget and website access.

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

import {
  installLocalStorageFake,
  registerBundlerResolver,
} from "./helpers/kit.ts";

register("./helpers/settings-api-resolver.mjs", import.meta.url);
registerBundlerResolver();
installLocalStorageFake();

const { retryResearchRun } = await import(
  "../src/features/chat/api/research-api.ts"
);

async function captureRetry(
  call: () => Promise<unknown>,
): Promise<{ url: string; init: RequestInit | undefined }> {
  const original = globalThis.fetch;
  let seen: { url: string; init: RequestInit | undefined } | null = null;
  globalThis.fetch = ( (input: RequestInfo | URL, init?: RequestInit) => {
    seen = { url: (input as unknown as string), init };
    return Promise.resolve(new Response(JSON.stringify({ id: "run-1", status: "queued" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  });
  try {
    await call();
  } finally {
    Object.assign(globalThis, { fetch: original });
  }
  assert.ok(seen);
  return seen;
}

test("retry sends the current time budget and website access", async () => {
  const { url, init } = await captureRetry(() =>
    retryResearchRun("run-1", {
      modelTimeoutSeconds: 0,
      websitePolicy: { allowedDomains: [], blockedDomains: ["example.com"] },
    }),
  );
  assert.match(url, /\/api\/chat\/research-runs\/run-1\/retry$/);
  assert.equal(init?.method, "POST");
  assert.deepEqual(JSON.parse((init.body as unknown as string)), {
    budgets: { modelTimeoutSeconds: 0 },
    websitePolicy: { allowedDomains: [], blockedDomains: ["example.com"] },
  });
});

test("retry without settings sends no body", async () => {
  const { init } = await captureRetry(() => retryResearchRun("run-1"));
  assert.equal(init?.body, undefined);
});
