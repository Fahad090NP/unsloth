import { isTauri } from "@/lib/api-base";
import { useEffect } from "react";
import { drainNativeIntents } from "./api";
import { useNativeIntentStore } from "./store";

export function NativeIntentDrain() {
  const addIntent = useNativeIntentStore((state) => state.addIntent);

  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    async function drain() {
      const intents = await drainNativeIntents().catch(() => []);
      if (disposed) return;
      for (const intent of intents) addIntent(intent);
    }

    drain().catch(() => undefined);
    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen("native-intent-available", () => {
          drain().catch(() => undefined);
        }),
      )
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [addIntent]);

  return null;
}
