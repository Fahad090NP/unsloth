// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// First, before typescript-eslint loads: it needs the TypeScript 6 API (see the script).
import "./scripts/eslint-typescript6.cjs";

import js from "@eslint/js";
import gitignore from "eslint-config-flat-gitignore";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// The repository's .gitignore is the single source of truth for generated
// files; no folder names are duplicated here.
export default defineConfig([
  gitignore(),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2026,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Promise and async correctness.
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: false, ignoreIIFE: false },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksConditionals: true,
          checksSpreads: true,
          checksVoidReturn: {
            arguments: true,
            attributes: true,
            returns: true,
            variables: true,
          },
        },
      ],
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/return-await": ["error", "always"],
      "no-async-promise-executor": "error",
      "prefer-promise-reject-errors": "error",
      "require-atomic-updates": "error",

      // Type safety and exhaustiveness.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-meaningless-void-operator": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        { allowConstantLoopConditions: false },
      ],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowAny: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: false,
        },
      ],

      // Common production bugs.
      "@typescript-eslint/no-array-delete": "error",
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: false },
      ],
      "@typescript-eslint/no-deprecated": "warn",
      "@typescript-eslint/no-for-in-array": "error",
      "@typescript-eslint/no-implied-eval": "error",
      "eqeqeq": ["error", "always"],
      "no-constant-binary-expression": "error",
      "no-else-return": "error",
      "no-implicit-coercion": "error",
      "no-param-reassign": ["error", { props: true }],
      "no-return-assign": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      "no-throw-literal": "error",
      "no-unmodified-loop-condition": "error",
      "no-unneeded-ternary": "error",
      "no-unreachable-loop": "error",
      "no-useless-catch": "error",
      "no-useless-return": "error",
      "no-var": "error",
      "prefer-const": "error",

      // React hooks are correctness rules in this app.
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // Diagnostics are intentional, but should not multiply silently.
      "no-await-in-loop": "warn",
      "no-console": "warn",

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*"],
              message: "Import from feature index only: @/features/[name]",
            },
            {
              group: ["../features/*/**"],
              message: "Use absolute imports: @/features/[name]",
            },
          ],
        },
      ],
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
      "eqeqeq": ["error", "always"],
      "no-console": "warn",
      "no-implicit-coercion": "error",
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
