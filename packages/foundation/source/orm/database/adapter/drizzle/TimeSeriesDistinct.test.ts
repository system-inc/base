// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Client as PlanetScaleClient } from '@planetscale/database';
import Database from 'better-sqlite3';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { drizzle as drizzleMySql } from 'drizzle-orm/planetscale-serverless';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { TimeInterval } from '@system-inc/base-common/time/TimeInterval';
import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../../entity/OrmTrackingEntity';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleMySql } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleMySql';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { MySqlAdapter } from './mysql/MySqlAdapter';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

@OrmTable('ts_event')
class TsEvent extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'uuid' })
    declare userId: string;

    // Epoch seconds (timeColIsEpochSec) — keeps the test off SQLite's
    // ISO-string parsing.
    @OrmColumn({ kind: 'integer' })
    declare eventTime: number;
}

const DAY1_NOON = Date.UTC(2026, 0, 1, 12) / 1000;
const DAY2_NOON = Date.UTC(2026, 0, 2, 12) / 1000;
const RANGE_START = Date.UTC(2026, 0, 1) / 1000;
const RANGE_END = Date.UTC(2026, 0, 3) / 1000;

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE ts_event (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            eventTime INTEGER NOT NULL
        );
    `);
    // Day 1: users [u1, u1, u2] -> total 3, distinct 2
    // Day 2: users [u3, u3]     -> total 2, distinct 1
    sqlite.exec(`
        INSERT INTO ts_event (id, userId, eventTime) VALUES
            ('1', 'u1', ${DAY1_NOON}),
            ('2', 'u1', ${DAY1_NOON}),
            ('3', 'u2', ${DAY1_NOON}),
            ('4', 'u3', ${DAY2_NOON}),
            ('5', 'u3', ${DAY2_NOON});
    `);

    const metadata = [ormRequireTable(TsEvent)];
    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema(metadata);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [TsEvent],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

describe('Time-series COUNT(DISTINCT) (sqlite end-to-end)', () => {
    let database: OrmDatabaseImpl;
    let dispose: () => void;

    beforeAll(() => {
        ({ database, dispose } = createSqliteDatabase());
    });

    afterAll(() => dispose());

    it('counts all rows per bucket without distinctColumn', async () => {
        const results = await database.timeSeries(TsEvent, 'eventTime', {
            startAtUtc: RANGE_START,
            endAtUtc: RANGE_END,
            interval: TimeInterval.Day,
            timeColIsEpochSec: true,
        });
        const totalByBucket = new Map(
            results.map((row) => [row.bucket, row.total]),
        );
        expect(totalByBucket.get('2026-01-01')).toBe(3);
        expect(totalByBucket.get('2026-01-02')).toBe(2);
    });

    it('counts distinct values per bucket with distinctColumn', async () => {
        const results = await database.timeSeries(TsEvent, 'eventTime', {
            startAtUtc: RANGE_START,
            endAtUtc: RANGE_END,
            interval: TimeInterval.Day,
            timeColIsEpochSec: true,
            distinctColumn: 'userId',
        });
        const distinctByBucket = new Map(
            results.map((row) => [row.bucket, row.total]),
        );
        // Day 1 had 3 rows but only 2 distinct users; Day 2 had 2 rows, 1 user
        expect(distinctByBucket.get('2026-01-01')).toBe(2);
        expect(distinctByBucket.get('2026-01-02')).toBe(1);
    });
});

describe('Time-series COUNT(DISTINCT) (mysql SQL generation)', () => {
    it('emits COUNT(DISTINCT ...) with MySQL date bucketing', async () => {
        const metadata = [ormRequireTable(TsEvent)];
        const schema = new OrmSchemaBuilderDrizzleMySql().createSchema(
            metadata,
        );
        // The client never connects — the query is captured, not executed.
        const db = drizzleMySql({
            client: new PlanetScaleClient({
                host: 'localhost',
                username: 'unused',
                password: 'unused',
            }),
            schema,
        });
        const adapter = new MySqlAdapter(
            { dialect: 'mysql', driver: 'planetscale' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            db as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            schema as any,
            { logging: false },
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let captured: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (adapter as any).execute = (query: any) => {
            captured = query;
            return Promise.resolve([]);
        };

        await adapter.timeSeries('ts_event', 'eventTime', {
            startAtUtc: RANGE_START,
            endAtUtc: RANGE_END,
            interval: TimeInterval.Day,
            timeColIsEpochSec: true,
            distinctColumn: 'userId',
        });

        const { sql: sqlString } = new MySqlDialect().sqlToQuery(captured);
        expect(sqlString).toContain('COUNT(DISTINCT');
        expect(sqlString).toContain('DATE_FORMAT');
        expect(sqlString).toContain('FROM_UNIXTIME');
    });
});
