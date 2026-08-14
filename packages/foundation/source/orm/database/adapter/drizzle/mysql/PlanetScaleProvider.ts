// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Client as PlanetScaleClient } from '@planetscale/database';
import { drizzle } from 'drizzle-orm/planetscale-serverless';

import { BaseConfiguration } from '../../../../../configuration/BaseConfiguration';
import { Inject } from '../../../../../dependency-injection/decorators/Inject';
import { Injectable } from '../../../../../dependency-injection/decorators/Injectable';
import { OrmTableMetadata } from '../../../../metadata/OrmTableMetadata';
import { OrmSchemaBuilderDrizzleMySql } from '../../../../schema/drizzle/OrmSchemaBuilderDrizzleMySql';
import { ormGetEnvironmentCredentials } from '../../../../settings/credentials/OrmCredentialHelper';
import { OrmSettingsPlanetScale } from '../../../../settings/mysql/OrmSettingsPlanetScale';
import { OrmAdapter } from '../../OrmAdapter';
import { OrmAdapterProviderPlanetScale } from '../../provider/interface/mysql/OrmAdapterProviderPlanetScale';
import { MySqlAdapter } from './MySqlAdapter';

@Injectable()
export class PlanetScaleProvider implements OrmAdapterProviderPlanetScale<'drizzle'> {
    readonly databaseType = {
        dialect: 'mysql',
        driver: 'planetscale',
    } as const;
    readonly adapterType = 'drizzle';

    constructor(
        @Inject(BaseConfiguration) private readonly config: BaseConfiguration,
    ) {}

    getAdapter(
        database: string,
        settings: OrmSettingsPlanetScale<'drizzle'>,
        metadata: OrmTableMetadata[],
    ): OrmAdapter {
        const credentials = ormGetEnvironmentCredentials(
            database,
            this.config,
            settings,
        );

        const pscaleConfig: PlanetScaleClient['config'] =
            credentials.type === 'url'
                ? { url: credentials.url }
                : {
                      host: credentials.host,
                      username: credentials.username,
                      password: credentials.password,
                  };

        const schema = new OrmSchemaBuilderDrizzleMySql().createSchema(
            metadata,
        );

        const db = drizzle({
            client: new PlanetScaleClient(pscaleConfig),
            schema,
            logger: settings.logging,
        });

        return new MySqlAdapter(this.databaseType, db, schema, {
            logging: settings.logging,
        });
    }
}
