// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { PROJECT_ROOT, runBase } from './internal/RunBase';

/**
 * Smoke tests for the top-level CLI dispatch surface. These don't care
 * about *which* command does what — only that the bin loads, yargs
 * parses, and the dispatcher routes basic invocations correctly.
 */
describe('base CLI top-level dispatch', () => {
    it('prints help on --help and exits 0', () => {
        const result = runBase(['--help'], { cwd: PROJECT_ROOT });

        expect(result.code).toBe(0);
        // yargs renders a Commands: section in --help output. If the
        // dispatcher fails to register commands, this disappears.
        expect(result.stdout).toMatch(/Commands:/);
        expect(result.stdout).toMatch(/info/);
    });

    it('exits non-zero with usage when no command is given', () => {
        const result = runBase([], { cwd: PROJECT_ROOT });

        expect(result.code).not.toBe(0);
        // demandCommand error from yargs lands on stderr.
        expect(result.stderr.length).toBeGreaterThan(0);
    });

    it('exits non-zero on an unknown command', () => {
        const result = runBase(['definitely-not-a-real-command'], {
            cwd: PROJECT_ROOT,
        });

        expect(result.code).not.toBe(0);
    });

    it('runs `info` against the monorepo root', () => {
        const result = runBase(['info'], { cwd: PROJECT_ROOT });

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Workspace:');
        expect(result.stdout).toContain('Resolution path:');
    });

    it('loads settings.ts under --with-settings (real base bootstrap)', () => {
        // The expensive path: --with-settings actually imports the
        // worker's settings.ts. This is the test that catches breakage
        // in the ts-node bootstrap, decorators registration, or DI
        // wiring — none of which are exercised by the bare `info` run.
        const result = runBase(['info', '--with-settings', 'test-worker'], {
            cwd: PROJECT_ROOT,
            timeoutMs: 60_000,
        });

        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Settings (loaded)');
        // test-worker has both @default and d1 databases declared.
        expect(result.stdout).toContain('Databases (ORM)');
        expect(result.stdout).toContain('@default');
        expect(result.stdout).toContain('d1');
    }, 60_000);
});
