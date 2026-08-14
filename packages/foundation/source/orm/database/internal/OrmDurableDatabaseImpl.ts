// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmSettings } from '../../settings/OrmSettings';
import { OrmAdapterType } from '../adapter/OrmAdapterType';
import { OrmDurableAdapter } from '../adapter/OrmDurableAdapter';
import { OrmDurableDatabase } from '../OrmDurableDatabase';
import { OrmDatabaseImpl } from './OrmDatabaseImpl';

export class OrmDurableDatabaseImpl<
    SettingsType extends OrmSettings<OrmAdapterType> =
        OrmSettings<OrmAdapterType>,
>
    extends OrmDatabaseImpl<SettingsType, OrmDurableAdapter>
    implements OrmDurableDatabase
{
    async migrate(): Promise<void> {
        const adapter = await this.getAdapter();
        return adapter.migrate();
    }
}
