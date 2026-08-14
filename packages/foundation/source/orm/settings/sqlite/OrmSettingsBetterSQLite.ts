// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmAdapterType } from '../../database/adapter/OrmAdapterType';
import { OrmAdapterProviderBetterSQLite } from '../../database/adapter/provider/interface/sqlite/OrmAdapterProviderBetterSQLite';
import { OrmSettingsBase } from '../OrmSettingsBase';

export interface OrmSettingsBetterSQLite<
    AdapterType extends OrmAdapterType,
> extends OrmSettingsBase<AdapterType> {
    databaseType: { dialect: 'sqlite'; driver: 'better-sqlite' };
    adapter: Constructor<OrmAdapterProviderBetterSQLite<AdapterType>>;
    filePath: string;
}
