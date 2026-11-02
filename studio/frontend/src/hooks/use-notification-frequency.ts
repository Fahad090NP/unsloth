// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { useEffect, useState, useSyncExternalStore } from "react";

// How often each update notification may appear (Settings -> General -> Notifications).
export const NOTIFICATION_FREQUENCIES = [
  "always",
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "off",
] as const;
export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number];

export const NOTIFICATION_CHANNELS = [
  "llama",
  "whisper",
  "audio",
  "unsloth",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS: Partial<Record<NotificationFrequency, number>> = {
  daily: DAY_MS,
  weekly: 7 * DAY_MS,
  biweekly: 14 * DAY_MS,
  monthly: 30 * DAY_MS,
};

// whisper.cpp and audio.cpp only matter to speech and Audio users, so they ask less often.
const DEFAULT_FREQUENCY: Partial<
  Record<NotificationChannel, NotificationFrequency>
> = {
  whisper: "biweekly",
  audio: "biweekly",
};
// setTimeout overflows past 2^31 - 1 ms.
const MAX_TIMEOUT_MS = 2_147_483_647;

// These were on/off switches; only "false" was ever stored, and it means off.
const LEGACY_SWITCH_KEYS: Partial<Record<NotificationChannel, string>> = {
  llama: "unsloth_show_llama_update_banner",
  whisper: "unsloth_show_whisper_update_banner",
  audio: "unsloth_show_audio_cpp_update_banner",
};

const frequencyKey = (channel: NotificationChannel) =>
  `unsloth_${channel}_notification_frequency`;
const lastShownKey = (channel: NotificationChannel) =>
  `unsloth_${channel}_notification_last_shown`;

/** Every key this module owns, for "Reset all local preferences". */
export const NOTIFICATION_PREF_KEYS: readonly string[] = [
  ...NOTIFICATION_CHANNELS.flatMap((c) => [frequencyKey(c), lastShownKey(c)]),
  ...Object.values(LEGACY_SWITCH_KEYS),
];

const OWN_KEYS = new Set(NOTIFICATION_PREF_KEYS);
const listeners = new Set<() => void>();

function isFrequency(value: unknown): value is NotificationFrequency {
  return (NOTIFICATION_FREQUENCIES as readonly unknown[]).includes(value);
}

export function getNotificationFrequency(
  channel: NotificationChannel,
): NotificationFrequency {
  try {
    const stored = localStorage.getItem(frequencyKey(channel));
    if (isFrequency(stored)) return stored;
    const legacy = LEGACY_SWITCH_KEYS[channel];
    if (legacy && localStorage.getItem(legacy) === "false") return "off";
  } catch {
    // storage unavailable
  }
  return DEFAULT_FREQUENCY[channel] ?? "always";
}

export function setNotificationFrequency(
  channel: NotificationChannel,
  frequency: NotificationFrequency,
): void {
  try {
    localStorage.setItem(frequencyKey(channel), frequency);
    const legacy = LEGACY_SWITCH_KEYS[channel];
    if (legacy) localStorage.removeItem(legacy);
  } catch {
    // storage unavailable
  }
  for (const listener of listeners) listener();
}

function getLastShown(channel: NotificationChannel): number | null {
  try {
    const value = Number(localStorage.getItem(lastShownKey(channel)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function markNotificationShown(
  channel: NotificationChannel,
  now: number = Date.now(),
): void {
  try {
    localStorage.setItem(lastShownKey(channel), String(now));
  } catch {
    // storage unavailable
  }
  for (const listener of listeners) listener();
}

/** Whether a notification last shown at `lastShown` may appear again at `now`. */
export function notificationDue(
  frequency: NotificationFrequency,
  lastShown: number | null,
  now: number,
): boolean {
  if (frequency === "off") return false;
  const period = PERIOD_MS[frequency];
  // A clock moved backwards reads as due rather than silencing it for good.
  return (
    period == null ||
    lastShown == null ||
    now - lastShown >= period ||
    now < lastShown
  );
}

// The showing a gate recorded, kept next to the store it comes from rather than mirrored in state.
const heldShownAt = new Map<NotificationChannel, number>();

function subscribeHeld(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function holdChannel(channel: NotificationChannel, at: number): void {
  heldShownAt.set(channel, at);
  for (const listener of listeners) listener();
}

function releaseChannel(channel: NotificationChannel): void {
  if (heldShownAt.delete(channel)) {
    for (const listener of listeners) listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Sync changes made in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || OWN_KEYS.has(event.key)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useNotificationFrequency(
  channel: NotificationChannel,
): NotificationFrequency {
  return useSyncExternalStore(subscribe, () =>
    getNotificationFrequency(channel),
  );
}

/** Whether `channel` may show now; re-renders when its quiet period ends. */
export function useNotificationDue(channel: NotificationChannel): boolean {
  const frequency = useNotificationFrequency(channel);
  const lastShown = useSyncExternalStore(subscribe, () =>
    getLastShown(channel),
  );
  // The clock is sampled in a lazy initializer or timer callback, never during render.
  const [now, setNow] = useState(() => Date.now());
  const due = notificationDue(frequency, lastShown, now);
  // A new sample re-arms the timer after a capped wake-up, which a monthly wait needs.
  useEffect(() => {
    const period = PERIOD_MS[frequency];
    if (due || period == null || lastShown == null) return;
    const wait = Math.min(
      Math.max(lastShown + period - Date.now(), 0) + 1000,
      MAX_TIMEOUT_MS,
    );
    const timer = setTimeout(() => { setNow(Date.now()); }, wait);
    return () => { clearTimeout(timer); };
  }, [due, frequency, lastShown]);
  return due;
}

function subscribeVisibility(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => { document.removeEventListener("visibilitychange", listener); };
}

/** Whether the user can see this tab; a hidden tab must not use up the quiet period. */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () =>
      typeof document === "undefined" || document.visibilityState !== "hidden",
  );
}

/**
 * Whether a notification that `wanted` to show may show. Opening it in a visible tab
 * records the time, and it stays open until `wanted` drops (dismiss, snooze, update) or
 * the channel is off.
 */
export function useNotificationGate(
  channel: NotificationChannel,
  wanted: boolean,
): boolean {
  const due = useNotificationDue(channel);
  const frequency = useNotificationFrequency(channel);
  const visible = useDocumentVisible();
  const lastShown = useSyncExternalStore(subscribe, () =>
    getLastShown(channel),
  );
  // The hold is the showing this gate recorded, so it derives from the store instead of mirroring it.
  const recordedAt = useSyncExternalStore(subscribeHeld, () =>
    heldShownAt.get(channel),
  );
  const held = lastShown !== null && recordedAt === lastShown;
  const open = wanted && frequency !== "off" && (held || due);
  useEffect(() => {
    if (open && !held && visible) {
      const at = Date.now();
      markNotificationShown(channel, at);
      holdChannel(channel, at);
    } else if ((!wanted || frequency === "off") && held) {
      // Off releases the hold, so a later quiet period applies from the last showing.
      releaseChannel(channel);
    }
  }, [open, held, visible, wanted, channel, frequency]);
  return open;
}
