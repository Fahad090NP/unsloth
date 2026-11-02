// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export { ModelSelector } from "./components/model-selector";
export { FolderBrowser } from "./components/model-selector/folder-browser";
export { invalidateLlamaFlagCatalog } from "./api/llama-flags";
export { ModelRowMenu } from "./components/model-selector/model-row-menu";
export { formatFootprintBytes } from "./components/model-selector/pickers";
export {
  makePinRank,
  pinKey,
  usePinnedModelsStore,
} from "./components/model-selector/pinned-models";
export {
  pinnedReasoningEffort,
  useModelReasoningEffortStore,
} from "./components/model-selector/model-reasoning-effort";
export {
  hfModelFitsDevice,
  loadScopedGpu,
} from "./components/model-selector/recommended-fit";
export {
  NumericValueInput,
  type NumericValueInputHandle,
  snapToStep,
} from "./components/numeric-value-input";
export { ModelConfigPage } from "./components/model-config-page";
export { SidebarModelConfig } from "./components/sidebar-model-config";
export type { ModelPickTarget } from "./components/model-selector/types";
export {
  fetchModelOverrides,
  modelOverrideKey,
  putModelOverride,
  syncModelOverride,
  type ApiModelOverride,
  type ApiModelOverrides,
} from "./api/model-overrides";
export { useActiveModelConfig } from "./hooks/use-active-model-config";
export { useVllmAvailable, useVllmPlatform } from "./hooks/use-vllm-available";
export { ManagedEngineOfferDialog } from "./components/managed-engine-offer-dialog";
export {
  confirmManagedEngineIfNeeded,
  type ManagedEngineOffer,
} from "./hooks/managed-engine-offer";
export type {
  DeletedModelRef,
  ExternalConnectionRef,
  ExternalModelOption,
  LoraModelOption,
  ModelOption,
  ModelSelectorChangeMeta,
} from "./components/model-selector";
export { modelConfigInstanceKey } from "./model-config/config-signature";
export { modelConfigDraftKey } from "./model-config/model-config-draft";
export { splitQuantSuffix } from "./model-config/model-identity";
export {
  clearModelConfigHandoff,
  createModelConfigHandoffRequestId,
  modelConfigHandoffForDestination,
  modelConfigTarget,
  modelConfigTargetIsResident,
  modelConfigTargetMatchesSelection,
  requestModelConfigHandoff,
  useModelConfigHandoffStore,
  type ModelConfigHandoffRequest,
} from "./model-config/model-config-handoff";
export {
  applyModelLoadConfigToRuntime,
  applyPerModelConfigToRuntime,
  currentRuntimePerModelConfig,
  perModelConfigsEqual,
} from "./model-config/apply-per-model-config";
export {
  DEFAULT_MAX_SEQ_LENGTH,
  DEFAULT_PER_MODEL_CONFIG,
  normalizeMaxSeqLength,
  type PerModelConfig,
  PER_MODEL_CONFIG_STORAGE_KEY,
  PER_MODEL_CONFIG_UPDATED_EVENT,
  adoptCachedRepoConfig,
  adoptLegacyConfigKey,
  isServedByLlamaCpp,
  resumesThought,
  contextPinPatch,
  listPerModelConfigs,
  isServedByMlx,
  residentIsServedByMlx,
  savedContextPin,
  loadedContextFields,
  presetLoadSettingNames,
  resolveInitialConfig,
  resolveResidentInitialConfig,
} from "./model-config/per-model-config";
export {
  SharedRunConfigLinkHandler,
  receiveSharedRunConfigUrls,
} from "./sharing";

export { explicitFamily, resolvedFamilyOverrideSelection, useFamilyOverride } from "./components/model-selector/family-override";
export { IMAGE_GEN_TASKS, VIDEO_GEN_TASKS } from "./components/model-selector/pickers";
export { PillTabs } from "./components/model-selector/pill-tabs";
export type { HostClass } from "./components/model-selector/host-artifact-policy";
export { hostOffersDensePrecision } from "./components/model-selector/host-artifact-policy";
export { IMAGE_CATALOG, VIDEO_CATALOG, catalogToModelOptions, curatedArtifactTakesDenseQuant, loadSpecFor, AUDIO_CATALOG, artifactForRepoId, groupForRepoId } from "./components/model-selector/model-catalog";
export { ggufQuantLabel } from "./model-config/model-identity";
export { taskForMediaPick, audioPickIsRoutable, curatedAudioInventoryTask, speechGgufIsUndecodable } from "./components/model-selector/audio-picker-policy";
export { InferenceEnginesSection } from "./components/inference-engines";
export { isChatGgufTask, reconcileGgufPinsAfterDelete } from "./components/model-selector/reconcile-gguf-pins";
export { useEngines } from "./hooks/use-engines";
export { loadManagedLlamaFlags } from "./api/llama-flags";
export { backfillModelOverrides } from "./api/migrate-model-overrides";
export { fetchLoadExtraArgs, foldOverrideKey } from "./api/model-overrides";
export { classifyHost } from "./components/model-selector/host-artifact-policy";
export { isMlxId } from "./components/model-selector/recommended-fit";
export { sanitizeStoredExtraArgs } from "./model-config/llama-extra-args";
export { cachedRepoConfigId, splitModelOverrideKey } from "./model-config/model-identity";
export {
  CONTEXT_LENGTH_MIN,
  KV_CACHE_DTYPES,
  MAX_SEQ_LENGTH_MAX,
  N_BATCH_MAX,
  N_BATCH_MIN,
  N_PARALLEL_MAX,
  N_PARALLEL_MIN,
  canonicalizeLoadMode,
  isReasoningBudgetMessageValid,
  mlxKvQuantLabel,
  normalizeCacheRam,
  normalizeCtxCheckpoints,
  normalizeMlxKvQuant,
  normalizeMlxOffload,
} from "./model-config/per-model-config";
export type { MlxKvQuant, MlxOffload } from "./model-config/per-model-config";
export { forgetPerModelConfigsForOverrideKeys } from "./model-config/saved-run-settings";
