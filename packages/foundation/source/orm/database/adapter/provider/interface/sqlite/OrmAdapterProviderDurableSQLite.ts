// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmSettingsDurableSQLite } from '../../../../../settings/sqlite/OrmSettingsDurableSQLite';
import { OrmAdapterProvider } from '../../../OrmAdapterProvider';
import { OrmAdapterType } from '../../../OrmAdapterType';

export interface OrmAdapterProviderDurableSQLite<
    AdapterType extends OrmAdapterType,
> extends OrmAdapterProvider<
    OrmSettingsDurableSQLite<AdapterType>,
    AdapterType
> {
    databaseType: { dialect: 'sqlite'; driver: 'durable' };
}
