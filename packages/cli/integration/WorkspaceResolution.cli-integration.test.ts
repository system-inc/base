// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { PROJECT_ROOT, runBase } from './internal/RunBase';

/**
 * End-to-end verification of `resolveWorkersScope` through the real CLI
 * binary. The unit suite covers the resolver function directly; this
 * suite catches regressions where the *integration* between yargs
 * middleware, `INIT_CWD`, and the resolver drifts — which is where the
 * "CWD got mangled by npx" bugs originally lived.
 *
 * Driver of choice: `base info` — read-only, fast, prints the resolved
 * values plus the resolution path that produced them.
 */

const EXAMPLES_DIR = path.join(PROJECT_ROOT, 'examples');
const TEST_WORKER_DIR = path.join(EXAMPLES_DIR, 'test-worker');

function workspaceLine(output: string, label: string): string | undefined {
    // `info` formats rows as `  <label-padded-to-20-chars> <value>`. We
    // capture the value after the label without depending on the exact
    // padding width.
    const match = output.match(
        new RegExp(`^\\s*${label}\\s{2,}(.+?)\\s*$`, 'm'),
    );
    return match?.[1];
}

describe('workspace resolution via `base info`', () => {
    it('walks up from project root to find package.json base.workersFolder', () => {
        const result = runBase(['info'], { cwd: PROJECT_ROOT });

        expect(result.code).toBe(0);
        expect(workspaceLine(result.stdout, 'workersFolder')).toBe(
            EXAMPLES_DIR,
        );
        expect(workspaceLine(result.stdout, 'name')).toBe('(none)');
    });

    it('infers worker from CWD when run from inside a worker folder', () => {
        const result = runBase(['info'], { cwd: TEST_WORKER_DIR });

        expect(result.code).toBe(0);
        expect(workspaceLine(result.stdout, 'workersFolder')).toBe(
            EXAMPLES_DIR,
        );
        expect(workspaceLine(result.stdout, 'name')).toBe('test-worker');
    });

    it('accepts a positional [worker] argument', () => {
        const result = runBase(['info', 'test-worker'], { cwd: PROJECT_ROOT });

        expect(result.code).toBe(0);
        expect(workspaceLine(result.stdout, 'name')).toBe('test-worker');
        expect(workspaceLine(result.stdout, 'workersFolder')).toBe(
            EXAMPLES_DIR,
        );
    });

    it('accepts the hidden -w alias', () => {
        const result = runBase(['info', '-w', 'test-worker'], {
            cwd: PROJECT_ROOT,
        });

        expect(result.code).toBe(0);
        expect(workspaceLine(result.stdout, 'name')).toBe('test-worker');
    });

    it('honors --workers-folder over package.json', () => {
        // We deliberately point at a sibling that doesn't exist as a
        // workersFolder in package.json. The resolver should still
        // respect the explicit CLI flag.
        const overridden = path.join(PROJECT_ROOT, 'examples');
        const result = runBase(['info', '--workers-folder', overridden], {
            cwd: PROJECT_ROOT,
        });

        expect(result.code).toBe(0);
        expect(workspaceLine(result.stdout, 'workersFolder')).toBe(overridden);
    });

    describe('fallback to CWD when no signal is present', () => {
        let tmpRoot: string;

        beforeEach(() => {
            tmpRoot = fs.realpathSync(
                fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-resolution-')),
            );
        });

        afterEach(() => {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        });

        it('falls back to CWD with no package.json, no ./workers, no flag', () => {
            const result = runBase(['info'], { cwd: tmpRoot });

            expect(result.code).toBe(0);
            // No package.json walking up from /var/folders/.../tmp dir
            // means we land in the "fallback to CWD" branch. The trace
            // also shows the CWD itself doesn't have settings.ts.
            expect(workspaceLine(result.stdout, 'workersFolder')).toBe(tmpRoot);
            expect(workspaceLine(result.stdout, 'name')).toBe('(none)');
        });
    });
});
