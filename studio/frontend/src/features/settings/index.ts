// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export { SettingsDialogMount } from "./settings-dialog-mount";
export { FullInstallDialog } from "./components/full-install-dialog";
export {
  type JobResult,
  jobOutputLines,
  jobResult,
} from "./tabs/sandbox-tab-state";
export {
  type DownloadTransportMode,
  type DownloadTransportSettings,
  loadDownloadTransportSettings,
  subscribeDownloadTransportSettings,
  updateDownloadTransportSettings,
} from "./api/download-transport";
export { loadEmbeddingModelSettings } from "./api/embedding-model";
export { notifyRendererReady } from "./api/gpu-rendering";
export { updateHubSource } from "./api/hub-settings";
export { loadLanAccess, publishLanUrls } from "./api/lan-access";
export { lanApiUrls } from "./api/lan-access-state";
export { loadMultiModelEnabled } from "./api/multi-model";
export { loadOpenAIAutoSwitchSettings } from "./api/openai-auto-switch";
export { listOpenAIModels } from "./api/openai-models";
export {
  loadSystemOneSettings,
  subscribeSystemOneSettings,
  updateSystemOneSettings,
} from "./api/systemone";
export { DECISION_MODEL_LABELS } from "./lib/decision-model-labels";
export {
  loadHuggingFaceCacheSettings,
  updateHuggingFaceCacheSettings,
} from "./api/hugging-face-cache";
export type { HuggingFaceCacheSettings } from "./api/hugging-face-cache";
export {
  formatUploadSize,
  getCachedUploadLimitBytes,
  getCachedUploadLimitLabel,
  loadUploadLimitSettings,
  subscribeUploadLimitSettings,
} from "./api/upload-limit";
export {
  loadPersonalization,
  savePersonalization,
} from "./api/personalization";
export {
  isPalette,
  setPalette,
  setTheme,
  usePalette,
  useTheme,
} from "./stores/theme-store";
export {
  DEFAULT_CUSTOMIZATION,
  applyCustomizationToDocument,
  isDefaultCustomization,
  migrateAppearanceMenuDefault,
  migrateShippedSidebarNavDefault,
  prefersReducedMotion,
  sanitizeCustomization,
  sidebarNavAutoAfterChoice,
  sidebarNavRowPinned,
  useAppearanceCustomStore,
} from "./stores/appearance-custom-store";
export type {
  AppearanceCustomization,
  CustomModeColors,
  ReduceMotionSetting,
  SidebarNavItemId,
  SidebarNavItemPref,
} from "./stores/appearance-custom-store";
export { useMonitorOverlayStore } from "./stores/monitor-overlay-store";
export { useEmbeddingModelStore } from "./stores/embedding-model-store";
export { useEmbeddingPinsStore } from "./stores/embedding-pins-store";
export {
  type EmbeddingSwitchResult,
  ejectEmbeddingModel,
  embeddingModelName,
  embeddingModelOwner,
  switchEmbeddingModel,
} from "./lib/switch-embedding-model";
export {
  applyInterfaceScale,
  stepInterfaceScale,
  useInterfaceScaleStore,
} from "./stores/interface-scale-store";
// The runtime module, not the store, so outside consumers do not pull in zustand.
export {
  NATIVE_MAC_TITLEBAR_HEIGHT_VAR,
  NATIVE_MAC_TRAFFIC_LIGHT_INSET_VAR,
  getAppliedInterfaceZoom,
  subscribeAppliedInterfaceZoom,
} from "./lib/interface-scale-runtime";
export {
  type MonitorFrame,
  useMonitorFrameStore,
} from "./stores/monitor-frame-store";
export type {
  Personalization,
  PersonalizationAppearance,
  PersonalizationProfile,
} from "./api/personalization";
export {
  COMPOSER_INPUT_SELECTOR,
  isImeComposing,
  isSurfaceBackgrounded,
  isSurfaceInForeground,
  triggerShortcut,
  useShortcut,
  useShortcutLabel,
  useShortcutLabels,
  useShortcutAvailable,
} from "./hooks/use-shortcut";
export { useHubSourceNotice } from "./hooks/use-hub-source-notice";
export { Shortcut } from "./components/shortcut";
export {
  currentBinding,
  shortcutMatchingEvent,
  useKeyboardShortcutsStore,
  resolveBindings,
} from "./stores/keyboard-shortcuts-store";
export type { ShortcutId } from "./lib/keyboard-shortcuts";
export { SETTINGS_TABS, useSettingsDialogStore } from "./stores/settings-dialog-store";
export { trainingApiRequestFromPayload } from "./components/training-api-snippets";
export { settingsTabVisible } from "./settings-tab-visibility";
export { DIALOG_SETTINGS_SEARCH_INDEX } from "./dialog-search-index";
export type { SettingsTab } from "./stores/settings-dialog-store";
export { requestSttDownload } from "./stores/stt-download-prompt-store";
export {
  applyDictationDictionary,
  recordRecentDictation,
  sttModelName,
  sttModelVariant,
  useVoiceSettingsStore,
  withSttVariant,
} from "./stores/voice-settings-store";
export type { Palette, ResolvedTheme, Theme } from "./stores/theme-store";

export {
  isMacPlatform,
  isModEnter,
  modEnterLabel,
} from "./lib/keyboard-shortcuts";

export { generationFailureLogsAction } from "./lib/view-logs-action";
export { modelMemorySettingsAction } from "./lib/model-memory-action";
export type { VramBudgetSettings } from "./api/vram-budget";
export { dropVramBudgetRetry, flushVramBudgetSave, isVramBudgetLocked, loadVramBudgetSettings, setVramBudgetLocked, settleVramBudgetSave, stageVramBudgetSave, subscribeVramBudgetLock, subscribeVramBudgetSettings, updateVramBudgetSettings } from "./api/vram-budget";
export type { ModelMemorySettings } from "./api/model-memory";
export { loadModelMemorySettings, subscribeModelMemorySettings } from "./api/model-memory";
export { sttModelSize } from "./stores/stt-model-catalog";
export { checkDiskSpace } from "./low-disk-check";
export { reserveXetNoticeFromServer } from "./api/xet-notice";
export { SettingsRow } from "./components/settings-row";
export { SettingsSection } from "./components/settings-section";
export { startLanAccess, stopLanAccess, updateLanAccessAddresses, updateLanAccessAutoStart, updateLanAccessPort } from "./api/lan-access";
export { LAN_ACCESS_POLL_MS, defaultLanAccessAddressSelection, keylessLanAccessDescription, lanAccessAddressChoices, lanAccessAddressesReadOnly, lanAccessAutoStartReadOnly, lanAccessBlockMessage, lanAccessErrorMessage, lanAccessPortReadOnly, lanAccessStopDisconnectsOrigin, sameLanAccessAddresses, staleLanUrls, validLanAccessPort } from "./api/lan-access-state";
export type { LanAccessStatus } from "./api/lan-access-state";
export { trackSttDownload } from "./lib/stt-download-mirror";
export type { KeylessApiAccessScope, KeylessApiAccessSettings } from "./api/keyless-api-access";
export { loadKeylessApiAccess, updateKeylessApiAccess } from "./api/keyless-api-access";
export { loadRemoteAccess, startRemoteAccess, stopRemoteAccess, updateRemoteAccessAutoStart } from "./api/remote-access";
export type { RemoteAccessStatus } from "./api/remote-access-state";
export { remoteAccessAutoStartReadOnly, remoteAccessBlockMessage, remoteAccessErrorMessage, remoteAccessPollDelay, remoteAccessSelfStopPoll, remoteAccessStopDisconnectsOrigin } from "./api/remote-access-state";
