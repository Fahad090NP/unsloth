// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";

import { CPT_TARGET_MODULES, DEFAULT_HYPERPARAMS } from "../src/config/training.ts";

let vite: ViteDevServer;
let countNonDefaultAdvancedSettings: (
  state: Record<string, unknown>,
  baseline?: unknown,
) => number;

before(async () => {
  vite = await createServer({ appType: "custom", server: { middlewareMode: true } });
  // The chat runtime store owns the modules below, so evaluate it before its importers.
  await vite.ssrLoadModule("/src/features/chat/stores/chat-runtime-store.ts");
  const loaded = (await vite.ssrLoadModule(
    "/src/features/studio/wizard/advanced-settings-summary.ts",
  )) as {
    countNonDefaultAdvancedSettings: typeof countNonDefaultAdvancedSettings;
  };
  countNonDefaultAdvancedSettings = loaded.countNonDefaultAdvancedSettings;
});

after(async () => {
  await vite.close();
});

const defaultState = {
  trainingMethod: "qlora" as const,
  optimizerType: DEFAULT_HYPERPARAMS.optimizerType,
  lrSchedulerType: DEFAULT_HYPERPARAMS.lrSchedulerType,
  weightDecay: DEFAULT_HYPERPARAMS.weightDecay,
  warmupSteps: DEFAULT_HYPERPARAMS.warmupSteps,
  saveSteps: DEFAULT_HYPERPARAMS.saveSteps,
  evalSteps: DEFAULT_HYPERPARAMS.evalSteps,
  randomSeed: DEFAULT_HYPERPARAMS.randomSeed,
  packing: DEFAULT_HYPERPARAMS.packing,
  trainOnCompletions: DEFAULT_HYPERPARAMS.trainOnCompletions,
  gradientCheckpointing: DEFAULT_HYPERPARAMS.gradientCheckpointing,
  visionImageSize: DEFAULT_HYPERPARAMS.visionImageSize,
  finetuneVisionLayers: DEFAULT_HYPERPARAMS.finetuneVisionLayers,
  finetuneLanguageLayers: DEFAULT_HYPERPARAMS.finetuneLanguageLayers,
  finetuneAttentionModules: DEFAULT_HYPERPARAMS.finetuneAttentionModules,
  finetuneMLPModules: DEFAULT_HYPERPARAMS.finetuneMLPModules,
  loraRank: DEFAULT_HYPERPARAMS.loraRank,
  loraAlpha: DEFAULT_HYPERPARAMS.loraAlpha,
  loraDropout: DEFAULT_HYPERPARAMS.loraDropout,
  loraVariant: DEFAULT_HYPERPARAMS.loraVariant,
  targetModules: DEFAULT_HYPERPARAMS.targetModules,
};

test("advanced settings summary counts submitted non-default values", () => {
  assert.equal(countNonDefaultAdvancedSettings(defaultState), 0);
  assert.equal(
    countNonDefaultAdvancedSettings({
      ...defaultState,
      loraRank: 32,
      optimizerType: "adamw_torch",
    }),
    2,
  );
});

test("advanced settings summary uses method-aware LoRA defaults", () => {
  assert.equal(
    countNonDefaultAdvancedSettings({
      ...defaultState,
      trainingMethod: "full",
      loraRank: 64,
    }),
    0,
  );
  assert.equal(
    countNonDefaultAdvancedSettings({
      ...defaultState,
      trainingMethod: "cpt",
      trainOnCompletions: false,
      loraRank: 128,
      loraAlpha: 32,
      loraVariant: "rslora",
      targetModules: CPT_TARGET_MODULES,
    }),
    0,
  );
});

test("advanced settings summary uses applied model defaults as its baseline", () => {
  const modelDefaults = {
    loraRank: 32,
    loraAlpha: 32,
    saveSteps: 30,
    trainOnCompletions: true,
    targetModules: [...DEFAULT_HYPERPARAMS.targetModules, "shared_mlp"],
  };
  const modelState = { ...defaultState, ...modelDefaults };

  assert.equal(countNonDefaultAdvancedSettings(modelState, modelDefaults), 0);
  assert.equal(
    countNonDefaultAdvancedSettings(
      { ...modelState, saveSteps: 60 },
      modelDefaults,
    ),
    1,
  );
});

test("advanced settings summary distinguishes duplicate target modules", () => {
  assert.equal(
    countNonDefaultAdvancedSettings({
      ...defaultState,
      targetModules: ["q_proj", "q_proj"],
    }),
    1,
  );
});

test("advanced settings summary does not count automatic packing and assistant-only restrictions", () => {
  assert.equal(
    countNonDefaultAdvancedSettings({
      ...defaultState,
      isVisionModel: true,
      isDatasetImage: true,
      packing: false,
    }),
    0,
  );
  assert.equal(
    countNonDefaultAdvancedSettings({
      ...defaultState,
      datasetStreaming: true,
      trainOnCompletions: false,
    }),
    0,
  );
  assert.equal(
    countNonDefaultAdvancedSettings({ ...defaultState, packing: false }),
    1,
  );
});
