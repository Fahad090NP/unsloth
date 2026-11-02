// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// Split out of the overlay so it can be tested without a browser.

import type { ApiMonitorEntry } from "@/features/chat";

export type WatchedEntry = Pick<
  ApiMonitorEntry,
  "id" | "status" | "via_api_key" | "started_at"
>;

export interface WatchedResponse {
  entries: readonly WatchedEntry[];
  // biome-ignore lint/style/useNamingConvention: API schema
  server_time?: number | null;
}

export interface ApiMonitorWatch {
  seeded: boolean;
  /** A set, not "the newest id": finishing moves an entry to the front. */
  seenIds: Set<string>;
  /** performance.now() when this watch began; monotonic, so a clock step cannot move it. */
  watchStartedAt: number;
  resumed: boolean;
  /** The observer re-runs on any store change; a second fold would spend a pending re-arm. */
  lastFolded: WatchedResponse | null;
}

export function createWatch(nowMs: number): ApiMonitorWatch {
  return {
    seeded: false,
    seenIds: new Set(),
    watchStartedAt: nowMs,
    resumed: false,
    lastFolded: null,
  };
}

/** Re-anchor as the poll stands up, only while unseeded: the first snapshot can land much later. */
export function startWatching(watch: ApiMonitorWatch, nowMs: number): void {
  const state = watch;
  if (!state.seeded) {
    state.watchStartedAt = nowMs;
  }
}

/** The full page took over; what it showed is not new traffic on the way back. */
export function rearmWatch(watch: ApiMonitorWatch): void {
  const state = watch;
  state.seeded = false;
  state.resumed = true;
}

/** Write off calls that landed during an opt-out, unless unseeded (no backlog yet). */
export function standDownWatch(watch: ApiMonitorWatch): void {
  if (!watch.seeded) {
    return;
  }
  rearmWatch(watch);
}

/** Server time minus a browser duration, so clock skew cancels; null without a server clock. */
function historyCutoff(
  watch: ApiMonitorWatch,
  response: WatchedResponse,
  nowMs: number,
): number | null {
  const serverTime = response.server_time;
  if (typeof serverTime !== "number" || !Number.isFinite(serverTime)) {
    return null;
  }
  return serverTime - Math.max(0, nowMs - watch.watchStartedAt) / 1000;
}

function isHistory(entry: WatchedEntry, cutoff: number | null): boolean {
  // Still running at the first snapshot: it started while Unsloth loaded, so it is unseen.
  if (entry.status === "running") {
    return false;
  }
  if (cutoff === null || !Number.isFinite(entry.started_at)) {
    return true;
  }
  // A call made while the tab was hidden is already terminal at the first poll.
  return entry.started_at <= cutoff;
}

export function observeResponse(
  watch: ApiMonitorWatch,
  response: WatchedResponse,
  nowMs: number,
): boolean {
  const state = watch;
  // Fold each snapshot once; a refold would count the stand-down backlog as new.
  if (state.lastFolded === response) {
    return false;
  }
  state.lastFolded = response;
  const { entries } = response;
  if (!state.seeded) {
    state.seeded = true;
    const { resumed } = state;
    state.resumed = false;
    const cutoff = historyCutoff(state, response, nowMs);
    // Returning from the full page, which showed this feed, marks everything as read.
    state.seenIds = new Set(
      entries
        .filter((entry) => resumed || isHistory(entry, cutoff))
        .map((e) => e.id),
    );
  }
  const seen = state.seenIds;
  // Only API-key traffic counts: Unsloth's own chat uses these same endpoints.
  const hasNewTraffic = entries.some(
    (entry) => entry.via_api_key && !seen.has(entry.id),
  );
  // Re-seed each poll so the set stays bounded by the server's ring buffer.
  state.seenIds = new Set(entries.map((entry) => entry.id));
  return hasNewTraffic;
}
