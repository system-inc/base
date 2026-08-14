// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmAdapterType } from '../database/adapter/OrmAdapterType';
import { OrmSettingsPlanetScale } from './mysql/OrmSettingsPlanetScale';
import { OrmSettingsBetterSQLite } from './sqlite/OrmSettingsBetterSQLite';
import { OrmSettingsD1 } from './sqlite/OrmSettingsD1';
import { OrmSettingsDurableSQLite } from './sqlite/OrmSettingsDurableSQLite';

export type OrmSettings<AdapterType extends OrmAdapterType> =
    | OrmSettingsD1<AdapterType>
    | OrmSettingsDurableSQLite<AdapterType>
    | OrmSettingsPlanetScale<AdapterType>
    | OrmSettingsBetterSQLite<AdapterType>;

// TypeScript narrows on shallow discriminants but not nested ones — checking
// `settings.databaseType.driver === 'd1'` narrows `databaseType`, not
// `settings` itself. These guards do the structural narrowing for callers
// that need access to variant-specific fields (binding, credentials, etc.).

export function isOrmSettingsD1<A extends OrmAdapterType>(
    settings: OrmSettings<A>,
): settings is OrmSettingsD1<A> {
    return settings.databaseType.driver === 'd1';
}

export function isOrmSettingsDurableSQLite<A extends OrmAdapterType>(
    settings: OrmSettings<A>,
): settings is OrmSettingsDurableSQLite<A> {
    return settings.databaseType.driver === 'durable';
}

export function isOrmSettingsBetterSQLite<A extends OrmAdapterType>(
    settings: OrmSettings<A>,
): settings is OrmSettingsBetterSQLite<A> {
    return settings.databaseType.driver === 'better-sqlite';
}

export function isOrmSettingsPlanetScale<A extends OrmAdapterType>(
    settings: OrmSettings<A>,
): settings is OrmSettingsPlanetScale<A> {
    return settings.databaseType.driver === 'planetscale';
}
