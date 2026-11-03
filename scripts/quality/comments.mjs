// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// Comment policy shared by the pre-commit gate and the repo-wide fixer: join
// wrapped line comments, reject trailing comments, and require a file summary.

const COMMENT = /^\s*\/\/\s?(.*)$/;
const DIRECTIVE =
  /^(?:eslint|biome|@ts-|SPDX-|Copyright|prettier-|shellcheck|noinspection|sourceMappingURL|istanbul|c8|v8)/;
const BULLET = /^(?:[-*+\u2022]|\d+[.)])\s/;
const SENTENCE_END = /[.!?:;)\]}>,"'`]$/;
const CONTINUES = /^[a-z(]/;
const URL_LIKE = /^\w+:\/\//;

export const MAX_FILE_LINES = 800;

export function commentBody(line) {
  const match = COMMENT.exec(line);
  return match ? match[1].trim() : null;
}

export function isDirective(body) {
  return body !== null && DIRECTIVE.test(body);
}

export function indentation(line) {
  return line.length - line.trimStart().length;
}

/**
 * Join a wrapped line comment with the line below it when the pair reads as one
 * sentence and fits the configured width. Directives, bullets, URLs and lines
 * that already end a sentence are never merged.
 */
export function joinWrappedComments(text, { width = 96 } = {}) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let joined = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];
    const first = commentBody(current);
    const second = next === undefined ? null : commentBody(next);

    const joinable =
      first !== null &&
      second !== null &&
      first.length > 0 &&
      second.length > 0 &&
      indentation(current) === indentation(next) &&
      !isDirective(first) &&
      !isDirective(second) &&
      !BULLET.test(second) &&
      !URL_LIKE.test(second) &&
      !SENTENCE_END.test(first) &&
      CONTINUES.test(second) &&
      `${current.trimEnd()} ${second}`.length <= width;

    if (joinable) {
      out.push(`${current.trimEnd()} ${second}`);
      index += 1;
      joined += 1;
    } else {
      out.push(current);
    }
  }

  return { text: out.join("\n"), joined };
}

/**
 * Index of a real `//` comment start, skipping string, template and regex
 * literals. Returns -1 when the line has no line comment.
 */
export function commentIndex(line) {
  let index = 0;
  let quote = null;
  let inClass = false;
  let previous = "";

  while (index < line.length) {
    const char = line[index];

    if (quote !== null) {
      if (char === "\\") index += 2;
      else {
        if (char === quote) quote = null;
        index += 1;
      }
      continue;
    }

    if (char === "/" && line[index + 1] === "/") return index;
    if (char === "/" && line[index + 1] === "*") return -1;
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      index += 1;
      continue;
    }

    if (char === "/" && (previous === "" || /[=(,:;[!&|?{}]/.test(previous))) {
      index += 1;
      while (index < line.length) {
        if (line[index] === "\\") {
          index += 2;
          continue;
        }
        if (line[index] === "[") inClass = true;
        else if (line[index] === "]") inClass = false;
        else if (line[index] === "/" && !inClass) {
          index += 1;
          break;
        }
        index += 1;
      }
      previous = "/";
      continue;
    }

    if (!/\s/.test(char)) previous = char;
    index += 1;
  }

  return -1;
}

/**
 * Report `code // comment` lines. URLs, block comments and `//` inside string,
 * template or regex literals are ignored.
 */
export function findTrailingComments(lines) {
  const found = [];
  lines.forEach((line, index) => {
    const marker = commentIndex(line);
    if (marker <= 0) return;
    const before = line.slice(0, marker);
    if (before.trim().length === 0) return;
    if (/https?:$/.test(before.trimEnd())) return;
    found.push({ line: index + 1, text: line });
  });
  return found;
}

/**
 * New files must open with the license header followed by one short `//` line
 * that says what the file does.
 */
export function hasFileSummary(lines) {
  const header = lines.slice(0, 6);
  const hasLicense =
    header.some((line) => line.includes("SPDX-License-Identifier:")) &&
    header.some((line) => line.trimStart().startsWith("// Copyright"));
  if (!hasLicense) return false;
  const licenseEnd = Math.max(
    header.findIndex((line) => line.includes("SPDX-License-Identifier:")),
    header.findIndex((line) => line.trimStart().startsWith("// Copyright")),
  );
  return header.slice(licenseEnd + 1).some((line) => {
    const body = commentBody(line);
    return body !== null && !isDirective(body) && body.length > 0;
  });
}

export function splitLines(text) {
  return text.split(/\r?\n/);
}
