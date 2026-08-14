// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { OrmConfiguration } from '@system-inc/base-foundation/configuration/BaseConfiguration';
import { isOrmSettingsD1 } from '@system-inc/base-foundation/orm/settings/OrmSettings';
import { ormGetDrizzleCredentials } from '../../orm/drizzle/OrmGetDrizzleCredentials';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { WranglerToml } from '../../project/WranglerToml';

/**
 * One worker's ownership claim over the tables of one physical database:
 * the tables it migrates (owned entities), keyed by an identity that is
 * stable across workers so claims on the same database can be compared.
 */
export interface SharedDatabaseOwnershipRecord {
    workerName: string;
    /**
     * The worker's local name for the database (its `orm` settings key) —
     * carried for reporting; two workers may name the same database
     * differently.
     */
    databaseName: string;
    databaseIdentity: string;
    tableNames: ReadonlyArray<string>;
}

export interface SharedDatabaseOwnershipViolation {
    databaseIdentity: string;
    tableName: string;
    owners: Array<{ workerName: string; databaseName: string }>;
}

/**
 * Accumulates ownership claims across a multi-worker check and reports
 * tables claimed as OWNED by more than one worker on the same physical
 * database. The shared-database contract is one owner per table (everyone
 * else lists it in `externalEntities`); two owners means two workers
 * generate and apply DDL for the same table under separate migration
 * ledgers, which can double-apply or conflict.
 */
export class SharedDatabaseOwnershipCollector {
    private readonly records: SharedDatabaseOwnershipRecord[] = [];

    record(record: SharedDatabaseOwnershipRecord): void {
        this.records.push(record);
    }

    findViolations(): SharedDatabaseOwnershipViolation[] {
        // identity -> table -> owners (deduped per worker: a worker
        // registering the same table twice is idempotent, not a conflict)
        const claims = new Map<
            string,
            Map<
                string,
                Map<string, { workerName: string; databaseName: string }>
            >
        >();
        for (const record of this.records) {
            let tables = claims.get(record.databaseIdentity);
            if (!tables) {
                tables = new Map();
                claims.set(record.databaseIdentity, tables);
            }
            for (const tableName of record.tableNames) {
                let owners = tables.get(tableName);
                if (!owners) {
                    owners = new Map();
                    tables.set(tableName, owners);
                }
                owners.set(record.workerName, {
                    workerName: record.workerName,
                    databaseName: record.databaseName,
                });
            }
        }

        const violations: SharedDatabaseOwnershipViolation[] = [];
        for (const [databaseIdentity, tables] of claims) {
            for (const [tableName, owners] of tables) {
                if (owners.size > 1) {
                    violations.push({
                        databaseIdentity,
                        tableName,
                        owners: [...owners.values()],
                    });
                }
            }
        }
        return violations;
    }
}

/**
 * A cross-worker identity for the physical database behind an ORM
 * configuration, or undefined when none can be resolved statically:
 *
 * - D1: the wrangler binding's `database_id` — the same id in two
 *   workers IS the same database.
 * - PlanetScale: host + database from the resolved connection
 *   credentials; skipped quietly when credentials aren't available to
 *   this run (a check without credentials can't compare, and guessing
 *   would fabricate conflicts).
 * - Durable Object SQLite and better-sqlite3 are per-object/per-file —
 *   not shareable across workers, so they have no cross-worker identity.
 */
export function resolveSharedDatabaseIdentity(
    project: BaseWorkerProject,
    environment: string,
    settings: BaseSettings,
    ormConfiguration: OrmConfiguration,
): string | undefined {
    const driver = ormConfiguration.databaseType.driver;
    if (isOrmSettingsD1(ormConfiguration)) {
        try {
            const d1Database = WranglerToml.findD1Database(
                project,
                environment,
                ormConfiguration.binding,
            );
            return `d1:${d1Database.database_id}`;
        } catch {
            // Missing wrangler entry — the ORM configuration check
            // reports that on its own; ownership just can't compare.
            return undefined;
        }
    }
    if (driver === 'planetscale') {
        try {
            const credentials = ormGetDrizzleCredentials(
                project,
                ormConfiguration.databaseName,
                environment,
                settings,
            );
            const url: unknown = credentials?.url;
            if (typeof url !== 'string' || url.length === 0) {
                return undefined;
            }
            const parsed = new URL(url);
            return `mysql:${parsed.hostname}${parsed.pathname}`;
        } catch {
            return undefined;
        }
    }
    return undefined;
}

/**
 * Prints violations and returns whether any were found. The fix is
 * always the same: exactly one worker keeps the entity in its owned
 * `entities`; every other worker takes it as external (module
 * registered with `externalSchema: true`, or the worker's / module's
 * `externalEntities`).
 */
export function reportSharedDatabaseOwnershipViolations(
    collector: SharedDatabaseOwnershipCollector,
): boolean {
    const violations = collector.findViolations();
    if (violations.length === 0) {
        return false;
    }
    console.error(
        `❌ Shared-database ownership: ${violations.length} table(s) owned by more than one worker. ` +
            'Each table has exactly one owner (which migrates it); every other worker must ' +
            'take it as external (`externalSchema: true` registration or `externalEntities`).',
    );
    for (const violation of violations) {
        const owners = violation.owners
            .map((owner) => `${owner.workerName} (as '${owner.databaseName}')`)
            .join(', ');
        console.error(
            `   - ${violation.databaseIdentity} table '${violation.tableName}' owned by: ${owners}`,
        );
    }
    return true;
}
