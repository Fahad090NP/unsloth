// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { useCallback, useRef } from "react";

/** The modal scroll lock may cancel native wheel scrolling, so apply the delta here. */
export function useWheelScrollRef<T extends HTMLElement>() {
  const detachRef = useRef<(() => void) | null>(null);

  return useCallback((node: T | null) => {
    detachRef.current?.();
    detachRef.current = null;
    if (!node) {
      return;
    }
    const element = node;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || element.scrollHeight <= element.clientHeight) {
        return;
      }
      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? element.clientHeight
            : 1;
      const delta = event.deltaY * multiplier;
      if (delta === 0) {
        return;
      }
      element.scrollTop += delta;
      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    detachRef.current = () => { element.removeEventListener("wheel", onWheel); };
  }, []);
}
