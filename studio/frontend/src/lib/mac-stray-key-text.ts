// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// The macOS app's child webview (Tauri `unstable`) re-sends a key the page leaves unhandled to the
// window, whose text input then types its control character into the field: U+001C left at the
// start, U+001D right at the end, U+0001 Home, U+0004 End (#14764, tauri-apps/tauri#10194). No key
// types C0 controls or DEL on purpose; tab, line feed and carriage return are kept.
function isStrayControlText(text: string): boolean {
  if (text.length === 0) return false;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const stray =
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    if (!stray) return false;
  }
  return true;
}

export function isStrayKeyText(
  inputType: string,
  data: string | null,
): boolean {
  return (
    inputType === "insertText" &&
    typeof data === "string" &&
    isStrayControlText(data)
  );
}

export function watchMacStrayKeyText(win: Window): void {
  win.addEventListener(
    "beforeinput",
    (event) => {
      if (isStrayKeyText(event.inputType, event.data)) {
        event.preventDefault();
      }
    },
    true,
  );
}
