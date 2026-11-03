// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// First, before typescript-eslint loads: it needs the TypeScript 6 API (see the script).
import "./scripts/eslint-typescript6.cjs";

import js from "@eslint/js";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import gitignore from "eslint-config-flat-gitignore";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// Local rules that the Tailwind IntelliSense surfaces but the plugin does not:
// a custom-property fallback written as `0px` is canonically unitless `0`.
const localRules = {
  rules: {
    "no-px-zero-fallback": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Use the canonical unitless 0 fallback inside a CSS variable",
        },
        messages: {
          unitless:
            "Use a unitless 0 fallback here: `var(--name, 0)`, not `var(--name, 0px)`.",
        },
        schema: [],
      },
      create(context) {
        return {
          Literal(node) {
            if (
              typeof node.value === "string" &&
              /var\(--[\w-]+,\s*0px\s*\)/.test(node.value)
            ) {
              context.report({ node, messageId: "unitless" });
            }
          },
        };
      },
    },
  },
};

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
      // These two stylistic fixers remove assertions/interfaces that carry
      // type information; keep them off so `--fix` cannot break the build.
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      // `||` is correct when a falsy primitive is a real value; only flag
      // object/nullish mixes where `??` is unambiguous.
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        {
          ignorePrimitives: {
            bigint: true,
            boolean: true,
            number: true,
            string: true,
          },
        },
      ],
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
      // `== null` is the idiomatic null-or-undefined check; forcing `=== null`
      // silently changes behaviour for optional values.
      "eqeqeq": ["error", "smart"],
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
      // HMR-only hint; component modules legitimately export hooks and types.
      "react-refresh/only-export-components": "off",

      // Diagnostics are intentional, but should not multiply silently.
      // Awaiting inside a loop is often required for ordering and rate limits,
      // so it is not a correctness gate.
      "no-await-in-loop": "off",
      // Diagnostics may use warn/error; console.log-style output stays banned.
      "no-console": ["warn", { allow: ["warn", "error"] }],

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
    // `node:test` schedules tests itself; awaiting the registration call is not
    // how the runner works. Treat its registration helpers as safe to float so
    // real floating promises in tests are still reported.
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          ignoreVoid: false,
          ignoreIIFE: false,
          allowForKnownSafeCalls: [
            {
              from: "package",
              package: "node:test",
              name: [
                "test",
                "it",
                "describe",
                "suite",
                "before",
                "after",
                "beforeEach",
                "afterEach",
              ],
            },
          ],
        },
      ],
      // The tests register external ESM resolver/loader modules, which
      // `registerHooks` cannot replace: it only supports synchronous,
      // in-process hooks. Migration would change loader semantics.
      "@typescript-eslint/no-deprecated": "off",
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
      "eqeqeq": ["error", "smart"],
      "no-console": "warn",
      "no-implicit-coercion": "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    // Test harnesses, build tooling and boot scripts report diagnostics to the
    // terminal by design. Keep this after the JavaScript block so it wins.
    files: [
      "tests/**/*.{ts,tsx}",
      "scripts/**/*.{ts,tsx,js,mjs,cjs}",
      "public/**/*.{js,mjs}",
      "smoke-*.tsx",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },
  {
    // Platform and third-party APIs with no non-deprecated replacement in the
    // supported browser / assistant-ui versions. Migrating these would change
    // behaviour (AudioWorklet loading, speech adapters, contentEditable editing),
    // so the deliberate uses are recorded here instead of at each call site.
    files: [
      "src/features/chat/adapters/pcm-recorder.ts",
      "src/features/browser/agent/page-agent.ts",
      "src/lib/copy-to-clipboard.ts",
      "src/components/assistant-ui/auto-read-aloud.tsx",
      "src/components/assistant-ui/thread.tsx",
      "src/components/assistant-ui/skill-mentions.tsx",
    ],
    rules: {
      "@typescript-eslint/no-deprecated": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "better-tailwindcss": betterTailwindcss,
      local: localRules,
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/index.css",
      },
    },
    rules: {
      "better-tailwindcss/enforce-canonical-classes": "error",
      "better-tailwindcss/no-concatenated-classes": "error",
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-deprecated-classes": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-unnecessary-whitespace": "error",
      "local/no-px-zero-fallback": "error",
    },
  },
]);
