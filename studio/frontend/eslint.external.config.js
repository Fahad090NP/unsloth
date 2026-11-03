// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// Repository-wide ESLint config for every JS/TS file outside studio/frontend.
// The frontend keeps its typed config; this one is syntax-only because those
// projects do not share the frontend tsconfig or its dependencies.
// First, before typescript-eslint loads: it needs the TypeScript 6 API (see the script).
import "./scripts/eslint-typescript6.cjs";

import js from "@eslint/js";
import gitignore from "eslint-config-flat-gitignore";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  gitignore(),
  {
    // Every TS/JS file in the repository is covered by exactly one config:
    // the frontend owns its tree, this config owns everything else. New files
    // anywhere outside `studio/frontend` are picked up automatically.
    ignores: ["studio/frontend/**", "studio/backend/assets/docs_ui/**"],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2026,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      eqeqeq: ["error", "always"],
      "no-console": "off",
      "no-var": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "prefer-const": "error",
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2026,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      eqeqeq: ["error", "always"],
      "no-console": "off",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },
]);
