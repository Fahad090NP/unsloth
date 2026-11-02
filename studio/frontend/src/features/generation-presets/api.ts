// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { authFetch } from "@/features/auth";
import type {
  MediaGenerationKind,
  MediaGenerationPreset,
  MediaGenerationPresetSettings,
  MediaGenerationPresetState,
} from "./types";

export class PresetWriteRefused extends Error {}

async function parseResponse<Result>(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? (body as { detail?: unknown }).detail
        : null;
    if (typeof detail === "string" && detail) {
      throw new PresetWriteRefused(detail);
    }
    throw new Error(
      detail ? JSON.stringify(detail) : `Request failed (${response.status})`,
    );
  }
  return body as Result;
}

export async function getMediaGenerationPresetSettings<Params>(
  kind: MediaGenerationKind,
) {
  return await parseResponse<MediaGenerationPresetSettings<Params>>(
    await authFetch(`/api/settings/generation-presets/${kind}`),
  );
}

export async function saveMediaGenerationPresetSettings<Params>(
  kind: MediaGenerationKind,
  settings: MediaGenerationPresetState<Params>,
  keepalive = false,
) {
  return await parseResponse<{ saved: boolean }>(
    await authFetch(`/api/settings/generation-presets/${kind}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
      keepalive,
    }),
  );
}

export async function upsertMediaGenerationPreset<Params>(
  kind: MediaGenerationKind,
  preset: MediaGenerationPreset<Params>,
) {
  return await parseResponse<{ saved: boolean }>(
    await authFetch(`/api/settings/generation-presets/${kind}/custom`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preset),
    }),
  );
}

export async function deleteMediaGenerationPreset(
  kind: MediaGenerationKind,
  name: string,
) {
  const query = new URLSearchParams({ name });
  return await parseResponse<{ deleted: boolean }>(
    await authFetch(
      `/api/settings/generation-presets/${kind}/custom?${query}`,
      { method: "DELETE", keepalive: true },
    ),
  );
}
