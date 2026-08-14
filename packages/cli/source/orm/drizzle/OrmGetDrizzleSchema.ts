// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { BaseAppManifest } from '@system-inc/base-foundation/configuration/BaseAppManifest';
import { DrizzleFullSchema } from '@system-inc/base-foundation/orm/database/adapter/drizzle/types/DrizzleDefaultSchema';
import { ormRequireTable } from '@system-inc/base-foundation/orm/metadata/OrmSchemaRegistry';
import { OrmTableMetadata } from '@system-inc/base-foundation/orm/metadata/OrmTableMetadata';
import { OrmSchemaBuilderDrizzleMySql } from '@system-inc/base-foundation/orm/schema/drizzle/OrmSchemaBuilderDrizzleMySql';
import { OrmSchemaBuilderDrizzleSQLite } from '@system-inc/base-foundation/orm/schema/drizzle/OrmSchemaBuilderDrizzleSQLite';

/**
 * Helper function used in Drizzle schema files to dynamically get the
 * schema for the database.
 *
 * @param database
 * @param settings
 * @returns
 */
export function ormGetDrizzleSchema(
    database: string,
    settings: BaseSettings,
): DrizzleFullSchema<unknown> {
    if (!settings.orm || !settings.orm[database]) {
        throw new Error(`ORM settings for database ${database} not found.`);
    }

    const ormSettings = settings.orm[database];
    const appManifest = BaseAppManifest.fromSettings(settings);

    const dbMetadata: OrmTableMetadata[] = [];
    const ormManifestEntry = appManifest.getOrmSettings(database);

    if (ormManifestEntry.entities.length === 0) {
        console.warn(
            `No entities found for database ${database}. Returning empty schema.`,
        );
        return {};
    }

    for (const entity of ormManifestEntry.entities) {
        const metadata = ormRequireTable(entity);
        if (metadata) {
            dbMetadata.push(metadata);
        }
    }

    if (ormSettings.databaseType.dialect === 'mysql') {
        return new OrmSchemaBuilderDrizzleMySql().createSchema(dbMetadata);
    }

    // everything else is a flavor of SQLite
    return new OrmSchemaBuilderDrizzleSQLite().createSchema(dbMetadata);
}
