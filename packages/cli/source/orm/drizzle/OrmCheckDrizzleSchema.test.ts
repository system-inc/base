// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { ormCheckDrizzleSchema } from './OrmGetDrizzleBoilerplate';

@OrmTable('ocs_shared')
class OcsShared extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

// Filesystem is never actually read for the cases under test: the no-owned-tables
// branch returns before any fs access, and the owned-but-missing case resolves at
// the existsSync check against this nonexistent path.
const project = {
    workerFolder: '/tmp/ocs-nonexistent-worker',
} as unknown as BaseWorkerProject;

function settingsWithOrm(orm: Record<string, unknown>): BaseSettings {
    return {
        name: 'ocs-test',
        title: 'OrmCheckDrizzleSchema Test',
        version: '1.0.0',
        modules: [],
        orm,
    } as unknown as BaseSettings;
}

const databaseType = { dialect: 'mysql', driver: 'planetscale' } as const;

describe('ormCheckDrizzleSchema — external/inherited handling', () => {
    it('passes a database with no owned tables (all entities external) without requiring schema.generated.ts', () => {
        const result = ormCheckDrizzleSchema(
            project,
            'main',
            settingsWithOrm({
                main: {
                    adapterType: 'drizzle',
                    databaseType,
                    // Used for queries, owned/migrated by another worker.
                    externalEntities: [OcsShared],
                },
            }),
        );

        expect(result.upToDate).toBe(true);
        expect(result.reason).toBe('no-owned-tables');
    });

    it('still reports missing-file for an OWNED database with no generated schema', () => {
        const result = ormCheckDrizzleSchema(
            project,
            'main',
            settingsWithOrm({
                main: {
                    adapterType: 'drizzle',
                    databaseType,
                    entities: [OcsShared],
                },
            }),
        );

        expect(result.upToDate).toBe(false);
        expect(result.reason).toBe('missing-file');
    });
});
