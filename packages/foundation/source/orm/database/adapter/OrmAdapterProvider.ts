// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmTableMetadata } from '../../metadata/OrmTableMetadata';
import { OrmSettings } from '../../settings/OrmSettings';
import { OrmAdapter } from './OrmAdapter';
import { OrmAdapterType } from './OrmAdapterType';
import { OrmDatabaseType } from './OrmDatabaseType';

export interface OrmAdapterProvider<
    SettingsType extends OrmSettings<AdapterType>,
    AdapterType extends OrmAdapterType = OrmAdapterType,
    Adapter extends OrmAdapter = OrmAdapter,
> {
    readonly databaseType: OrmDatabaseType;
    readonly adapterType: AdapterType;
    getAdapter(
        database: string,
        settings: SettingsType,
        metadata: OrmTableMetadata[],
    ): Promise<Adapter> | Adapter;
}

export function isOrmAdapterProvider(
    provider: unknown,
): provider is OrmAdapterProvider<OrmSettings<OrmAdapterType>> {
    return (
        typeof provider === 'object' &&
        provider !== null &&
        'databaseType' in provider &&
        'adapterType' in provider &&
        'getAdapter' in provider &&
        typeof provider.getAdapter === 'function'
    );
}
