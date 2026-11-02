// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import test from "node:test";

import { loadWithStubs } from "./helpers/module-stubs.ts";

interface AuthApi { authFetch: (...args: unknown[]) => Promise<Response> }
interface ImagesApi {
  generateDiffusionImage: (body: unknown) => Promise<unknown>;
  GenerateResponseLostError: new (message: string) => Error;
}

function loadApis(): ImagesApi {
  const auth = loadWithStubs<AuthApi>(
    new URL("../src/features/auth/api.ts", import.meta.url),
    {
      "@/lib/api-base": {
        apiUrl: (path: string) => path,
        getApiPort: () => 1,
        isTauri: true,
      },
      "@/lib/account-transition": { accountTransitionPending: () => false },
      "./session": {
        clearAuthTokens: () => { return undefined; },
        getAuthToken: () => "access-token",
        getRefreshToken: () => null,
        mustChangePassword: () => false,
        setMustChangePassword: () => { return undefined; },
        storeAuthTokens: () => { return undefined; },
      },
      "@tauri-apps/api/core": { invoke: () => Promise.resolve(false) },
    },
  );
  return loadWithStubs<ImagesApi>(
    new URL("../src/features/images/api.ts", import.meta.url),
    {
      "@/lib/model-lifecycle-events": { withBackgroundLoadNotice: (f: unknown) => f },
      "@/features/auth": { authFetch: auth.authFetch },
      "@/lib/format-fastapi-error": { readFastApiError: () => Promise.resolve("") },
      "@/lib/multi-model-refusal": { parseLoadJson: () => Promise.resolve(({})) },
      "@/lib/unified-memory-load-refusal": { withAllowOversizedLoad: (body: unknown) => body },
    },
    { relativePassthrough: true },
  );
}

test("a dropped generate reply is surfaced as lost, not re-sent", async () => {
  const api = loadApis();
  const originalFetch = globalThis.fetch;
  let posts = 0;
  globalThis.fetch = (() => {
    posts += 1;
    return Promise.reject(new TypeError("Load failed"));
  });
  try {
    await assert.rejects(
      api.generateDiffusionImage({ prompt: "x" }),
      (err: Error) => err instanceof api.GenerateResponseLostError,
    );
    assert.equal(posts, 1);
  } finally {
    Reflect.set(globalThis, "fetch", originalFetch);
  }
});
