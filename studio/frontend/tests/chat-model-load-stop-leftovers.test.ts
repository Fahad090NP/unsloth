// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// Stopping a load must leave no "Starting model…" toast or header status behind. The decisions sit
// inside a React hook whose awaits span the backend load, so these are source contracts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runtime = readFileSync(
  fileURLToPath(new URL("../src/features/chat/hooks/use-chat-model-runtime.ts", import.meta.url)),
  "utf8",
);
const section = (start: string, end: string) => {
  const from = runtime.indexOf(start);
  assert.notEqual(from, -1, `expected to find ${start}`);
  const to = runtime.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `expected to find ${end} after ${start}`);
  return runtime.slice(from, to);
};

test("a progress poll in flight when its run is stopped does not touch the next run's toast", () => {
  const download = section("const pollDownload = async () => {", "const pollLoad = async () => {");
  assert.match(download, /getDownloadProgress[\s\S]*?if\s*\((?:abortCtrl\.signal\.aborted|\(?\s*isAborted\(abortCtrl\.signal\)\s*\)?)[\s\S]*?(?:loadingModelRef\.current|refIsSet\(loadingModelRef\))[\s\S]*?return;/);
  const load = section("const pollLoad = async () => {", "const cacheMissDownloadStarted = async");
  assert.match(load, /await getLoadProgress\(\);[\s\S]*?if\s*\((?:abortCtrl\.signal\.aborted|\(?\s*isAborted\(abortCtrl\.signal\)\s*\)?)[\s\S]*?(?:loadingModelRef\.current|refIsSet\(loadingModelRef\))[\s\S]*?return;/);
});

test("Stop with no run left to cancel still clears the load status", () => {
  const stop = section("const cancelLoadingWithCheckpointPolicy = useCallback(", "const cancelLoading = useCallback(");
  assert.match(stop, /if \(loadingModelRef\.current\) \{[\s\S]*resetLoadingUi\(\);[\s\S]*toast\.dismiss\(tid\)/);
});

test("declining to stop running chats dismisses the load toast it leaves", () => {
  const decline = section("// Declined before anything was unloaded", 'throw new Error("Cancelled");');
  assert.match(decline, /toast\.dismiss\(toastId\);\n\s*resetLoadingUiForRun\(loadRun\);/);
});

test("a load run gets its id without crypto.randomUUID, which plain-HTTP LAN origins lack", () => {
  assert.doesNotMatch(runtime, /requestId: crypto\.randomUUID\(\)/);
  assert.equal(runtime.match(/requestId: createNavigationNonce\(\)/g)?.length, 2);
});
