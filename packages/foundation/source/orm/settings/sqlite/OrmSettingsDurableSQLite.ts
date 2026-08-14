// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { DrizzleMigrationConfig } from '../../database/adapter/drizzle/types/DrizzleMigrationConfig';
import { OrmAdapterType } from '../../database/adapter/OrmAdapterType';
import { OrmAdapterProviderDurableSQLite } from '../../database/adapter/provider/interface/sqlite/OrmAdapterProviderDurableSQLite';
import { OrmSettingsBase } from '../OrmSettingsBase';

export interface OrmSettingsDurableSQLiteBase<
    AdapterType extends OrmAdapterType,
> extends OrmSettingsBase<AdapterType> {
    databaseType: { dialect: 'sqlite'; driver: 'durable' };
    adapter: Constructor<OrmAdapterProviderDurableSQLite<AdapterType>>;
}

export interface OrmSettingsDurableSQLiteDrizzle extends OrmSettingsDurableSQLiteBase<'drizzle'> {
    /**
     * Drizzle migration bundle (the default export of drizzle-kit's
     * generated `migrations.js`). Required for durable DOs because
     * the DO runs migrations against its own SQLite at boot — there's
     * no external migration runner.
     */
    migrations: DrizzleMigrationConfig;

    /**
     * Tag list from `release.ts`. The runtime migration runner refuses
     * to run any migration whose tag isn't in this list on non-Development
     * environments — defense in depth in case `base deploy`'s pre-flight
     * check was somehow bypassed.
     */
    released: string[];
}

interface DurableSQLiteSettingsByAdapter {
    drizzle: OrmSettingsDurableSQLiteDrizzle;
}

export type OrmSettingsDurableSQLite<AdapterType extends OrmAdapterType> =
    AdapterType extends keyof DurableSQLiteSettingsByAdapter
        ? DurableSQLiteSettingsByAdapter[AdapterType]
        : never;
