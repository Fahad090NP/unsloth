// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// Evaluates extracted source the way `new Function` did: inside a fresh
// function so a top-level `return` is legal, with the scope object as globals.
import { runInNewContext } from "node:vm";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers choose the shape.
export function runSource<T = unknown>(
  code: string,
  context: object = {},
  options: object = {},
): T {
  return runInNewContext(
    `(function () {\n${code}\n}).call(undefined)`,
    context,
    options,
  ) as T;
}
