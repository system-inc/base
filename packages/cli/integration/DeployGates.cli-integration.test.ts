// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';

import { PROJECT_ROOT, runBase } from './internal/RunBase';

/**
 * End-to-end coverage for the pre-deploy gates (DeployGates.ts). The
 * gates fire before any Cloudflare interaction, so these run without
 * credentials and never risk an actual deploy:
 *
 *   - dirty-tree refusal for non-Development environments
 *   - --allow-dirty downgrade to a warning
 *   - the --all-workers path wiring (gate fires before the check loop)
 *
 * The workspace-check gate (typecheck/lint/test) is not driven end to
 * end here — it would run the full repo suite inside a test. Its
 * resolution logic is unit-tested in DeployGates.test.ts.
 */

const LONG_TIMEOUT = 120_000;

/**
 * The gate reads `git status --porcelain`, so guarantee dirtiness with a
 * temp untracked file regardless of the checkout's actual state (a CI
 * checkout is clean; a dev tree usually isn't).
 */
const DIRTY_MARKER = path.join(PROJECT_ROOT, '.deploy-gates-test-marker');

beforeAll(() => {
    fs.writeFileSync(DIRTY_MARKER, 'temporary file to dirty the git tree');
});

afterAll(() => {
    fs.rmSync(DIRTY_MARKER, { force: true });
});

describe('base deploy dirty-tree gate', () => {
    it(
        'refuses a single-worker deploy of uncommitted changes to a non-Development environment',
        () => {
            const result = runBase(
                ['deploy', 'test-worker', '--environment', 'Production'],
                { cwd: PROJECT_ROOT, timeoutMs: LONG_TIMEOUT },
            );

            expect(result.code).not.toBe(0);
            const output = result.stdout + result.stderr;
            expect(output).toMatch(/Refusing to deploy uncommitted changes/);
            expect(output).toMatch(/--allow-dirty/);
        },
        LONG_TIMEOUT,
    );

    it(
        'refuses --all-workers before running any per-worker checks',
        () => {
            const result = runBase(
                [
                    'deploy',
                    '--all-workers',
                    '--environment',
                    'Production',
                    '--dry-run',
                ],
                { cwd: PROJECT_ROOT, timeoutMs: LONG_TIMEOUT },
            );

            expect(result.code).not.toBe(0);
            const output = result.stdout + result.stderr;
            expect(output).toMatch(/Refusing to deploy uncommitted changes/);
            // Gate fires before worker discovery/checking starts.
            expect(output).not.toMatch(/Discovered workers/);
        },
        LONG_TIMEOUT,
    );

    it(
        'downgrades to a warning with --allow-dirty and proceeds through the dry-run',
        () => {
            // Integration (not Production): still non-Development, so the
            // gate applies — and it's the env the example workers actually
            // declare in wrangler.toml, so the check loop can pass.
            const result = runBase(
                [
                    'deploy',
                    '--all-workers',
                    '--environment',
                    'Integration',
                    '--dry-run',
                    '--allow-dirty',
                ],
                { cwd: PROJECT_ROOT, timeoutMs: LONG_TIMEOUT },
            );

            expect(result.code).toBe(0);
            const output = result.stdout + result.stderr;
            expect(output).toMatch(/uncommitted change/);
            expect(output).toMatch(/COMMIT_SHA.*-dirty/);
            expect(output).toMatch(/Dry run complete/);
        },
        LONG_TIMEOUT,
    );
});
