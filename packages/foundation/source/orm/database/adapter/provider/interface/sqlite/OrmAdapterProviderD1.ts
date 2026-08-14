// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmSettingsD1 } from '../../../../../settings/sqlite/OrmSettingsD1';
import { OrmAdapterProvider } from '../../../OrmAdapterProvider';
import { OrmAdapterType } from '../../../OrmAdapterType';

export interface OrmAdapterProviderD1<
    AdapterType extends OrmAdapterType,
> extends OrmAdapterProvider<OrmSettingsD1<AdapterType>, AdapterType> {
    databaseType: { dialect: 'sqlite'; driver: 'd1' };
}
