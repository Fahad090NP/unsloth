// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

 
import { useChatPreferencesStore } from "@/features/chat";
 
import { defaultOpenFor } from "@/features/chat";
import { useEffect, useRef, useState } from "react";
import {
  resolveToolActivityOpen,
  startsNewToolRound,
} from "./tool-activity-open-state";

export function useToolActivityOpen(isRunning: boolean, hasText: boolean) {
  const visibility = useChatPreferencesStore((state) => state.toolVisibility);
  const [state, setState] = useState(() => ({
    open: defaultOpenFor(visibility, isRunning),
    override: null as boolean | null,
  }));
  const previousVisibility = useRef(visibility);
  const previousRunning = useRef(isRunning);

  useEffect(() => {
    const previous = previousVisibility.current;
    previousVisibility.current = visibility;
    // Regenerate reuses this card; clear the previous round's hand-set state like reasoning does.
    const startedNewRound = startsNewToolRound(isRunning, previousRunning.current);
    previousRunning.current = isRunning;
    setState((current) => {
      const override =
        previous === visibility && !startedNewRound ? current.override : null;
      return {
        override,
        open: resolveToolActivityOpen({
          currentOpen: current.open,
          visibility,
          previousVisibility: previous,
          isRunning,
          hasText,
          override,
          startedNewRound,
        }),
      };
    });
  }, [isRunning, hasText, visibility]);

  return [
    state.open,
    (open: boolean) => { setState({ open, override: open }); },
  ] as const;
}
