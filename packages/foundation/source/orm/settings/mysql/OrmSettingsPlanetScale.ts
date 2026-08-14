// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmAdapterType } from '../../database/adapter/OrmAdapterType';
import { OrmAdapterProviderPlanetScale } from '../../database/adapter/provider/interface/mysql/OrmAdapterProviderPlanetScale';
import { OrmCredentials } from '../credentials/OrmCredentials';
import { OrmSettingsBase } from '../OrmSettingsBase';

export interface OrmSettingsPlanetScale<
    AdapterType extends OrmAdapterType,
> extends OrmSettingsBase<AdapterType> {
    databaseType: { dialect: 'mysql'; driver: 'planetscale' };
    adapter: Constructor<OrmAdapterProviderPlanetScale<AdapterType>>;
    credentials?: OrmCredentials;
}
