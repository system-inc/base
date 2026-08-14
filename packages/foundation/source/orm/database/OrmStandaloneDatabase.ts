// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Client as PlanetScaleClient } from '@planetscale/database';
import { drizzle } from 'drizzle-orm/planetscale-serverless';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { OrmConfiguration } from '../../configuration/BaseConfiguration';
import { OrmEntityClass } from '../entity/OrmEntityClass';
import { ormGetTable } from '../metadata/OrmSchemaRegistry';
import { OrmTableMetadata } from '../metadata/OrmTableMetadata';
import { OrmSchemaBuilderDrizzleMySql } from '../schema/drizzle/OrmSchemaBuilderDrizzleMySql';
import { MySqlAdapter } from './adapter/drizzle/mysql/MySqlAdapter';
import { PlanetScaleProvider } from './adapter/drizzle/mysql/PlanetScaleProvider';
import { OrmDatabaseImpl } from './internal/OrmDatabaseImpl';
import { OrmDatabase } from './OrmDatabase';

/**
 * Creates an {@link OrmDatabase} for a PlanetScale database outside of a
 * worker's dependency-injection container. Intended for tooling that
 * talks to the database directly with an explicit entity list — most
 * notably integration-test helpers (see
 * `test/IntegrationTestClient.getOrmDatabase`). Workers should always
 * resolve their databases through DI (`@InjectDatabase`) instead.
 */
export function ormCreatePlanetScaleDatabase(options: {
    url: string;
    entities: OrmEntityClass[];
    databaseName?: string;
    logging?: boolean;
}): OrmDatabase {
    const metadata: OrmTableMetadata[] = options.entities.map((entity) => {
        const tableMetadata = ormGetTable(entity);
        if (!tableMetadata) {
            throw new Error(
                `Entity ${entity.name} is not registered as an @OrmTable.`,
            );
        }
        return tableMetadata;
    });

    const databaseType = { dialect: 'mysql', driver: 'planetscale' } as const;
    const schema = new OrmSchemaBuilderDrizzleMySql().createSchema(metadata);
    const db = drizzle({
        client: new PlanetScaleClient({ url: options.url }),
        schema,
        logger: options.logging,
    });
    const adapter = new MySqlAdapter(databaseType, db, schema, {
        logging: options.logging,
    });

    const configuration: OrmConfiguration = {
        databaseName: options.databaseName ?? DefaultConfigurationKey,
        entities: options.entities,
        externalEntities: [],
        databaseType,
        adapterType: 'drizzle',
        adapter: PlanetScaleProvider,
        credentials: { type: 'url', url: options.url },
    };

    return new OrmDatabaseImpl(configuration, adapter);
}
