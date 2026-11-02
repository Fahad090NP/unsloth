// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileFunction } from "node:vm";
import ts from "@typescript/typescript6";
import {
  pinKey,
  pinnedQuantEntries,
} from "../src/features/model-picker/components/model-selector/pinned-models.ts";
import {
  ggufVariantsMatchForPicker,
  modelIdsMatchForPicker,
} from "../src/features/model-picker/components/model-selector/row-identity.ts";

const source = readFileSync(
  new URL(
    "../src/features/model-picker/components/model-selector/reconcile-gguf-pins.ts",
    import.meta.url,
  ),
  "utf8",
);
const declaration = source
  .slice(source.indexOf("async function hasRunnableNonGgufCopy"))
  .replace("export ", "");
const compile = compileFunction(
  ts.transpileModule(declaration, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText + "; return reconcileGgufPinsAfterDelete;",
  [
    "listCachedGguf",
    "fetchCachedGgufInventory",
    "fetchCachedModelsInventory",
    "listGgufVariants",
    "pinnedQuantEntries",
    "usePinnedModelsStore",
    "modelIdsMatchForPicker",
    "ggufVariantsMatchForPicker",
  ],
) as unknown as (
  listCachedGguf: unknown,
  fetchCachedGgufInventory: unknown,
  fetchCachedModelsInventory: unknown,
  listGgufVariants: unknown,
  pinnedQuantEntries: unknown,
  usePinnedModelsStore: unknown,
  modelIdsMatchForPicker: unknown,
  ggufVariantsMatchForPicker: unknown,
) => (repoId: string, hfToken?: string) => Promise<void>;

for (const requested of ["Org/Model", "org/model"]) {
  for (const remaining of [
    "anonymous",
    "anonymous-partial-inventory",
    "duplicate",
    "absent",
    "partial",
    "unavailable",
    "unconfirmed-absent",
    "unconfirmed-partial",
    "lowercase-quant",
    "other-quant",
    "legacy-confirmation",
    "non-gguf-survivor",
  ]) {
    test(`GGUF pins after deleting ${requested}: ${remaining}`, async () => {
      const original = ["Org/Model", pinKey("Org/Model", "Q8_0")];
      let pinned = [...original];
      let variantCalls = 0;
      const inventory = () => {
        if (remaining === "unavailable") return Promise.reject(new Error("scan unavailable"));
        return Promise.resolve({
          cached: remaining.endsWith("absent")
            ? []
            : [
                {
                  repo_id: "org/model",
                  partial:
                    remaining.endsWith("partial") ||
                    remaining === "anonymous-partial-inventory",
                },
              ],
          scan_confirmed:
            remaining === "legacy-confirmation"
              ? undefined
              : !remaining.startsWith("unconfirmed"),
        });
      };
      const modelsInventory = () => Promise.resolve(({
        cached:
          remaining === "non-gguf-survivor"
            ? [
                {
                  repo_id: "org/model",
                  model_format: "safetensors",
                  partial: false,
                  capabilities: { can_chat: true },
                },
              ]
            : [],
        scan_confirmed: true,
      }));
      const run = compile(
        async () => (await inventory()).cached,
        inventory,
        modelsInventory,
        () => {
          variantCalls += 1;
          return Promise.resolve({
            variants: [
              {
                quant:
                  remaining === "lowercase-quant"
                    ? "q8_0"
                    : remaining === "other-quant"
                      ? "Q6_K"
                      : "Q8_0",
                downloaded:
                  !remaining.startsWith("anonymous") &&
                  !remaining.endsWith("partial") &&
                  remaining !== "non-gguf-survivor",
              },
            ],
          });
        },
        pinnedQuantEntries,
        {
          getState: () => ({
            pinned,
            togglePinned: (repo: string, quant?: string) => {
              pinned = pinned.filter((p) => p !== pinKey(repo, quant));
            },
          }),
        },
        modelIdsMatchForPicker,
        ggufVariantsMatchForPicker,
      );
      await run(
        requested,
        remaining === "non-gguf-survivor" ? "hf_fixture_token" : undefined,
      );
      const expected =
        remaining === "absent" ||
        remaining === "partial" ||
        remaining === "anonymous-partial-inventory"
          ? []
          : remaining === "other-quant" || remaining === "non-gguf-survivor"
            ? ["Org/Model"]
            : original;
      assert.deepEqual(pinned, expected);
      if (remaining.startsWith("unconfirmed")) assert.equal(variantCalls, 0);
    });
  }
}
