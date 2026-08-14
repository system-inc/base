// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { PROJECT_ROOT, runBase } from './internal/RunBase';

/**
 * End-to-end coverage for `base check` and the schema:check family.
 * These commands exercise the full base runtime (settings.ts load,
 * DI graph, GraphQL builder) so they're slower than a typical CLI
 * test — keep the assertions targeted at behaviors that wouldn't be
 * caught by unit tests:
 *
 *   - multi-worker fan-out (--all-workers) loops cleanly and resets
 *     global metadata between iterations
 *   - aggregate commands SKIP workers that lack the relevant config
 *   - specific commands ERROR when invoked against a misconfigured
 *     worker (the documented "specific = error, aggregate = skip" rule)
 *   - exit codes match the intent (drift detection gates CI)
 */

const LONG_TIMEOUT = 60_000;

describe('base check', () => {
    it(
        'passes for a single well-configured worker (test-worker)',
        () => {
            const result = runBase(['check', 'test-worker'], {
                cwd: PROJECT_ROOT,
                timeoutMs: LONG_TIMEOUT,
            });

            expect(result.code).toBe(0);
            expect(result.stdout).toMatch(/Check worker passed/);
        },
        LONG_TIMEOUT,
    );

    it(
        'fans out over --all-workers and reports a clean run',
        () => {
            // Examples currently include test-worker (with graphql + ORM),
            // base-durable (durable object, no graphql), and the queue
            // consumer/producer (neither). If the fan-out forgets to
            // reset global decorator metadata between iterations, the
            // second worker through the loop fails — this catches that.
            const result = runBase(['check', '--all-workers'], {
                cwd: PROJECT_ROOT,
                timeoutMs: LONG_TIMEOUT,
            });

            expect(result.code).toBe(0);
            expect(result.stdout).toMatch(/All workers passed/);
            // Verify the per-worker resets actually happened (string
            // appears once per worker after the first).
            const resetCount = (
                result.stdout.match(/Resetting global state/g) ?? []
            ).length;
            expect(resetCount).toBeGreaterThan(0);
        },
        LONG_TIMEOUT,
    );
});

describe('base graphql schema:check', () => {
    it(
        'passes for a worker whose committed baseline matches current',
        () => {
            const result = runBase(['graphql', 'schema:check', 'test-worker'], {
                cwd: PROJECT_ROOT,
                timeoutMs: LONG_TIMEOUT,
            });

            expect(result.code).toBe(0);
            expect(result.stdout).toMatch(/backward-compatible/);
        },
        LONG_TIMEOUT,
    );

    it(
        'errors when invoked against a worker with no GraphQL config (specific = error)',
        () => {
            // base-durable has no graphql config. A *specific* command
            // targeting it must fail loudly — the user asked for graphql
            // info and there is none.
            const result = runBase(
                ['graphql', 'schema:check', 'base-durable'],
                { cwd: PROJECT_ROOT, timeoutMs: LONG_TIMEOUT },
            );

            expect(result.code).not.toBe(0);
            expect(result.stderr + result.stdout).toMatch(
                /no GraphQL configuration|no graphql/i,
            );
        },
        LONG_TIMEOUT,
    );

    it(
        'skips no-graphql workers under --all-workers (aggregate = skip)',
        () => {
            // Same workers as above, but in aggregate mode: only test-worker
            // contributes; the others are skipped silently rather than
            // failing the run.
            const result = runBase(
                ['graphql', 'schema:check', '--all-workers'],
                { cwd: PROJECT_ROOT, timeoutMs: LONG_TIMEOUT },
            );

            expect(result.code).toBe(0);
            expect(result.stdout).toMatch(/backward-compatible/);
        },
        LONG_TIMEOUT,
    );
});

describe('base orm schema:check', () => {
    it(
        'passes for a worker with up-to-date schema.generated.ts',
        () => {
            const result = runBase(['orm', 'schema:check', 'test-worker'], {
                cwd: PROJECT_ROOT,
                timeoutMs: LONG_TIMEOUT,
            });

            expect(result.code).toBe(0);
            expect(result.stdout).toMatch(/up-to-date/);
        },
        LONG_TIMEOUT,
    );

    it(
        'fans out cleanly over --all-workers, skipping workers without ORM',
        () => {
            // base-durable + test-worker have drizzle databases; the queue
            // workers don't. Aggregate run should skip the latter rather
            // than fail.
            const result = runBase(['orm', 'schema:check', '--all-workers'], {
                cwd: PROJECT_ROOT,
                timeoutMs: LONG_TIMEOUT,
            });

            expect(result.code).toBe(0);
            expect(result.stdout).toMatch(/ORM schema check passed/);
            expect(result.stdout).toMatch(/skipped/);
        },
        LONG_TIMEOUT,
    );
});
