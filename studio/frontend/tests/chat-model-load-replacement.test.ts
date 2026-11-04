// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RUNTIME = fileURLToPath(
  new URL(
    "../src/features/chat/hooks/use-chat-model-runtime.ts",
    import.meta.url,
  ),
);
const CHAT_PAGE = fileURLToPath(
  new URL("../src/features/chat/chat-page.tsx", import.meta.url),
);
const read = (path: string) => readFileSync(path, "utf8");
const section = (source: string, start: string, end: string) => {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `expected to find ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `expected to find ${end} after ${start}`);
  return source.slice(from, to);
};
const runtime = read(RUNTIME);
const page = read(CHAT_PAGE);
const blocks = {
  runtime,
  page,
  loop: section(
    runtime,
    "// A different pick supersedes the load in flight.",
    "// A local pick that is superseded by a later selection must not keep the slot.",
  ),
  cancel: section(
    runtime,
    "const cancelLoadRun = useCallback(",
    "const cancelLoadingWithCheckpointPolicy = useCallback(",
  ),
  inherit: section(
    runtime,
    "const inheritCancelledRunRollback = (",
    "// A different pick supersedes the load in flight.",
  ),
  registration: section(
    runtime,
    "const loadRun: ActiveModelLoadRun = {",
    "publishRefValue(activeLoadRunRef, loadRun);",
  ),
  external: section(
    page,
    "if (isExternalSelection) {",
    "const selectedExternal = parseExternalModelId(value);",
  ),
  picker: section(
    page,
    "if (store.modelLoading) {",
    "if (wantManagerStaging) {\n        setPendingHubAutoLoad(",
  ),
  selection: section(
    runtime,
    "const loadIntentId = ++modelSelectionIntentEpoch;",
    "if (!stopped) {",
  ),
  credentialDecline: section(
    runtime,
    "if (!preparedToken.proceed) {",
    "hfToken = preparedToken.token;",
  ),
  rollbackReads: section(
    runtime,
    "// Every rollback read below uses the INHERITED target, never this pick's own",
    "const targetIsDiffusion =",
  ),
  rollbackReadsCode: section(
    runtime,
    "// Every rollback read below uses the INHERITED target, never this pick's own",
    "const targetIsDiffusion =",
  )
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n"),
  loadingUiReset: section(
    runtime,
    "const resetLoadingUiForRun = useCallback(",
    "const renderLoadDescription = useCallback(",
  ),
  nativePathPayload: section(
    runtime,
    "const previousActiveNativePathToken =",
    "const previousIsGguf =",
  ),
  credentialPostAdoption: section(
    section(
      runtime,
      "const loadIntentId = ++modelSelectionIntentEpoch;",
      "if (!stopped) {",
    ),
    "activeLoadRunRef.current !== activeRunBeforeCredentials",
    "if (pendingReplacementRollback?.config)",
  ),
  rollbackClear: section(
    runtime,
    "function restoreRollbackConfigForClear(",
    "const approvedRemoteCodeFingerprints",
  ),
  preliminaryUnload: section(
    runtime,
    "if (!forceCancelActive && !touchesOnlySelected) {",
    "// Set either way: /load can still leave no model resident",
  ),
  preflightLease: section(
    runtime,
    "// Hold the lifecycle lease through confirmation and loading.",
    "if (lifecycleLease === null) {",
  ),
  loadGate: section(
    runtime,
    "async function performLoad(): Promise<void> {",
    "const pendingLoadConfig =",
  ),
  stagedMetadata: section(
    runtime,
    "const targetIsDiffusion =",
    "if (pendingLoadConfig) {",
  ),
  validation: section(
    runtime,
    "const validation = await validateModel({",
    "if (validation.mlx_loads_base_model) {",
  ),
  recheck: section(
    runtime,
    "// Re-check the tracked picker for a load that was already starting",
    "let forceCancelActive = stopDecision.forceCancelActive;",
  ),
  terminal: section(
    runtime,
    "await performLoad();",
    "// Last act of this run's coroutine",
  ),
  failedCancel: section(
    section(
      runtime,
      "const cancelLoadRun = useCallback(",
      "const cancelLoadingWithCheckpointPolicy = useCallback(",
    ),
    "// The request failed, so reconcile against the backend before releasing the",
    "return false;",
  ),
  cancelReconcile: section(
    section(
      runtime,
      "const cancelLoadRun = useCallback(",
      "const cancelLoadingWithCheckpointPolicy = useCallback(",
    ),
    "if (\n              (!run.loadAttemptPath",
    "activeLoadRunRef.current = releaseOwnedModelLoadRun(",
  ),
  externalSelection: section(
    page,
    "const isExternalSelection =",
    "if (isExternalSelection) {",
  ),
  leaseWait: section(
    runtime,
    "// Hold the lifecycle lease through confirmation",
    "loadLifecycleLeaseRef.current = lifecycleLease;",
  ),
  upgrade: section(
    runtime,
    "if (validation.requires_transformers_upgrade) {",
    "if (!upgraded) {",
  ),
  adoption: section(
    runtime,
    "if (confirmedStatus && adoptable(confirmedStatus)) {",
    "// Hold the lifecycle lease through confirmation",
  ),
  discardExternal: section(
    runtime,
    "const discardExternalReplacement =",
    "const restoreConfigForExternalReplacement =",
  ),
  forcedCancel: section(
    runtime,
    "await run.settledPromise;",
    "activeLoadRunRef.current = releaseOwnedModelLoadRun(",
  ),
  successfulCredentialRefresh: section(
    runtime,
    "// A prior run may have failed while this pick was waiting for Hub credentials.",
    "if (pendingReplacementRollback?.config)",
  ),
  externalFailure: section(page, "if (!stopped) {", "return;"),
};
type Check = readonly [keyof typeof blocks, RegExp];
interface Contract {
  name: string;
  match?: Check[];
  absent?: Check[];
  order?: readonly [keyof typeof blocks, ...string[]][];
}
const contracts: Contract[] = [
  {
    name: "a different pick supersedes the pending load instead of being rejected",
    match: [
      ["loop", /for \(;;\) \{/],
      ["loop", /const stopped = await cancelLoadRun\(activeRun, true\);/],
      ["loop", /if \(!stopped\) \{/],
      ["loop", /if \(!inFlightLoad && !activeRun\) break;/],
    ],
  },
  {
    name: "the pending load is stopped at the backend before the replacement claims the slot",
    match: [
      ["cancel", /await unloadModel\(\{/],
      ["cancel", /model_path: run\.loadAttemptPath,/],
      ["cancel", /const cancelPromise = \(async \(\): Promise<boolean> => \{/],
      ["cancel", /return false;/],
      ["cancel", /run\.cancelPromise = cancelPromise;/],
      ["cancel", /ownsModelLoadRun\(activeLoadRunRef\.current, run\)/],
      ["cancel", /releaseOwnedModelLoadRun\(/],
    ],
  },
  {
    name: "the matching request ID is threaded to both /load and its cancel",
    match: [
      ["registration", /requestId: createNavigationNonce\(\),/],
      ["runtime", /load_request_id: loadRun\.requestId,/],
      ["cancel", /cancel_load_request_id: run\.requestId,/],
      ["cancel", /model_path: run\.loadAttemptPath,/],
      ["runtime", /loadRun\.loadAttemptPath = loadPath;/],
    ],
    absent: [
      ["cancel", /await unloadModel\(\{ model_path: backendLoadModelId \}\)/],
    ],
  },
  {
    name: "the winning selection reserves the slot for its own run",
    match: [
      [
        "runtime",
        /const activeLoadRunRef = useRef<ActiveModelLoadRun \| null>\(null\)/,
      ],
      ["runtime", /const loadIntentId = \+\+modelSelectionIntentEpoch;/],
      ["registration", /abortController: abortCtrl,/],
      ["registration", /cancelPromise: null,/],
      ["runtime", /publishRefValue\(activeLoadRunRef, loadRun\)/],
      ["runtime", /modelSelectionIntentEpoch !== loadIntentId/],
    ],
  },
  {
    name: "a superseded run cannot clear a newer run's loading state",
    match: [
      ["runtime", /resetLoadingUiForRun\(loadRun\);/],
      ["loadingUiReset", /ownsModelLoadRun\(activeLoadRunRef\.current, run\)/],
      ["loadingUiReset", /if \(run\.cancelPromise\) return;/],
    ],
    absent: [["runtime", /\n\s{10}resetLoadingUi\(\);/]],
  },
  {
    name: "cacheRam stays in the load tuning snapshot",
    match: [
      [
        "runtime",
        /cacheRam: pendingLoadConfig\?\.cacheRam \?\? stateBeforeUnload\.cacheRam,/,
      ],
    ],
  },
  {
    name: "a pick arriving mid-cancel waits for the run that still holds the slot",
    match: [
      ["loop", /if \(!inFlightLoad && !activeRun\) break;/],
      ["loop", /if \(inFlightLoad\) \{/],
      ["loop", /const stopped = await cancelLoadRun\(activeRun, true\);/],
    ],
    absent: [["loop", /if \(!inFlightLoad\) break;/]],
  },
  {
    name: "a cancelled preflight keeps the slot until its coroutine unwinds",
    match: [
      ["runtime", /settledPromise: Promise<void>;/],
      ["runtime", /markLoadRunSettled = resolve;/],
      ["runtime", /settledPromise: loadRunSettled,/],
      ["runtime", /markSettled: markLoadRunSettled,/],
      [
        "runtime",
        /\} finally \{\n\s*\/\/ Last act of this run's coroutine[\s\S]*?markLoadRunSettled\(\);/,
      ],
      [
        "cancel",
        /if \(ownsModelLoadRun\(activeLoadRunRef\.current, run\)\) \{[\s\S]*?await run\.settledPromise;/,
      ],
    ],
  },
  {
    name: "the cancelled coroutine stops applying config after its preflight awaits",
    match: [
      ["stagedMetadata", /await fetchGgufStagedMetadata\(/],
      [
        "stagedMetadata",
        /if \(isAborted\(abortCtrl\.signal\)\) throw new Error\("Cancelled"\);/,
      ],
      [
        "validation",
        /if \(isAborted\(abortCtrl\.signal\)\) throw new Error\("Cancelled"\);/,
      ],
    ],
    order: [
      [
        "stagedMetadata",
        "await fetchGgufStagedMetadata(",
        'if (isAborted(abortCtrl.signal)) throw new Error("Cancelled");',
      ],
    ],
  },
  {
    name: "a superseded preflight yields instead of starting the stale load",
    match: [
      [
        "recheck",
        /if \(rivalLoadStarted\(\) \|\| modelSelectionIntentEpoch !== loadIntentId\) \{/,
      ],
      ["recheck", /releasePreflightLifecycleLease\(\);/],
    ],
  },
  {
    name: "a superseded run does not restore its config over the replacement",
    match: [
      [
        "terminal",
        /if \(modelSelectionIntentEpoch === loadIntentId\) restorePreviousConfig\(\);/,
      ],
    ],
  },
  {
    name: "a pick parked on a preflight lease waits for the holder instead of being lost",
    match: [
      ["preflightLease", /beginModelLoading\("preparing"\)/],
      [
        "preflightLease",
        /if \(modelSelectionIntentEpoch !== loadIntentId\) return;/,
      ],
      ["preflightLease", /if \(settled \|\| state\.modelLoading\) return;/],
      [
        "runtime",
        /if \(lease === null\) \{\s*toast\.info\("A model is loading"/,
      ],
    ],
    absent: [
      [
        "preflightLease",
        /leaseWaitDeadline|PREFLIGHT_LEASE_WAIT_MS|Date\.now\(\) >=/,
      ],
    ],
  },
  {
    name: "an external pick cancels the local load it replaces",
    match: [
      ["external", /if \(isActiveModelLoad\) \{/],
      [
        "external",
        /if \(!isModelSelectionIntentCurrent\(externalIntentId\)\) return;/,
      ],
      ["external", /live\.setCheckpoint\(value, null\);/],
      [
        "external",
        /if \(!stopped\) \{[\s\S]*?discardExternalReplacement\(externalIntentId\);[\s\S]*?return;[\s\S]*?\}\s*restoreConfigForExternalReplacement\(externalIntentId\);/,
      ],
      ["external", /discardExternalReplacement\(externalIntentId\);/],
      ["page", /isModelSelectionIntentCurrent,/],
    ],
    order: [
      [
        "external",
        "invalidatePendingModelSelection()",
        "cancelLoadingForReplacement(externalIntentId)",
      ],
    ],
  },
  {
    name: "external picks invalidate every pending local preflight and restore full external capabilities",
    match: [
      ["external", /invalidatePendingModelSelection\(\)/],
      ["page", /externalCapabilityPatch = \{/],
      ["page", /useChatRuntimeStore\.setState\(externalCapabilityPatch\);/],
      [
        "external",
        /if \(externalCapabilityPatch\) \{[\s\S]*?setState\(externalCapabilityPatch\)/,
      ],
    ],
    order: [
      [
        "external",
        "invalidatePendingModelSelection()",
        "if (isActiveModelLoad)",
      ],
    ],
  },
  {
    name: "latest model pick remains queued until the preflight lifecycle lease is released",
    match: [
      ["leaseWait", /while \(isUnsetLease\(lifecycleLease\)\)/],
      ["leaseWait", /PREFLIGHT_LEASE_RETRY_MS/],
    ],
    absent: [
      [
        "leaseWait",
        /leaseWaitDeadline|PREFLIGHT_LEASE_WAIT_MS|Date\.now\(\) >=/,
      ],
    ],
  },
  {
    name: "reselecting the resident external model invalidates a pending local preflight",
    match: [
      ["externalSelection", /const isExternalSelection =/],
      [
        "externalSelection",
        /if \(isSameLoadedModel && !meta\?\.forceReload\) \{/,
      ],
      ["externalSelection", /if \(!isExternalSelection\) return;/],
      [
        "externalSelection",
        /if \(!isActiveModelLoad\) \{\s*invalidatePendingModelSelection\(\);\s*return;/,
      ],
    ],
  },
];
for (const { name, match = [], absent = [], order = [] } of contracts) {
  test(name, () => {
    for (const [block, pattern] of match) assert.match(blocks[block], pattern);
    for (const [block, pattern] of absent)
      assert.doesNotMatch(blocks[block], pattern);
    for (const [block, ...needles] of order) {
      const offsets = needles.map((needle) => blocks[block].indexOf(needle));
      assert.ok(
        offsets.every((offset) => offset !== -1),
        `missing ordered assertion: ${needles.join(" → ")}`,
      );
      assert.ok(
        offsets.every((offset, i) => i === 0 || offsets[i - 1] < offset),
        `incorrect order: ${needles.join(" → ")}`,
      );
    }
  });
}

test("only the run that owns the slot may update or clear it", async () => {
  const { ownsModelLoadRun, releaseOwnedModelLoadRun } =
    await import("../src/features/chat/utils/model-load-run.ts");
  const run = { attemptId: 7 },
    other = { attemptId: 9, label: "newer" };
  assert.equal(ownsModelLoadRun(run, { attemptId: 7 }), true);
  assert.equal(ownsModelLoadRun(run, { attemptId: 8 }), false);
  assert.equal(ownsModelLoadRun(null, { attemptId: 7 }), false);
  assert.equal(releaseOwnedModelLoadRun(other, { attemptId: 7 }), other);
  assert.equal(releaseOwnedModelLoadRun(other, { attemptId: 9 }), null);
});

test("a downloaded replacement pick falls through to selectModel", () => {
  const guard = blocks.picker;
  assert.equal(
    (guard.match(/\breturn;/g) ?? []).length,
    2,
    "only duplicate-click and manager-handoff returns remain",
  );
  assert.match(
    guard,
    /The duplicate click is the only pick this guard refuses/,
  );
  assert.doesNotMatch(guard, /Another model is already loading/);
  assert.match(page, /await selectModel\(\{/);
  assert.doesNotMatch(guard, /return;\s*\}\s*$/);
});
