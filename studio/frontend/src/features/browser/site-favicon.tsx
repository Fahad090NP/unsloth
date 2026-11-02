// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { cn } from "@/lib/utils";
import { InternetIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { hostOf } from "./address";
import { proxiedFavicon } from "./favicon";
import { useBrowserHistoryStore } from "./history-store";

function iconsFor(
  url: string,
  declared: string | undefined,
  preferred: string | undefined,
): string[] {
  let origin: string;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return [];
    origin = parsed.origin;
  } catch {
    return [];
  }
  return [
    ...new Set(
      [preferred, declared, `${origin}/favicon.ico`].filter(
        (icon): icon is string => Boolean(icon),
      ),
    ),
  ];
}

/** A site's icon, via the guarded proxy once on screen: `icon`, then the declared one, then /favicon.ico; a globe until one loads. */
export function SiteFavicon({
  url,
  icon,
  className,
  fallbackClassName,
}: {
  url: string;
  /** Tried first. A path is Studio's own, and a data: image already fetched (a bookmark's): both used as is. */
  icon?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const declared = useBrowserHistoryStore((state) => state.icons[hostOf(url)]);
  const local = icon?.startsWith("/") || icon?.startsWith("data:image/") ? icon : null;
  const [loaded, setLoaded] = useState<{ key: string; src: string } | null>(null);
  const [brokenKey, setBrokenKey] = useState<string | null>(null);
  const candidates = iconsFor(url, declared, local ? undefined : icon).join(
    "\n",
  );
  const iconKey = `${candidates}\u0000${local ?? ""}`;
  const found = loaded?.key === iconKey ? loaded.src : null;
  const broken = brokenKey === iconKey;
  useEffect(() => {
    const node = ref.current;
    const list = candidates ? candidates.split("\n") : [];
    if (local || !node || list.length === 0) return;
    let live = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      (async () => {
        for (const candidate of list) {
          const loaded = await proxiedFavicon(candidate);
          if (!live) return;
          if (loaded) {
            setLoaded({ key: iconKey, src: loaded });
            return;
          }
        }
      })().catch(() => undefined);
    });
    observer.observe(node);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [candidates, iconKey, local]);
  const src = local ?? found;
  return (
    <span ref={ref} className="flex shrink-0 items-center justify-center">
      {src && !broken ? (
        <img
          src={src}
          alt=""
          onError={() => { setBrokenKey(iconKey); }}
          className={cn("object-contain", className)}
        />
      ) : (
        <HugeiconsIcon
          icon={InternetIcon}
          strokeWidth={1.75}
          className={fallbackClassName}
        />
      )}
    </span>
  );
}
