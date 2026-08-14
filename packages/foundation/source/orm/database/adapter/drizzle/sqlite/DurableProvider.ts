// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CloudflareInjections } from '../../../../../cloudflare/CloudflareInjections';
import { BaseConfiguration } from '../../../../../configuration/BaseConfiguration';
import { Inject } from '../../../../../dependency-injection/decorators/Inject';
import { Injectable } from '../../../../../dependency-injection/decorators/Injectable';
import { OrmTableMetadata } from '../../../../metadata/OrmTableMetadata';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmSettingsDurableSQLite } from '../../../../settings/sqlite/OrmSettingsDurableSQLite';
import { OrmAdapter } from '../../OrmAdapter';
import { OrmAdapterProviderDurableSQLite } from '../../provider/interface/sqlite/OrmAdapterProviderDurableSQLite';
import { DurableAdapter } from './DurableAdapter';

@Injectable()
export class DurableProvider implements OrmAdapterProviderDurableSQLite<'drizzle'> {
    readonly databaseType = { dialect: 'sqlite', driver: 'durable' } as const;
    readonly adapterType = 'drizzle';

    constructor(
        @Inject(CloudflareInjections.DurableObjectState)
        private readonly state: DurableObjectState,
        @Inject(BaseConfiguration)
        private readonly config: BaseConfiguration,
    ) {}

    getAdapter(
        database: string,
        settings: OrmSettingsDurableSQLite<'drizzle'>,
        metadata: OrmTableMetadata[],
    ): OrmAdapter {
        const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema(
            metadata,
        );
        return new DurableAdapter(
            this.state,
            schema,
            {
                logging: settings.logging,
            },
            settings.migrations,
            settings.released,
            this.config.runtime.environment.isDevelopment,
        );
    }
}
