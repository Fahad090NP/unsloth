// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export function applyPerModelConfigToRuntime(): void { return undefined; }

export function currentRuntimePerModelConfig(): Record<string, unknown> {
  return {};
}

export function perModelConfigsEqual(): boolean {
  return true;
}

let residentConfig: unknown = null;

export function setResidentInitialConfig(value: unknown): void {
  residentConfig = value;
}

export function resolveResidentInitialConfig(): unknown {
  return residentConfig;
}

export function loadedContextFields(): Record<string, unknown> {
  return {};
}

export function savedContextPin(): null {
  return null;
}

export function adoptCachedRepoConfig(): null {
  return null;
}

export const CONTEXT_LENGTH_MIN = 128;
export const DEFAULT_PER_MODEL_CONFIG = {};
export const MAX_SEQ_LENGTH_MAX = 1_000_000;
export const DEFAULT_MAX_SEQ_LENGTH = 4096;
export const KV_CACHE_DTYPES = [];
export function mlxKvQuantLabel(): string {
  return "";
}
export function normalizeMlxKvQuant(value: unknown): unknown {
  return value;
}
export const N_BATCH_MAX = 4096;
export const N_BATCH_MIN = 1;
export const N_PARALLEL_MAX = 8;
export const N_PARALLEL_MIN = 1;
export function isReasoningBudgetMessageValid(): boolean {
  return true;
}
export function canonicalizeLoadMode(value: unknown): unknown {
  return value;
}
export function isServedByLlamaCpp(): boolean {
  return true;
}
export function isServedByMlx(): boolean {
  return false;
}
export function normalizeCacheRam(value: unknown): unknown {
  return value;
}
export function normalizeCtxCheckpoints(value: unknown): unknown {
  return value;
}
export function normalizeMaxSeqLength(value: unknown): unknown {
  return value;
}

export function pinnedReasoningEffort(): unknown {
  return undefined;
}

export const useModelReasoningEffortStore = {
  getState: () => ({
    effortByModel: {} as Record<string, unknown>,
    setModelReasoningEffort: () => { /* noop */ },
    syncFromStorage: () => { /* noop */ },
  }),
};