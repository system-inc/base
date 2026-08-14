// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { BaseAppManifest } from '@system-inc/base-foundation/configuration/BaseAppManifest';
import { ormRequireTable } from '@system-inc/base-foundation/orm/metadata/OrmSchemaRegistry';

/**
 * The database table names a worker owns for a given ORM database: its resolved
 * entity set (worker + module entities, plus any `inheritSchema`) mapped to
 * their `@OrmTable` names.
 *
 * Used to scope drizzle-kit `push` (`schema:sync`) with `--tablesFilter` so it
 * only reconciles this worker's tables and leaves unrelated tables in a shared
 * database untouched instead of dropping them.
 */
export function ormGetDatabaseTableNames(
    settings: BaseSettings,
    databaseName: string,
): string[] {
    const manifest = BaseAppManifest.fromSettings(settings);
    return manifest
        .getOrmSettings(databaseName)
        .entities.map((entity) => ormRequireTable(entity).name);
}
