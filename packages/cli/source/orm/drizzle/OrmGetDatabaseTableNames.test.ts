// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { ormGetDatabaseTableNames } from './OrmGetDatabaseTableNames';

@OrmTable('tn_alpha')
class TnAlpha extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

// A custom @OrmTable name (not the class name) must be the one reported.
@OrmTable('tn_custom_beta')
class TnBeta extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 32 })
    declare label: string;
}

@OrmTable('tn_gamma')
class TnGamma extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

function settingsWithOrm(orm: Record<string, unknown>): BaseSettings {
    return {
        name: 'table-names-test',
        title: 'Table Names Test',
        version: '1.0.0',
        modules: [],
        orm,
    } as unknown as BaseSettings;
}

describe('ormGetDatabaseTableNames', () => {
    it('returns the @OrmTable names for a database, using custom names', () => {
        const settings = settingsWithOrm({
            '@default': { entities: [TnAlpha, TnBeta] },
        });

        expect(ormGetDatabaseTableNames(settings, '@default')).toEqual([
            'tn_alpha',
            'tn_custom_beta',
        ]);
    });

    it('excludes inherited (external) tables — only the replica’s OWN tables are owned', () => {
        const settings = settingsWithOrm({
            '@default': { entities: [TnAlpha, TnBeta] },
            readonly: { inheritSchema: '@default', entities: [TnGamma] },
        });

        // Inherited tables are external (owned/migrated by '@default'), so a
        // schema:sync of 'readonly' must not scope to them — only its own.
        expect(ormGetDatabaseTableNames(settings, 'readonly')).toEqual([
            'tn_gamma',
        ]);
    });

    it('returns an empty list for a database with no entities', () => {
        const settings = settingsWithOrm({
            '@default': { entities: [] },
        });

        expect(ormGetDatabaseTableNames(settings, '@default')).toEqual([]);
    });
});
