// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import {
    buildSchema,
    findBreakingChanges,
    findDangerousChanges,
    lexicographicSortSchema,
    type BreakingChange,
    type DangerousChange,
} from 'graphql';

import { Base } from '@system-inc/base-foundation/base/Base';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';

/**
 * Outcome of comparing a worker's in-memory GraphQL schema against the
 * committed baseline. Pure data — callers handle printing and exit.
 * Shared by `base graphql schema:check` (which exits non-zero on
 * breaking) and `base check` (which reports per-worker and aggregates).
 */
export interface GqlSchemaCheckResult {
    state: 'ok' | 'missing-baseline' | 'breaking' | 'dangerous-only';
    workerName: string;
    baselinePath: string;
    breaking: readonly BreakingChange[];
    dangerous: readonly DangerousChange[];
}

/**
 * Generate the worker's current GraphQL schema in memory and compare
 * it to the committed `schema.graphql` baseline. Caller is responsible
 * for verifying `base.configuration.graphql` is set before invoking
 * (no-graphql workers should be handled at the call site).
 */
export async function performGqlSchemaCheck(
    base: Base,
    project: BaseWorkerProject,
): Promise<GqlSchemaCheckResult> {
    const workerName = project.worker;
    const baselinePath = path.join(
        project.graphqlSchemaFolder,
        'schema.graphql',
    );

    if (!fs.existsSync(baselinePath)) {
        return {
            state: 'missing-baseline',
            workerName,
            baselinePath,
            breaking: [],
            dangerous: [],
        };
    }

    const currentGraphQLSchema = await base.getGqlSchema();
    const currentSDL = printSchemaWithDirectives(
        lexicographicSortSchema(currentGraphQLSchema),
    );
    const baselineSDL = fs.readFileSync(baselinePath, 'utf8');
    const baselineSchema = buildSchema(baselineSDL);
    const currentSchema = buildSchema(currentSDL);

    const breaking = findBreakingChanges(baselineSchema, currentSchema);
    const dangerous = findDangerousChanges(baselineSchema, currentSchema);

    if (breaking.length > 0) {
        return {
            state: 'breaking',
            workerName,
            baselinePath,
            breaking,
            dangerous,
        };
    }
    if (dangerous.length > 0) {
        return {
            state: 'dangerous-only',
            workerName,
            baselinePath,
            breaking,
            dangerous,
        };
    }
    return {
        state: 'ok',
        workerName,
        baselinePath,
        breaking,
        dangerous,
    };
}

/**
 * Print a result the way the standalone `schema:check` command does.
 * Used by both the dedicated command and the per-worker `base check`
 * step so the messaging stays consistent.
 */
export function printGqlSchemaCheckResult(
    result: GqlSchemaCheckResult,
    options: { logPrefix?: string } = {},
): void {
    const prefix = options.logPrefix ?? '';

    if (result.state === 'ok') {
        console.log(
            `${prefix}✅ GraphQL schema for '${result.workerName}' is backward-compatible with the committed baseline.`,
        );
        return;
    }

    if (result.state === 'missing-baseline') {
        console.error(
            `${prefix}❌ No committed schema at ${result.baselinePath}.`,
        );
        console.error(
            `   Run \`base graphql schema:generate ${result.workerName}\` to generate and commit it first.`,
        );
        return;
    }

    if (result.dangerous.length > 0) {
        console.log(
            `${prefix}⚠️  ${result.dangerous.length} dangerous change(s) for '${result.workerName}' — may break specific client code paths:`,
        );
        for (const change of result.dangerous) {
            console.log(`   - ${change.description}`);
        }
        console.log();
    }

    if (result.breaking.length > 0) {
        console.error(
            `${prefix}❌ ${result.breaking.length} breaking change(s) for '${result.workerName}' — will break existing clients:`,
        );
        for (const change of result.breaking) {
            console.error(`   - ${change.description}`);
        }
        console.error('');
        console.error(
            `   Either fix the schema, or — if the breakage is intentional and the client is being migrated — re-run with --allow-breaking and update the committed baseline via \`base graphql schema:generate ${result.workerName}\`.`,
        );
    }
}
