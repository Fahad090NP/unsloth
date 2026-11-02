// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";

import { readSrc } from "./helpers/kit.ts";

type ProviderConfig = { id: string; providerType: string; baseUrl?: string };
type SyncModule = {
  refreshProviderModelCatalogs: (providers: ProviderConfig[]) => Promise<void>;
};
type CatalogModule = {
  setModelsDevCatalog: (catalog: { fetched_at: number; providers: Record<string, unknown> }) => void;
  resolveModelCatalogEntry: (
    provider: string,
    modelId: string,
  ) => { efforts?: string[] } | null;
  clearProviderModelCatalog: (provider: string) => void;
};

let vite: ViteDevServer;

before(async () => {
  vite = await createServer({ appType: "custom", server: { middlewareMode: true } });
});

after(async () => {
  await vite.close();
});

test("a failing OpenRouter connection leaves the catalog for the next connection to refresh", async () => {
  const { refreshProviderModelCatalogs } = (await vite.ssrLoadModule(
    "/src/features/chat/sync-external-providers.ts",
  )) as SyncModule;
  const catalog = (await vite.ssrLoadModule("/src/features/chat/model-catalog.ts")) as CatalogModule;
  catalog.setModelsDevCatalog({ fetched_at: Date.now() / 1000, providers: {} });
  const asked: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    const { provider_id: providerId } = JSON.parse(init?.body as string) as { provider_id: string };
    asked.push(providerId);
    return Promise.resolve(providerId === "expired-key"
      ? Response.json({ detail: "Invalid API key" }, { status: 502 })
      : Response.json([{ id: "acme/fresh", reasoning: { supported_efforts: ["low", "high"] } }]));
  });
  try {
    await refreshProviderModelCatalogs([
      { id: "expired-key", providerType: "openrouter" },
      { id: "working-key", providerType: "openrouter" },
      { id: "second-working-key", providerType: "openrouter" },
    ]);
  } finally {
    Reflect.set(globalThis, "fetch", realFetch);
  }
  assert.deepEqual(asked, ["expired-key", "working-key"]);
  assert.deepEqual(catalog.resolveModelCatalogEntry("openrouter", "acme/fresh")?.efforts, ["low", "high"]);
  catalog.clearProviderModelCatalog("openrouter");
});

test("an OpenRouter connection on a gateway base URL never writes the shared catalog", async () => {
  const { refreshProviderModelCatalogs } = (await vite.ssrLoadModule(
    "/src/features/chat/sync-external-providers.ts",
  )) as SyncModule;
  const catalog = (await vite.ssrLoadModule("/src/features/chat/model-catalog.ts")) as CatalogModule;
  catalog.setModelsDevCatalog({ fetched_at: Date.now() / 1000, providers: {} });
  const asked: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    const { provider_id: providerId } = JSON.parse(init?.body as string) as { provider_id: string };
    asked.push(providerId);
    return Promise.resolve(providerId === "gateway"
      ? Response.json([{ id: "acme/fresh", reasoning: { supported_efforts: ["max"] } }])
      : Response.json([{ id: "acme/fresh", reasoning: { supported_efforts: ["low", "high"] } }]));
  });
  try {
    await refreshProviderModelCatalogs([
      { id: "gateway", providerType: "openrouter", baseUrl: "https://gateway.example/api/v1" },
      { id: "openrouter", providerType: "openrouter", baseUrl: "https://openrouter.ai/api/v1/" },
    ]);
  } finally {
    Reflect.set(globalThis, "fetch", realFetch);
  }
  try {
    assert.deepEqual(asked, ["openrouter"]);
    assert.deepEqual(catalog.resolveModelCatalogEntry("openrouter", "acme/fresh")?.efforts, ["low", "high"]);
  } finally {
    catalog.clearProviderModelCatalog("openrouter");
  }
});

test("editing a connection refreshes the catalog with the saved base URL, not the one it replaced", async () => {
  const dialog = readSrc("features/chat/chat-providers-dialog.tsx");
  const saveAt = dialog.indexOf("async function saveProviderEdits()");
  const save = dialog.slice(saveAt, dialog.indexOf("\n  async function ", saveAt + 1));
  const refreshed = (/refreshProviderModelCatalogs\(\[(\w+)\]\)/.exec(save))?.[1];
  assert.ok(saveAt > 0 && refreshed, "the edit save path no longer refreshes the catalog");
  const literalAt = save.indexOf(`const ${refreshed}: ExternalProviderConfig = {`);
  assert.ok(literalAt > 0, `${refreshed} is not the edited connection`);
  assert.match(save.slice(literalAt, save.indexOf("\n      };", literalAt)), /baseUrl: updated\.base_url/);

  const { refreshProviderModelCatalogs } = (await vite.ssrLoadModule(
    "/src/features/chat/sync-external-providers.ts",
  )) as SyncModule;
  const catalog = (await vite.ssrLoadModule("/src/features/chat/model-catalog.ts")) as CatalogModule;
  const asked: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    asked.push((JSON.parse(init?.body as string) as { provider_id: string }).provider_id);
    return Promise.resolve(Response.json([{ id: "acme/fresh", reasoning: { supported_efforts: ["low", "high"] } }]));
  });
  try {
    await refreshProviderModelCatalogs([
      { id: "edited", providerType: "openrouter", baseUrl: "https://openrouter.ai/api/v1" },
    ]);
    assert.deepEqual(asked, ["edited"]);
  } finally {
    Reflect.set(globalThis, "fetch", realFetch);
    catalog.clearProviderModelCatalog("openrouter");
  }
});
