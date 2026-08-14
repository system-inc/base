// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseConfiguration } from '../../../../../configuration/BaseConfiguration';
import { BaseEnvironmentKey } from '../../../../../configuration/BaseEnvironmentKey';
import { Inject } from '../../../../../dependency-injection/decorators/Inject';
import { Injectable } from '../../../../../dependency-injection/decorators/Injectable';
import { OrmTableMetadata } from '../../../../metadata/OrmTableMetadata';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmSettingsD1 } from '../../../../settings/sqlite/OrmSettingsD1';
import { OrmAdapter } from '../../OrmAdapter';
import { OrmAdapterProviderD1 } from '../../provider/interface/sqlite/OrmAdapterProviderD1';
import { D1Adapter } from './D1Adapter';

@Injectable()
export class D1Provider implements OrmAdapterProviderD1<'drizzle'> {
    readonly databaseType = { dialect: 'sqlite', driver: 'd1' } as const;
    readonly adapterType = 'drizzle';

    constructor(
        @Inject(BaseConfiguration) private readonly config: BaseConfiguration,
    ) {}

    getAdapter(
        database: string,
        settings: OrmSettingsD1<'drizzle'>,
        metadata: OrmTableMetadata[],
    ): OrmAdapter {
        const d1 = this.config.getEnvironmentVariable(
            BaseEnvironmentKey.create(settings.binding),
        );
        if (!isD1Database(d1)) {
            throw new Error(
                `Database ${database} is not an instance of D1Database`,
            );
        }
        const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema(
            metadata,
        );
        return new D1Adapter(d1, schema, {
            logging: settings.logging,
        });
    }
}

function isD1Database(db: unknown): db is D1Database {
    return (
        !!db &&
        typeof db === 'object' &&
        (db as D1Database).prepare !== undefined &&
        (db as D1Database).batch !== undefined &&
        (db as D1Database).exec !== undefined
    );
}
