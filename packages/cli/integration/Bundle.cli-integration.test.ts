// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';

import { PROJECT_ROOT, runBase } from './internal/RunBase';

/**
 * Smoke test for `base bundle`. Drives the esbuild path (fastest;
 * skips the wrangler dry-run pipeline) and asserts an artifact lands
 * on disk. Regressions in tsconfig wiring, esbuild externals, or
 * worker resolution all show up here.
 *
 * Side effect: writes into `examples/test-worker/build/`, which is
 * gitignored. No cleanup — letting the artifact persist is harmless
 * and matches normal developer workflow.
 */

const BUILD_DIR = path.join(PROJECT_ROOT, 'examples', 'test-worker', 'build');

describe('base bundle', () => {
    it('produces an esbuild artifact for test-worker', () => {
        const result = runBase(
            ['bundle', 'test-worker', '--bundler', 'esbuild'],
            { cwd: PROJECT_ROOT, timeoutMs: 60_000 },
        );

        expect(result.code).toBe(0);
        const artifact = path.join(BUILD_DIR, 'index.js');
        expect(fs.existsSync(artifact)).toBe(true);
        // Bundle non-empty — esbuild creates 0-byte files on certain
        // failure modes. A positive size confirms real output.
        expect(fs.statSync(artifact).size).toBeGreaterThan(0);
    }, 60_000);
});
