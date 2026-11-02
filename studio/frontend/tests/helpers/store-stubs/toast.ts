// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export interface RecordedToast {
  kind: "info" | "error" | "warning" | "success" | "loading";
  message: string;
  description?: string;
}

export const recordedToasts: RecordedToast[] = [];

function stringifyOrEmpty(value: unknown): string {
  const serialized: string | undefined = JSON.stringify(value);
  return serialized ?? "";
}

function record(kind: RecordedToast["kind"]) {
  return (message?: unknown, options?: { description?: unknown }) => {
    recordedToasts.push({
      kind,
      message:
        typeof message === "string"
          ? message
          : message === null || message === undefined
            ? ""
            : stringifyOrEmpty(message),
      description:
        typeof options?.description === "string"
          ? options.description
          : undefined,
    });
  };
}

export const toast = {
  info: record("info"),
  error: record("error"),
  warning: record("warning"),
  success: record("success"),
  loading: record("loading"),
  dismiss: () => undefined,
};

export function createLoadingToastIcon(): null {
  return null;
}
