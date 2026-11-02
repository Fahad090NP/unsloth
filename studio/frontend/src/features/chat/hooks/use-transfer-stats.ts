// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

/** Rate and ETA from cumulative byte samples; `stable` needs 3+ samples over 3s+. */

import { useEffect, useMemo, useState } from "react";

import {
  type TransferSample,
  type TransferStats,
  appendSample,
  computeTransferStats,
} from "@/lib/transfer-stats";

export type { TransferStats } from "@/lib/transfer-stats";

export function useTransferStats(
  bytes: number | null | undefined,
  totalBytes: number | null | undefined,
): TransferStats {
  const [samples, setSamples] = useState<TransferSample[]>([]);
  const total =
    typeof totalBytes === "number" && Number.isFinite(totalBytes)
      ? totalBytes
      : 0;

  // Sampling belongs in an effect: the clock is impure, so it cannot run during render.
  useEffect(() => {
    const cur = typeof bytes === "number" && Number.isFinite(bytes) ? bytes : 0;
    // Hidden tabs clamp polling to ~1/min, which would skew the rate; drop stale samples.
    const hidden = typeof document !== "undefined" && document.hidden;
    setSamples((current) => {
      if (hidden) return [];
      const next = [...current];
      appendSample(next, Date.now() / 1000, cur);
      return next;
    });
  }, [bytes]);

  return useMemo(() => computeTransferStats(samples, total), [samples, total]);
}
