// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export interface StubThread {
  id: string;
  archived?: boolean;
  pairId?: string;
  title?: string;
  updatedAt?: number;
}

interface Recorder {
  notifications: number;
  patched: string[];
  events: string[];
  threads: StubThread[];
  failOn: Set<string>;
  slowOn: Set<string>;
}

export const recorder: Recorder = {
  notifications: 0,
  patched: [],
  events: [],
  threads: [],
  failOn: new Set(),
  slowOn: new Set(),
};

export function resetRecorder(
  threads: StubThread[],
  failOn: string[] = [],
  slowOn: string[] = [],
) {
  recorder.notifications = 0;
  recorder.patched = [];
  recorder.events = [];
  recorder.threads = threads;
  recorder.failOn = new Set(failOn);
  recorder.slowOn = new Set(slowOn);
}

export const CHAT_HISTORY_UPDATED_EVENT = "unsloth:chat-history-updated";

export function notifyChatHistoryUpdated(): void {
  recorder.notifications += 1;
  recorder.events.push("notify");
}

export  function listStoredChatThreads(): Promise<StubThread[]> {
  return Promise.resolve(recorder.threads);
}

export async function updateStoredChatThread(
  threadId: string,
  _patch: unknown,
  options: { notify?: boolean } = {},
): Promise<StubThread> {
  if (recorder.slowOn.has(threadId)) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (recorder.failOn.has(threadId)) {
    recorder.events.push(`fail:${threadId}`);
    throw new Error(`PATCH failed for ${threadId}`);
  }
  recorder.patched.push(threadId);
  recorder.events.push(`patch:${threadId}`);
  if (options.notify !== false) notifyChatHistoryUpdated();
  return { id: threadId, archived: true };
}

export  function listStoredChatThreadsWithMessages(): Promise<StubThread[]> {
  return Promise.resolve([]);
}
export  function deleteStoredChatThreads(): Promise<void> {return Promise.resolve(); }
export function isExpectedBackgroundChatStorageError(): boolean {
  return false;
}
export function clearComposerDraft(): void {/* intentionally empty */}
export  function offerToDeleteKeptSandboxes(): Promise<void> {return Promise.resolve(); }
export  function stopChatThread(): Promise<void> {return Promise.resolve(); }
export function markChatThreadsDeleted(): void {/* intentionally empty */}
export function notifyChatThreadsDeleted(): void {/* intentionally empty */}
export function removeChatThreadTombstones(): void {/* intentionally empty */}
export function requestPromptQueueStop(): void {/* intentionally empty */}
export  function repairLegacyChatTitles(): Promise<void> {return Promise.resolve(); }

const inertStore = {
  getState: () => ({
    setActiveThreadId: () => {/* intentionally empty */},
    cancelIfRunning: () => {/* intentionally empty */},
  }),
};
export const useChatRuntimeStore = inertStore;
export const useChatArtifactsStore = inertStore;
