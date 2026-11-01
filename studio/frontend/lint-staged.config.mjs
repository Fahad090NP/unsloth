// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

// Staged TypeScript is formatted by ESLint's fixers and then checked with the
// same strict config as `npm run lint`; warnings block the commit too.
export default {
  "**/*.{ts,tsx,js,jsx,mjs,cjs}": "eslint --fix --max-warnings=0",
};
