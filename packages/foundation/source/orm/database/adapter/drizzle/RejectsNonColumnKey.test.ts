// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { TimeInterval } from '@system-inc/base-common/time/TimeInterval';
import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmJoinColumn } from '../../../decorators/OrmJoinColumn';
import { OrmManyToOne } from '../../../decorators/OrmManyToOne';
import { OrmPrimaryAutoColumn } from '../../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../../entity/OrmTrackingEntity';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

@OrmTable('rnk_role')
class RnkRole extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 32 })
    declare name: string;
}

@OrmTable('rnk_assignment')
class RnkAssignment extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'uuid' })
    declare roleId: string;

    // Custom db column name — exercises property-key vs db-name resolution.
    @OrmColumn({ kind: 'integer' }, { name: 'event_time' })
    declare eventTime: number;

    // A declared relation: a property of the entity, but NOT a column. This is
    // the key every query/write surface used to silently drop.
    @OrmManyToOne(() => RnkRole, { joinColumn: 'roleId' })
    @OrmJoinColumn({ name: 'roleId', referencedColumnName: 'id' })
    declare role?: RnkRole;
}

const NOON = Date.UTC(2026, 0, 1, 12) / 1000;
const RANGE_START = Date.UTC(2026, 0, 1) / 1000;
const RANGE_END = Date.UTC(2026, 0, 3) / 1000;

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE rnk_role (id TEXT PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE rnk_assignment (
            id TEXT PRIMARY KEY,
            roleId TEXT NOT NULL,
            event_time INTEGER NOT NULL
        );
    `);

    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(RnkRole),
        ormRequireTable(RnkAssignment),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [RnkRole, RnkAssignment],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

describe('query/write surfaces reject non-column keys', () => {
    let database: OrmDatabaseImpl;
    let dispose: () => void;

    beforeEach(() => {
        ({ database, dispose } = createSqliteDatabase());
    });
    afterEach(() => dispose());

    const seed = () =>
        database.insert(RnkAssignment, {
            id: 'a1',
            roleId: 'r1',
            eventTime: NOON,
        });

    // --- where (count/find) -------------------------------------------------

    it('where: filters by columns; throws on a key that is neither column nor relation', async () => {
        await seed();
        expect(
            await database.count(RnkAssignment, { where: { roleId: 'r1' } }),
        ).toBe(1);

        // A relation key (`role`) is now a valid filter (see
        // RelationPredicateFilter.test.ts); a key that is neither a column nor a
        // relation must still fail loud rather than be silently dropped.
        await expect(
            database.count(RnkAssignment, { where: { nope: 'x' } as never }),
        ).rejects.toThrow(/Cannot filter by 'nope'/);
    });

    it('where: an undefined value is a no-op (matches all)', async () => {
        await seed();
        expect(
            await database.count(RnkAssignment, {
                where: { roleId: undefined },
            }),
        ).toBe(1);
    });

    // --- order --------------------------------------------------------------

    it('order: sorts by columns, throws on a relation key', async () => {
        await seed();
        await expect(
            database.find(RnkAssignment, { order: { roleId: 'ASC' } }),
        ).resolves.toHaveLength(1);

        await expect(
            database.find(RnkAssignment, { order: { role: 'ASC' } }),
        ).rejects.toThrow(/Cannot order by 'role'/);
    });

    // --- select -------------------------------------------------------------

    it('select: projects only the listed columns, throws on a relation key', async () => {
        await seed();

        // The projection must actually narrow the row. Drizzle's relational
        // query builder takes `columns` as a `{ [name]: true }` map, so handing
        // it the `select` array verbatim makes it ignore the projection and
        // return every column — silently defeating the caller's reason for
        // asking (skipping large columns to stay inside a memory budget).
        const rows = await database.find(RnkAssignment, { select: ['roleId'] });
        expect(rows).toHaveLength(1);
        expect(rows[0]!.roleId).toBe('r1');
        expect(rows[0]!.id).toBeUndefined();
        expect(rows[0]!.eventTime).toBeUndefined();

        await expect(
            database.find(RnkAssignment, { select: ['role'] }),
        ).rejects.toThrow(/Cannot select 'role'/);
    });

    // --- write (raw values) -------------------------------------------------

    it('insert: writes columns, throws on a relation key in values', async () => {
        await expect(seed()).resolves.toBeDefined();

        const role = RnkRole.from({ id: 'r1', name: 'admin' });
        await expect(
            database.insert(RnkAssignment, {
                id: 'a2',
                roleId: 'r1',
                role,
            }),
        ).rejects.toThrow(/Cannot write 'role'/);
    });

    it('update: refuses empty or all-undefined conditions', async () => {
        // Audit finding 16: these used to silently no-op with a
        // success-shaped result (delete was already guarded).
        await seed();
        await expect(
            database.update(RnkAssignment, {}, { roleId: 'r2' }),
        ).rejects.toThrow(/Refusing to update with empty conditions/);
        await expect(
            database.update(
                RnkAssignment,
                { id: undefined },
                { roleId: 'r2' },
            ),
        ).rejects.toThrow(/Refusing to update/);
        await expect(
            database.increment(RnkAssignment, {}, 'eventTime'),
        ).rejects.toThrow(/Refusing to increment/);
    });

    it('update: throws on a relation key in values', async () => {
        await seed();
        const role = RnkRole.from({ id: 'r1', name: 'admin' });
        await expect(
            database.update(RnkAssignment, { id: 'a1' }, { role }),
        ).rejects.toThrow(/Cannot write 'role'/);
    });

    // --- timeSeries ---------------------------------------------------------

    it('timeSeries: resolves a custom-db-named column by its property key', async () => {
        await seed();
        // `eventTime` maps to db column `event_time`. Before the fix this threw
        // "Column 'event_time' not found" because the property key was wrongly
        // pre-converted to the db name before the adapter's lookup.
        const results = await database.timeSeries(RnkAssignment, 'eventTime', {
            startAtUtc: RANGE_START,
            endAtUtc: RANGE_END,
            interval: TimeInterval.Day,
            timeColIsEpochSec: true,
        });
        expect(results.length).toBeGreaterThan(0);
    });

    it('timeSeries: throws on a relation key', async () => {
        await seed();
        await expect(
            database.timeSeries(RnkAssignment, 'role', {
                startAtUtc: RANGE_START,
                endAtUtc: RANGE_END,
                interval: TimeInterval.Day,
            }),
        ).rejects.toThrow(/Cannot compute a time series on 'role'/);
    });

    // --- upsert (requires a primary key to detect conflicts) ----------------

    it('upsert: works when the primary key is present', async () => {
        await expect(
            database.upsert(
                RnkAssignment,
                { id: 'a2' },
                { roleId: 'r2', eventTime: NOON },
            ),
        ).resolves.toBeDefined();
    });

    it('upsert: throws when the row has no primary key (would silently insert)', async () => {
        await expect(
            database.upsert(
                RnkAssignment,
                { roleId: 'r1' },
                { eventTime: NOON },
            ),
        ).rejects.toThrow(/Cannot upsert .*primary key/);
    });
});
