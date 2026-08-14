// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmSettingsPlanetScale } from '../../../../../settings/mysql/OrmSettingsPlanetScale';
import { OrmAdapterProvider } from '../../../OrmAdapterProvider';
import { OrmAdapterType } from '../../../OrmAdapterType';

export interface OrmAdapterProviderPlanetScale<
    AdapterType extends OrmAdapterType,
> extends OrmAdapterProvider<OrmSettingsPlanetScale<AdapterType>, AdapterType> {
    databaseType: { dialect: 'mysql'; driver: 'planetscale' };
}
