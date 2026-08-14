// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Spawn the built `base` CLI in a child process and capture its output.
 * Tests use this to drive the CLI end-to-end without going through `npx`
 * (whose CWD-mangling behavior we already paper over with `INIT_CWD`).
 *
 * Prerequisite: `npm run build` must have produced `packages/cli/dist`.
 * Resolving the bin via `require.resolve('@system-inc/base-cli/package.json')`
 * means a stale dist will execute stale code — fail loud rather than
 * auto-rebuilding (auto-rebuild gets in the way of debugging).
 */

export interface RunBaseResult {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: NodeJS.Signals | null;
}

export interface RunBaseOptions {
    /** Child process working directory. Also used as the default INIT_CWD. */
    cwd: string;
    /** Extra env vars to merge into the child env. */
    env?: Record<string, string | undefined>;
    /** Hard timeout. Defaults to 30s — generous for cold ts-node setups. */
    timeoutMs?: number;
}

/**
 * Path to the base-cli package directory (this file lives at
 * packages/cli/integration/internal/RunBase.ts). We can't use
 * `require.resolve('@system-inc/base-cli/package.json')` because the
 * root jest config's `moduleNameMapper` rewrites that pattern to point
 * at the source dir. A direct relative path sidesteps it.
 */
const CLI_PACKAGE_DIR = path.resolve(__dirname, '..', '..');

let cachedBinPath: string | undefined;

function resolveBaseBin(): string {
    if (cachedBinPath) return cachedBinPath;
    const pkgJsonPath = path.join(CLI_PACKAGE_DIR, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
        bin?: string | { base?: string };
    };
    const binRelative =
        typeof pkgJson.bin === 'string' ? pkgJson.bin : pkgJson.bin?.base;
    if (!binRelative) {
        throw new Error(
            `base-cli package.json at ${pkgJsonPath} has no bin.base entry`,
        );
    }
    const resolved = path.resolve(CLI_PACKAGE_DIR, binRelative);
    if (!fs.existsSync(resolved)) {
        throw new Error(
            `base-cli bin not found at ${resolved}. Run \`npm run build\` first.`,
        );
    }
    cachedBinPath = resolved;
    return resolved;
}

export function runBase(
    args: string[],
    options: RunBaseOptions,
): RunBaseResult {
    const binPath = resolveBaseBin();
    // INIT_CWD mirrors what npm/npx set when a real user runs `base`
    // from a shell. userCwd() reads it first, so passing it through
    // makes the child see `options.cwd` as the "user's CWD" — not
    // whatever the test runner started in.
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        INIT_CWD: options.cwd,
        ...(options.env as NodeJS.ProcessEnv),
    };
    const result = spawnSync('node', [binPath, ...args], {
        cwd: options.cwd,
        env,
        encoding: 'utf8',
        timeout: options.timeoutMs ?? 30_000,
    });
    return {
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        code: result.status,
        signal: result.signal,
    };
}

/**
 * Absolute path to the monorepo root. Tests use this when invoking the
 * CLI from "project root" to exercise the package.json walk-up branch.
 */
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
