#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// Commit gate: formats and lints only the staged code, enforces the comment and
// file-size policy, typechecks the frontend, and runs the tests that touch the
// changed modules. Any warning, error or policy hit blocks the commit.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  MAX_FILE_LINES,
  findTrailingComments,
  hasFileSummary,
  joinWrappedComments,
  splitLines,
} from "./quality/comments.mjs";

const CODE = /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const MAX_TESTS = 25;
const TEST_TIMEOUT_MS = 15 * 60 * 1000;
const BAR = "\u2500".repeat(64);

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
process.chdir(ROOT);
const FRONTEND = path.join(ROOT, "studio", "frontend");

const useColor =
  process.env.FORCE_COLOR !== "0" &&
  (process.stdout.isTTY || Boolean(process.env.CLICOLOR_FORCE));
const paint = (code, text) =>
  useColor ? `\u001b[${code}m${text}\u001b[0m` : text;
const green = (text) => paint("32", text);
const red = (text) => paint("31", text);
const yellow = (text) => paint("33", text);
const dim = (text) => paint("2", text);
const bold = (text) => paint("1", text);

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function stage(files) {
  if (files.length > 0) git(["add", "--", ...files]);
}

const stagedFiles = git([
  "diff",
  "--cached",
  "--name-only",
  "--diff-filter=ACMR",
])
  .split(/\r?\n/)
  .filter(Boolean);
const codeFiles = stagedFiles.filter((file) => CODE.test(file));

if (codeFiles.length === 0) {
  console.log(
    dim(`pre-commit: no staged JavaScript/TypeScript changes (${BAR})`),
  );
  process.exit(0);
}

const added = new Set(
  git(["diff", "--cached", "--name-only", "--diff-filter=A"])
    .split(/\r?\n/)
    .filter(Boolean),
);

const checks = [];
const record = (name, ok, detail) => checks.push({ name, ok, detail });

// ---------------------------------------------------------------------------
// Format with Bun before linting so the fixers and the formatter agree.
// ---------------------------------------------------------------------------
const bunVersion = run("bun", ["--version"]);
if (bunVersion.status !== 0) {
  record(
    "Format (bun fmt)",
    false,
    "Bun is required for the commit gate. Install Bun from https://bun.com and retry.",
  );
} else {
  const config = path.join(FRONTEND, "bunfig.toml");
  const formatted = run("bun", [
    "fmt",
    ...(existsSync(config) ? [`--config=${config}`] : []),
    "--no-error-on-unmatched-pattern",
    ...codeFiles,
  ]);
  stage(codeFiles);
  record(
    "Format (bun fmt)",
    formatted.status === 0,
    formatted.status === 0
      ? `${codeFiles.length} file(s) · bun ${bunVersion.output}`
      : formatted.output,
  );
}

// ---------------------------------------------------------------------------
// Lint each staged file with the config that owns its directory.
// ---------------------------------------------------------------------------
const eslintBin = path.join(
  FRONTEND,
  "node_modules",
  "eslint",
  "bin",
  "eslint.js",
);
const frontendFiles = codeFiles
  .filter((file) => file.startsWith("studio/frontend/"))
  .map((file) => path.relative(FRONTEND, path.join(ROOT, file)));
const externalFiles = codeFiles.filter(
  (file) => !file.startsWith("studio/frontend/"),
);

function lint(files, cwd, extraArgs = []) {
  if (files.length === 0) return { ok: true, output: "no matching files" };
  const result = run(
    process.execPath,
    [eslintBin, ...extraArgs, "--fix", "--max-warnings=0", "--", ...files],
    { cwd },
  );
  return { ok: result.status === 0, output: result.output };
}

const frontendLint = lint(frontendFiles, FRONTEND);
stage(frontendFiles.map((file) => path.posix.join("studio/frontend", file)));
record(
  "ESLint (frontend, typed)",
  frontendLint.ok,
  frontendLint.ok ? `${frontendFiles.length} file(s)` : frontendLint.output,
);

const externalLint = lint(externalFiles, ROOT, [
  "--config",
  path.join(FRONTEND, "eslint.external.config.js"),
]);
stage(externalFiles);
record(
  "ESLint (repo-wide)",
  externalLint.ok,
  externalLint.ok ? `${externalFiles.length} file(s)` : externalLint.output,
);

// ---------------------------------------------------------------------------
// Comment and file-size policy.
// ---------------------------------------------------------------------------
// Only lines introduced by this commit are held to the trailing-comment rule,
// so touching a legacy file never forces a drive-by cleanup.
const addedLines = new Map();
const diffText = git(["diff", "--cached", "-U0", "--", ...codeFiles]);
let currentFile = null;
let newLine = 0;
for (const raw of diffText.split(/\r?\n/)) {
  if (raw.startsWith("+++ ")) {
    currentFile = raw.slice(4).replace(/^b\//, "");
    continue;
  }
  const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
  if (hunk) {
    newLine = Number(hunk[1]);
    continue;
  }
  if (currentFile === null || raw.length === 0) continue;
  if (raw.startsWith("+")) {
    addedLines.set(currentFile, [
      ...(addedLines.get(currentFile) ?? []),
      { line: newLine, text: raw.slice(1) },
    ]);
    newLine += 1;
  } else if (raw.startsWith(" ")) {
    newLine += 1;
  }
}

const policy = [];
let joinedComments = 0;
for (const file of codeFiles) {
  const absolute = path.join(ROOT, file);
  if (!existsSync(absolute)) continue;

  const original = readFileSync(absolute, "utf8");
  const joined = joinWrappedComments(original);
  if (joined.joined > 0) {
    writeFileSync(absolute, joined.text, "utf8");
    joinedComments += joined.joined;
  }

  const lines = splitLines(joined.text);
  if (lines.length > MAX_FILE_LINES) {
    // Files already over the limit are grandfathered: a formatter or a comment
    // fix must stay committable. Only new files and files that newly cross the
    // limit are blocked.
    let before = 0;
    try {
      before = splitLines(git(["show", `HEAD:${file}`])).length;
    } catch {
      before = 0;
    }
    if (before <= MAX_FILE_LINES) {
      policy.push(
        `${yellow(file)}  ${lines.length} lines, limit ${MAX_FILE_LINES}. Split it into modules.`,
      );
    }
  }

  const introduced = addedLines.get(file) ?? [];
  const trailing = findTrailingComments(introduced.map((item) => item.text));
  for (const item of trailing.slice(0, 5)) {
    const at = introduced[item.line - 1]?.line ?? item.line;
    policy.push(
      `${yellow(`${file}:${at}`)}  trailing comment, move it above the code.`,
    );
  }

  if (added.has(file) && !hasFileSummary(lines)) {
    policy.push(
      `${yellow(file)}  add a one-line // summary under the license header.`,
    );
  }
}
stage(codeFiles);
record(
  "Comments & file size",
  policy.length === 0,
  policy.length === 0
    ? `${joinedComments} wrapped comment(s) joined`
    : policy.slice(0, 10).join("\n"),
);

// ---------------------------------------------------------------------------
// Typecheck the frontend project, including the test project.
// ---------------------------------------------------------------------------
const touchesFrontend = codeFiles.some((file) =>
  file.startsWith("studio/frontend/"),
);
const typecheck = touchesFrontend
  ? run(
      process.execPath,
      [path.join(FRONTEND, "scripts", "typecheck.mjs"), "--tests"],
      {
        cwd: FRONTEND,
      },
    )
  : { status: 0, output: "skipped: no frontend files staged" };
record(
  "Typecheck",
  typecheck.status === 0,
  typecheck.status === 0 ? typecheck.output || "src + tests" : typecheck.output,
);

// ---------------------------------------------------------------------------
// Tests that reference a changed module, capped so the hook stays usable.
// ---------------------------------------------------------------------------
function collectTests(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...collectTests(absolute));
    else if (/\.test\.ts$/.test(entry.name)) found.push(absolute);
  }
  return found;
}

const testFiles = collectTests(path.join(FRONTEND, "tests"));
const exact = new Set();
const loose = new Set();
const GENERIC = new Set([
  "index",
  "types",
  "type",
  "utils",
  "util",
  "config",
  "api",
  "store",
  "main",
  "app",
  "lib",
  "helpers",
  "constants",
]);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const file of codeFiles) {
  if (!file.startsWith("studio/frontend/")) continue;
  const absolute = path.join(ROOT, file);
  if (file.startsWith("studio/frontend/tests/") && /\.test\.ts$/.test(file)) {
    exact.add(absolute);
    continue;
  }
  const relative = file.slice("studio/frontend/".length);
  const base = path.basename(relative).replace(CODE, "");
  const directory = path.posix.dirname(relative);
  const word = new RegExp(`(^|[^A-Za-z0-9_])${escape(base)}($|[^A-Za-z0-9_])`);
  for (const test of testFiles) {
    const source = readFileSync(test, "utf8");
    if (source.includes(relative) || source.includes(`"${base}"`)) {
      exact.add(test);
    } else if (word.test(source)) {
      loose.add(test);
    } else if (
      directory.includes("/") &&
      !GENERIC.has(base) &&
      source.includes(`${directory}/`)
    ) {
      loose.add(test);
    }
  }
}

const selected = [...exact, ...loose].slice(0, MAX_TESTS);
let testsOk = true;
let testsDetail = "no test references the changed modules";
if (selected.length > 0) {
  const result = run(
    process.execPath,
    [
      "--experimental-strip-types",
      "--test",
      "--test-force-exit",
      "--test-timeout=120000",
      ...selected.map((file) => path.relative(FRONTEND, file)),
    ],
    { cwd: FRONTEND, timeout: TEST_TIMEOUT_MS },
  );
  testsOk = result.status === 0;
  testsDetail = testsOk
    ? `${selected.length} test file(s)${loose.size + exact.size > MAX_TESTS ? ` (capped from ${loose.size + exact.size})` : ""}`
    : result.output.slice(-4000);
}
record("Affected tests", testsOk, testsDetail);

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------
console.log(`\n${bold("Commit gate")}  ${dim(BAR)}`);
for (const check of checks) {
  const mark = check.ok ? green("PASS") : red("FAIL");
  const label = check.name.padEnd(26);
  if (check.ok) {
    console.log(`  ${mark}  ${label}${dim(check.detail ?? "")}`);
  } else {
    console.log(`  ${mark}  ${red(label)}`);
    for (const line of String(check.detail ?? "")
      .split(/\r?\n/)
      .slice(0, 12)) {
      console.log(`        ${line}`);
    }
  }
}
console.log(dim(BAR));

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log(
    `${red(bold(`Commit blocked by ${failed.length} check(s).`))}  ${dim("Fix the items above and commit again.")}`,
  );
  process.exit(1);
}
console.log(
  green(bold("All checks passed.")) + dim("  Staged changes are clean."),
);
