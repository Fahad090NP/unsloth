// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// Regenerates scripts/quality/known-failing-tests.json by running every suite.
import { spawn } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..", "..");
const frontend = path.join(root, "studio", "frontend");
const output = path.join(
  root,
  "scripts",
  "quality",
  "known-failing-tests.json",
);
const tests = readdirSync(path.join(frontend, "tests"))
  .filter((name) => name.endsWith(".test.ts"))
  .sort();

const failures: string[] = [];
let next = 0;

function runOne(file: string): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(
      "node",
      [
        "--experimental-strip-types",
        "--test",
        "--test-timeout=120000",
        path.join("tests", file),
      ],
      { cwd: frontend, stdio: "ignore" },
    );
    const timer = setTimeout(() => child.kill("SIGKILL"), 180_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) failures.push(`tests/${file}`);
      resolve();
    });
  });
}

async function worker(): Promise<void> {
  while (next < tests.length) {
    const file = tests[next];
    next += 1;
    await runOne(file);
  }
}

await Promise.all(
  Array.from({ length: Math.max(2, os.cpus().length - 2) }, worker),
);
failures.sort();
writeFileSync(output, `${JSON.stringify({ tests: failures }, null, 2)}\n`);
console.log(`${tests.length} suites, ${failures.length} failing`);
