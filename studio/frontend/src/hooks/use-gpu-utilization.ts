// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { authFetch } from "@/features/auth";
import { useEffect, useRef, useState } from "react";

export interface GpuUtilization {
    available: boolean;
    backend: string | null;
    devices?: GpuUtilization[];
    index?: number;
    visible_ordinal?: number;
    gpu_utilization_pct: number | null;
    temperature_c: number | null;
    vram_used_gb: number | null;
    vram_total_gb: number | null;
    vram_utilization_pct: number | null;
    power_draw_w: number | null;
    power_limit_w: number | null;
    power_utilization_pct: number | null;
}

const DEFAULT: GpuUtilization = {
    available: false,
    backend: null,
    gpu_utilization_pct: null,
    temperature_c: null,
    vram_used_gb: null,
    vram_total_gb: null,
    vram_utilization_pct: null,
    power_draw_w: null,
    power_limit_w: null,
    power_utilization_pct: null,
};

/** Polls only while `enabled` (training running). */
export function useGpuUtilization(
    enabled: boolean,
    intervalMs = 10_000,
): GpuUtilization {
    const [data, setData] = useState<GpuUtilization>(DEFAULT);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!enabled) {
            queueMicrotask(() => {
                setData(DEFAULT);
            });
            return;
        }

        let cancelled = false;
        const isCancelled = () => cancelled;
        const runPoll = () => {
            poll().catch((error: unknown) => {
                console.error("Failed to poll GPU utilization", error);
            });
        };

        async function poll() {
            try {
                const res = await authFetch("/api/train/hardware");
                if (!res.ok || isCancelled()) return;
                const json = (await res.json()) as GpuUtilization;
                if (!isCancelled()) setData(json);
            } catch {
                // Retry on the next poll.
            }
        }

        runPoll();
        timerRef.current = setInterval(runPoll, intervalMs);

        return () => {
            cancelled = true;
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [enabled, intervalMs]);

    return data;
}
