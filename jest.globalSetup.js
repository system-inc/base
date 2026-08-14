// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

const { execFileSync } = require('node:child_process');
const path = require('node:path');

/**
 * Build the `base` CLI once before the whole Jest run.
 *
 * The `*.cli-integration.test.ts` suites exercise the CLI the only correct way —
 * by spawning the built bin as a subprocess (see `integration/internal/RunBase`).
 * `RunBase` fails loud if `dist/base-cli.js` is missing, but it will happily run
 * a STALE bundle if you edited source and forgot to rebuild — silently testing
 * old code. Building here makes "edit source, run tests" always test current code.
 *
 * It's a single esbuild pass (~1s) and idempotent, so the cost on unit-only runs
 * is negligible.
 */
module.exports = async () => {
    const cliDir = path.join(__dirname, 'packages', 'cli');
    execFileSync('node', ['build.mjs'], { cwd: cliDir, stdio: 'inherit' });
};
