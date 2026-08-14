// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '../base/BaseSettings';
import { OrmPrimaryAutoColumn } from '../orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../orm/decorators/OrmTable';
import { OrmTrackingEntity } from '../orm/entity/OrmTrackingEntity';
import { BaseAppManifest } from './BaseAppManifest';

@OrmTable('is_a')
class IsA extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

@OrmTable('is_b')
class IsB extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

@OrmTable('is_c')
class IsC extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

// Build a manifest from a minimal settings object with the given ORM config.
function manifestWithOrm(orm: Record<string, unknown>): BaseAppManifest {
    return BaseAppManifest.fromSettings({
        name: 'inherit-schema-test',
        title: 'Inherit Schema Test',
        version: '1.0.0',
        modules: [],
        orm,
    } as unknown as BaseSettings);
}

describe('inheritSchema resolution', () => {
    it('inherits the source’s entities as EXTERNAL, leaving the source unchanged', () => {
        const manifest = manifestWithOrm({
            '@default': { entities: [IsA, IsB] },
            readonly: { inheritSchema: '@default' },
        });

        // The replica owns nothing — inherited tables are external (queryable,
        // not migrated by the replica).
        expect(manifest.getOrmSettings('readonly').entities).toEqual([]);
        expect(manifest.getOrmSettings('readonly').externalEntities).toEqual([
            IsA,
            IsB,
        ]);
        // The source is untouched: still owns its entities, no externals.
        expect(manifest.getOrmSettings('@default').entities).toEqual([
            IsA,
            IsB,
        ]);
        expect(manifest.getOrmSettings('@default').externalEntities).toEqual(
            [],
        );
    });

    it('keeps the inheriting database’s own entities owned, inherited as external', () => {
        const manifest = manifestWithOrm({
            '@default': { entities: [IsA, IsB] },
            // own extras (IsC) plus a duplicate of an inherited entity (IsB)
            extra: { inheritSchema: '@default', entities: [IsC, IsB] },
        });

        // Own declarations stay owned; an inherited entity it also declares
        // (IsB) stays owned (not re-added as external).
        expect(manifest.getOrmSettings('extra').entities).toEqual([IsC, IsB]);
        expect(manifest.getOrmSettings('extra').externalEntities).toEqual([
            IsA,
        ]);
    });

    it('resolves transitively through a chain', () => {
        const manifest = manifestWithOrm({
            base: { entities: [IsA] },
            mid: { inheritSchema: 'base', entities: [IsB] },
            leaf: { inheritSchema: 'mid', entities: [IsC] },
        });

        // Each level owns only its own; everything up the chain is external.
        expect(manifest.getOrmSettings('leaf').entities).toEqual([IsC]);
        expect(manifest.getOrmSettings('leaf').externalEntities).toEqual([
            IsB,
            IsA,
        ]);
        expect(manifest.getOrmSettings('mid').entities).toEqual([IsB]);
        expect(manifest.getOrmSettings('mid').externalEntities).toEqual([IsA]);
    });

    it('throws when inheritSchema targets a database that is not configured', () => {
        expect(() =>
            manifestWithOrm({
                '@default': { entities: [IsA] },
                readonly: { inheritSchema: 'does_not_exist' },
            }),
        ).toThrow(/no ORM database named 'does_not_exist'/);
    });

    it('throws on a self-referential inheritSchema', () => {
        expect(() =>
            manifestWithOrm({ loop: { inheritSchema: 'loop' } }),
        ).toThrow(/Circular inheritSchema/);
    });

    it('throws on a cyclic inheritSchema chain', () => {
        expect(() =>
            manifestWithOrm({
                a: { inheritSchema: 'b' },
                b: { inheritSchema: 'a' },
            }),
        ).toThrow(/Circular inheritSchema/);
    });
});

describe('directly-registered externalEntities', () => {
    it('keeps externalEntities query-only (not owned)', () => {
        const manifest = manifestWithOrm({
            '@default': { entities: [IsA], externalEntities: [IsB] },
        });

        expect(manifest.getOrmSettings('@default').entities).toEqual([IsA]);
        expect(manifest.getOrmSettings('@default').externalEntities).toEqual([
            IsB,
        ]);
    });

    it('coexists with inheritSchema — direct externals plus inherited ones', () => {
        const manifest = manifestWithOrm({
            '@default': { entities: [IsA] },
            replica: {
                inheritSchema: '@default',
                entities: [IsB],
                externalEntities: [IsC],
            },
        });

        // Owned: only the replica's own. External: its direct one (IsC) plus
        // the inherited source entity (IsA).
        expect(manifest.getOrmSettings('replica').entities).toEqual([IsB]);
        expect(manifest.getOrmSettings('replica').externalEntities).toEqual([
            IsC,
            IsA,
        ]);
    });
});
