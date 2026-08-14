// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmAdapterType } from '../../database/adapter/OrmAdapterType';
import { OrmAdapterProviderD1 } from '../../database/adapter/provider/interface/sqlite/OrmAdapterProviderD1';
import { OrmSettingsBase } from '../OrmSettingsBase';

export interface OrmSettingsD1<
    AdapterType extends OrmAdapterType,
> extends OrmSettingsBase<AdapterType> {
    databaseType: { dialect: 'sqlite'; driver: 'd1' };
    adapter: Constructor<OrmAdapterProviderD1<AdapterType>>;
    binding: string;
}
