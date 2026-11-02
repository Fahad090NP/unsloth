// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

/** Rate and ETA from cumulative byte samples; `stable` needs 3+ samples over 3s+. */

import { useState } from "react";

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
  const [prev, setPrev] = useState({ bytes, totalBytes });
  const [state, setState] = useState<TransferStats>({
    rateBytesPerSecond: 0,
    etaSeconds: 0,
    stable: false,
  });

  if (prev.bytes !== bytes || prev.totalBytes !== totalBytes) {
    setPrev({ bytes, totalBytes });
    const now = Date.now() / 1000;
    const cur = typeof bytes === "number" && Number.isFinite(bytes) ? bytes : 0;
    const total =
      typeof totalBytes === "number" && Number.isFinite(totalBytes)
        ? totalBytes
        : 0;

    if (typeof document !== "undefined" && document.hidden) {
      // Hidden tabs clamp polling to ~1/min, which would skew the rate; drop stale samples.
      setSamples([]);
      setState({ rateBytesPerSecond: 0, etaSeconds: 0, stable: false });
    } else {
      const nextSamples = [...samples];
      appendSample(nextSamples, now, cur);
      setSamples(nextSamples);
      setState(computeTransferStats(nextSamples, total));
    }
  }

  return state;
}
