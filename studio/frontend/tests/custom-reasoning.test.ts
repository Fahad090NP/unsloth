// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import type { ExternalProviderConfig } from "../src/features/chat/external-providers.ts";
import { installLocalStorageFake } from "./helpers/kit.ts";

installLocalStorageFake();
Object.assign(window.location, { href: "http://localhost/" });
const vite = await createServer({ server: { middlewareMode: true } });
after(() => vite.close());
const caps = (await vite.ssrLoadModule(
  "/src/features/chat/provider-capabilities.ts",
)) as typeof import("../src/features/chat/provider-capabilities.ts");
const providers = (await vite.ssrLoadModule(
  "/src/features/chat/external-providers.ts",
)) as typeof import("../src/features/chat/external-providers.ts");
const api = (await vite.ssrLoadModule(
  "/src/features/chat/api/providers-api.ts",
)) as typeof import("../src/features/chat/api/providers-api.ts");
const sync = (await vite.ssrLoadModule(
  "/src/features/chat/sync-external-providers.ts",
)) as typeof import("../src/features/chat/sync-external-providers.ts");
const routing = (await vite.ssrLoadModule(
  "/src/features/chat/utils/chat-title.ts",
)) as typeof import("../src/features/chat/utils/chat-title.ts");
const reasoning = (await vite.ssrLoadModule(
  "/src/features/chat/custom-reasoning.ts",
)) as typeof import("../src/features/chat/custom-reasoning.ts");

/** Swap the global fetch without touching it across an await in the test body. */
function installFetch(fake: typeof fetch): () => void {
  const previous = globalThis.fetch;
  globalThis.fetch = fake;
  return () => {
    globalThis.fetch = previous;
  };
}

const styles = [
  "reasoning_effort",
  "reasoning",
  "thinking",
  "chat_template_kwargs.enable_thinking",
] as const;
const connection = {
  id: "custom-a",
  providerType: "custom",
  backendProviderType: "custom",
  name: "Gateway",
  baseUrl: "http://localhost:9000/v1",
  models: ["same-model"],
  createdAt: 1,
  updatedAt: 1,
};

for (const style of styles) {
  test(`${style}: opt-in capabilities, generic controls, API and cache round trip`, async () => {
    const config = { enabled: true, style };
    const resolved = caps.getExternalReasoningCapabilities(
      "custom",
      "same-model",
      { reasoningConfig: config },
    );
    const effort = style === "reasoning_effort" || style === "reasoning";
    assert.equal(resolved.supportsReasoning, true);
    assert.equal(resolved.supportsReasoningOff, true);
    assert.equal(resolved.reasoningAlwaysOn, false);
    assert.equal(
      resolved.reasoningStyle,
      effort ? "reasoning_effort" : "enable_thinking",
    );
    if (effort)
      assert.deepEqual(
        [...resolved.reasoningEffortLevels],
        ["none", "low", "medium", "high"],
      );
    for (const level of ["low", "medium", "high"]) {
      assert.deepEqual(
        reasoning.customReasoningRequestFields(config, true, level),
        effort
          ? { reasoning_effort: level }
          : { thinking: { type: "enabled" } },
      );
    }
    assert.deepEqual(
      reasoning.customReasoningRequestFields(config, false, "high"),
      effort
        ? { reasoning_effort: "none" }
        : { thinking: { type: "disabled" } },
    );
    if (effort)
      assert.deepEqual(
        reasoning.customReasoningRequestFields(config, true, "none"),
        { reasoning_effort: "none" },
      );

    const bodies: Record<string, unknown>[] = [];
    const restoreFetch = installFetch(async (_url, init) => {
      await Promise.resolve();
      const body = init?.body;
      if (typeof body !== "string") throw new Error("expected a string body");
      bodies.push(JSON.parse(body) as Record<string, unknown>);
      return Response.json({ reasoning_config: config });
    });
    try {
      const created = await api.createProviderConfig({
        providerType: "custom",
        displayName: "Gateway",
        reasoningConfig: config,
      });
      assert.deepEqual(created.reasoning_config, config);
      await api.updateProviderConfig("custom-a", { reasoningConfig: config });
      await api.updateProviderConfig("custom-a", { reasoningConfig: null });
      await api.updateProviderConfig("custom-a", { displayName: "Renamed" });
    } finally {
      restoreFetch();
    }
    assert.deepEqual(
      bodies.slice(0, 2).map((body) => body.reasoning_config),
      [config, config],
    );
    assert.equal(bodies[2].reasoning_config, null);
    assert.equal("reasoning_config" in bodies[3], false);
    providers.saveExternalProviders([
      { ...connection, reasoningConfig: config } as ExternalProviderConfig,
    ]);
    const loaded = providers.loadExternalProviders()[0];
    assert.deepEqual(loaded.reasoningConfig, config);
    assert.deepEqual(
      (
        await routing.buildExternalRoutingFields({
          provider: loaded,
          modelId: "same-model",
          apiKey: "",
        })
      ).provider_reasoning_config,
      config,
    );
  });
}

test("legacy, disabled and malformed Custom contracts fail closed even for known model names/URLs", async () => {
  for (const config of [
    undefined,
    null,
    {},
    { enabled: false, style: "thinking" },
    { enabled: "true", style: "thinking" },
    { enabled: true, style: "unknown" },
    { enabled: true, style: "thinking", extra: 1 },
    [],
    "thinking",
  ] as unknown[]) {
    const resolved = caps.getExternalReasoningCapabilities(
      "custom",
      "openrouter/auto",
      {
        isReasoningProvider: true,
        baseUrl: "https://api.openai.com/v1",
        reasoningConfig: config,
      },
    );
    assert.equal(resolved.supportsReasoning, false);
    assert.deepEqual(
      reasoning.customReasoningRequestFields(config, true, "high"),
      {},
    );
    providers.saveExternalProviders([
      { ...connection, reasoningConfig: config } as ExternalProviderConfig,
    ]);
    const loaded = providers.loadExternalProviders()[0];
    const fields = await routing.buildExternalRoutingFields({
      provider: loaded,
      modelId: "same-model",
      apiKey: "",
    });
    assert.equal("provider_reasoning_config" in fields, false);
  }
  for (const overrides of [
    { backendProviderType: "openai" },
    { apiType: "responses" },
    { decisionsOnly: true },
    { providerType: "vllm" },
  ]) {
    providers.saveExternalProviders([
      {
        ...connection,
        ...overrides,
        reasoningConfig: { enabled: true, style: "thinking" },
      } as Parameters<typeof providers.saveExternalProviders>[0][number],
    ]);
    assert.equal(
      providers.loadExternalProviders()[0].reasoningConfig,
      undefined,
    );
  }
});

test("switching same-model connections never leaks the contract and server sync is authoritative", async () => {
  const a: ExternalProviderConfig = {
    ...connection,
    reasoningConfig: { enabled: true, style: "reasoning" },
  };
  const b: ExternalProviderConfig = { ...connection, id: "custom-b" };
  const c: ExternalProviderConfig = {
    ...connection,
    id: "custom-c",
    reasoningConfig: { enabled: true, style: "thinking" },
  };
  for (const provider of [a, b, c, b, a]) {
    const resolved = caps.getExternalReasoningCapabilities(
      provider.providerType,
      "same-model",
      { reasoningConfig: provider.reasoningConfig },
    );
    assert.equal(resolved.supportsReasoning, provider !== b);
    const fields = await routing.buildExternalRoutingFields({
      provider,
      modelId: "same-model",
      apiKey: "",
    });
    assert.equal(fields.provider_id, provider.id);
    assert.deepEqual(
      fields.provider_reasoning_config,
      provider.reasoningConfig,
    );
  }
  assert.equal(sync.mergeLocalProviderOptions(a, b).reasoningConfig, undefined);
  const restoreFetch = installFetch(async (url) => {
    await Promise.resolve();
    const path = url instanceof Request ? url.url : String(url);
    if (path.includes("/registry")) return Response.json([]);
    if (path.endsWith("/api/providers/"))
      return Response.json([
        {
          id: "custom-a",
          provider_type: "custom",
          display_name: "Gateway",
          base_url: connection.baseUrl,
          is_enabled: true,
          models: ["same-model"],
          available_models: ["same-model"],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          reasoning_config: null,
        },
        {
          id: "custom-c",
          provider_type: "custom",
          display_name: "Other",
          base_url: connection.baseUrl,
          is_enabled: true,
          models: ["same-model"],
          available_models: ["same-model"],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          reasoning_config: c.reasoningConfig,
        },
      ]);
    return Response.json({ fetched_at: 1, providers: {} });
  });
  try {
    const synced = await sync.syncExternalProvidersFromBackend([a, c]);
    assert.equal(synced[0].reasoningConfig, undefined);
    assert.deepEqual(synced[1].reasoningConfig, c.reasoningConfig);
  } finally {
    restoreFetch();
  }
});
