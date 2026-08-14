// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmSettingsBetterSQLite } from '../../../../../settings/sqlite/OrmSettingsBetterSQLite';
import { OrmAdapterProvider } from '../../../OrmAdapterProvider';
import { OrmAdapterType } from '../../../OrmAdapterType';

export interface OrmAdapterProviderBetterSQLite<
    AdapterType extends OrmAdapterType,
> extends OrmAdapterProvider<
    OrmSettingsBetterSQLite<AdapterType>,
    AdapterType
> {
    databaseType: { dialect: 'sqlite'; driver: 'better-sqlite' };
}
