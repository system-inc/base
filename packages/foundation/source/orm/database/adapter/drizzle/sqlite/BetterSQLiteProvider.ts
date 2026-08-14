// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';

import { BaseConfiguration } from '../../../../../configuration/BaseConfiguration';
import { Inject } from '../../../../../dependency-injection/decorators/Inject';
import { Injectable } from '../../../../../dependency-injection/decorators/Injectable';
import { OrmTableMetadata } from '../../../../metadata/OrmTableMetadata';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmSettingsBetterSQLite } from '../../../../settings/sqlite/OrmSettingsBetterSQLite';
import { OrmAdapter } from '../../OrmAdapter';
import { OrmAdapterProviderBetterSQLite } from '../../provider/interface/sqlite/OrmAdapterProviderBetterSQLite';
import { BetterSQLiteAdapter } from './BetterSQLiteAdapter';

@Injectable()
export class BetterSQLiteProvider implements OrmAdapterProviderBetterSQLite<'drizzle'> {
    readonly databaseType = {
        dialect: 'sqlite',
        driver: 'better-sqlite',
    } as const;
    readonly adapterType = 'drizzle';

    constructor(
        @Inject(BaseConfiguration) private readonly config: BaseConfiguration,
    ) {}

    getAdapter(
        database: string,
        settings: OrmSettingsBetterSQLite<'drizzle'>,
        metadata: OrmTableMetadata[],
    ): OrmAdapter {
        const db = new Database(settings.filePath);
        const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema(
            metadata,
        );
        return new BetterSQLiteAdapter(db, schema, {
            logging: settings.logging,
        });
    }
}
