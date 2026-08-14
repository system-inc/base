// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '../decorators/OrmColumn';
import { OrmCreateDateColumn } from '../decorators/OrmCreateDateColumn';
import { OrmPrimaryAutoColumn } from '../decorators/OrmPrimaryAutoColumn';
import { OrmPrimaryKey } from '../decorators/OrmPrimaryKey';
import { OrmTable } from '../decorators/OrmTable';
import { OrmBaseEntity } from '../entity/OrmBaseEntity';
import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { ormGetTable } from './OrmSchemaRegistry';

// A table has exactly one primary key, declared exactly once. Multiple
// `primaryKey: true` columns must never silently merge into a composite —
// column order defines the backing index, so the framework cannot guess it.
describe('Primary key declaration conflicts', () => {
    it('throws when two columns are both marked primaryKey', () => {
        expect(() => {
            @OrmTable('pk_conflict_two_flags')
            class _TwoFlags {
                @OrmColumn(
                    { kind: 'varchar', length: 36 },
                    { primaryKey: true },
                )
                declare aId: string;

                @OrmColumn(
                    { kind: 'varchar', length: 36 },
                    { primaryKey: true },
                )
                declare bId: string;
            }
        }).toThrow(/exactly one primary key.*@OrmPrimaryKey/s);
    });

    it('throws when @OrmPrimaryKey is combined with a primaryKey column option', () => {
        expect(() => {
            @OrmTable('pk_conflict_mixed_styles')
            @OrmPrimaryKey(['aId', 'bId'])
            class _MixedStyles {
                @OrmColumn(
                    { kind: 'varchar', length: 36 },
                    { primaryKey: true },
                )
                declare aId: string;

                @OrmColumn({ kind: 'varchar', length: 36 })
                declare bId: string;
            }
        }).toThrow(/conflicts with the primary key already declared/);
    });

    it('throws when @OrmPrimaryKey is declared twice', () => {
        expect(() => {
            @OrmTable('pk_conflict_double_composite')
            @OrmPrimaryKey(['aId'])
            @OrmPrimaryKey(['bId'])
            class _DoubleComposite {
                @OrmColumn({ kind: 'varchar', length: 36 })
                declare aId: string;

                @OrmColumn({ kind: 'varchar', length: 36 })
                declare bId: string;
            }
        }).toThrow(/conflicts with the primary key already declared/);
    });

    it('throws when @OrmPrimaryAutoColumn is combined with a primaryKey column option', () => {
        expect(() => {
            @OrmTable('pk_conflict_auto_plus_flag')
            class _AutoPlusFlag {
                @OrmPrimaryAutoColumn('uuid')
                declare id: string;

                @OrmColumn(
                    { kind: 'varchar', length: 36 },
                    { primaryKey: true },
                )
                declare otherId: string;
            }
        }).toThrow(/exactly one primary key/);
    });

    it('throws when @OrmPrimaryAutoColumn is declared twice', () => {
        expect(() => {
            @OrmTable('pk_conflict_double_auto')
            class _DoubleAuto {
                @OrmPrimaryAutoColumn('uuid')
                declare id: string;

                @OrmPrimaryAutoColumn('serial')
                declare sequence: number;
            }
        }).toThrow(/exactly one primary key/);
    });

    it('throws when a date column is marked primaryKey next to an existing key', () => {
        expect(() => {
            @OrmTable('pk_conflict_date_column')
            class _DateColumnFlag {
                @OrmPrimaryAutoColumn('uuid')
                declare id: string;

                @OrmCreateDateColumn({ primaryKey: true })
                declare createdAt: Date;
            }
        }).toThrow(/exactly one primary key/);
    });

    it('throws at merge when a subclass key conflicts with an inherited key', () => {
        @OrmTable('pk_conflict_inherited')
        @OrmPrimaryKey(['aId', 'bId'])
        class ConflictsWithInherited extends OrmBaseEntity {
            @OrmColumn({ kind: 'varchar', length: 36 })
            declare aId: string;

            @OrmColumn({ kind: 'varchar', length: 36 })
            declare bId: string;
        }

        expect(() => ormGetTable(ConflictsWithInherited)).toThrow(
            /inherits a conflicting primary key.*OrmBaseEntity/s,
        );
    });

    it('allows a subclass to widen an inherited key into a composite containing it', () => {
        @OrmTable('pk_widened_inherited')
        @OrmPrimaryKey(['id', 'tenantId'])
        class WidensInherited extends OrmBaseEntity {
            @OrmColumn({ kind: 'varchar', length: 36 })
            declare tenantId: string;
        }

        const metadata = ormGetTable(WidensInherited);
        expect(metadata?.primaryKey).toEqual({
            type: 'composite',
            columns: ['id', 'tenantId'],
            name: undefined,
        });
    });

    it('allows a single primaryKey column option', () => {
        @OrmTable('pk_single_flag')
        class SingleFlag extends OrmTrackingEntity {
            @OrmColumn({ kind: 'varchar', length: 36 }, { primaryKey: true })
            declare id: string;

            @OrmColumn({ kind: 'varchar', length: 255 })
            declare name: string;
        }

        expect(ormGetTable(SingleFlag)?.primaryKey).toEqual({
            type: 'single',
            column: 'id',
        });
    });

    it('allows a composite key declared once with @OrmPrimaryKey', () => {
        @OrmTable('pk_composite_once')
        @OrmPrimaryKey(['aId', 'bId'])
        class CompositeOnce extends OrmTrackingEntity {
            @OrmColumn({ kind: 'varchar', length: 36 })
            declare aId: string;

            @OrmColumn({ kind: 'varchar', length: 36 })
            declare bId: string;
        }

        expect(ormGetTable(CompositeOnce)?.primaryKey).toEqual({
            type: 'composite',
            columns: ['aId', 'bId'],
            name: undefined,
        });
    });

    it('allows a plain OrmBaseEntity subclass to inherit its key', () => {
        @OrmTable('pk_inherited_only')
        class InheritsKey extends OrmBaseEntity {
            @OrmColumn({ kind: 'varchar', length: 255 })
            declare name: string;
        }

        expect(ormGetTable(InheritsKey)?.primaryKey).toEqual({
            type: 'auto-uuid',
            column: 'id',
        });
    });
});
