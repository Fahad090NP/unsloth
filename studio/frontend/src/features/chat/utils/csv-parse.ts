// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

export function parseCsv(text: string): string[][] {
  let source = text;
  // Tauri text reads keep the BOM our exports write; File.text() strips it.
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;

  function finishRow() {
    rows.push(row);
    row = [];
  }

  while (i < source.length) {
    if (source[i] === '"') {
      i++;
      let cell = "";
      while (i < source.length) {
        if (source[i] === '"') {
          if (source[i + 1] === '"') {
            cell += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          cell += source[i++];
        }
      }
      row.push(cell);
      if (source[i] === ",") { i++; }
      else if (source[i] === "\r") { i++; if (source[i] === "\n") i++; finishRow(); }
      else if (source[i] === "\n") { i++; finishRow(); }
    } else if (source[i] === "\r") {
      i++;
      if (source[i] === "\n") i++;
      row.push("");
      finishRow();
    } else if (source[i] === "\n") {
      i++;
      row.push("");
      finishRow();
    } else {
      let cell = "";
      while (i < source.length && source[i] !== "," && source[i] !== "\r" && source[i] !== "\n") {
        cell += source[i++];
      }
      row.push(cell);
      if (source[i] === ",") { i++; }
      else if (source[i] === "\r") { i++; if (source[i] === "\n") i++; finishRow(); }
      else if (source[i] === "\n") { i++; finishRow(); }
    }
  }
  if (row.length > 0) rows.push(row);
  return rows;
}
