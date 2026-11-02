// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { useEffect, useState } from "react";

import { loadLlamaBackendStatus } from "@/features/settings";

/** null until known or when the status call fails. */
export function useLlamaCppBackend(): string | null {
  const [backend, setBackend] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadLlamaBackendStatus()
      .then((status) => {
        if (!cancelled) setBackend(status.backend);
      })
      .catch(() => { /* no-op */ });
    return () => {
      cancelled = true;
    };
  }, []);
  return backend;
}
