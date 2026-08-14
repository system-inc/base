// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { TimeInterval } from '@system-inc/base-common/time/TimeInterval';
import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../../entity/OrmTrackingEntity';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

// Audit finding 13: SQLite bucketed weeks with '%Y-W%W' (Monday-start,
// zero-based) and MySQL applied a flat +3-day shift that pushed
// Fri/Sat/Sun into the next week — the dialects never agreed with each
// other or with ISO. Both now emit ISO year-week labels.
@OrmTable('iwb_event')
class IwbEvent extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'integer' })
    declare occurredAt: number;
}

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE iwb_event (
            id TEXT PRIMARY KEY,
            occurredAt INTEGER NOT NULL
        );
    `);
    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(IwbEvent),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [IwbEvent],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

const epoch = (iso: string) => Date.UTC(...(iso.split('-').map(Number).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number])) / 1000 + 12 * 3600;

describe('timezone bucketing across DST transitions', () => {
    it('getTimezoneOffsetSegments finds the transition to the minute', async () => {
        const { getTimezoneOffsetSegments } = await import(
            './TimeSeriesTimezone'
        );
        // US spring-forward 2026: March 8, 07:00 UTC (02:00 EST → 03:00 EDT).
        const start = Date.UTC(2026, 2, 1) / 1000;
        const end = Date.UTC(2026, 2, 15) / 1000;
        const segments = getTimezoneOffsetSegments(
            'America/New_York',
            start,
            end,
        );
        expect(segments).toHaveLength(2);
        expect(segments[0]).toMatchObject({ offsetMinutes: 300 });
        expect(segments[1]).toMatchObject({ offsetMinutes: 240 });
        expect(segments[0]!.endEpochSec).toBe(Date.UTC(2026, 2, 8, 7) / 1000);
    });

    it('post-transition rows bucket with their own offset, not the frozen one', async () => {
        // Audit finding 20: the offset was computed once at range start,
        // so 2026-03-10T04:30Z (= Mar 10 00:30 EDT) bucketed as Mar 9
        // under the stale EST offset.
        const { database, dispose } = createSqliteDatabase();
        try {
            const repo = database.getRepository(IwbEvent);
            await repo.insert(
                IwbEvent.from({
                    id: 'pre',
                    occurredAt: Date.UTC(2026, 2, 5, 4, 30) / 1000,
                }),
            );
            await repo.insert(
                IwbEvent.from({
                    id: 'post',
                    occurredAt: Date.UTC(2026, 2, 10, 4, 30) / 1000,
                }),
            );

            const results = await database.timeSeries(IwbEvent, 'occurredAt', {
                startAtUtc: Date.UTC(2026, 2, 1) / 1000,
                endAtUtc: Date.UTC(2026, 2, 15) / 1000,
                interval: TimeInterval.Day,
                timeColIsEpochSec: true,
                timeZone: 'America/New_York',
            });
            const buckets = new Map(
                results.map((row) => [row.bucket, row.total]),
            );
            // Mar 5 04:30Z = Mar 4 23:30 EST → 2026-03-04.
            expect(buckets.get('2026-03-04')).toBe(1);
            // Mar 10 04:30Z = Mar 10 00:30 EDT → 2026-03-10 (frozen EST
            // offset would have said 2026-03-09).
            expect(buckets.get('2026-03-10')).toBe(1);
            expect(buckets.get('2026-03-09')).toBeUndefined();
        } finally {
            dispose();
        }
    });
});

describe('ISO week bucketing (sqlite end-to-end)', () => {
    it('buckets boundary dates into their ISO year-weeks', async () => {
        const { database, dispose } = createSqliteDatabase();
        try {
            const repo = database.getRepository(IwbEvent);
            // Fri 2026-01-09 → 2026-W02; Thu 2026-01-01 → 2026-W01;
            // Fri 2027-01-01 → 2026-W53; Mon 2026-12-28 → 2026-W53;
            // Sun 2026-01-04 → 2026-W01 (the old %W bucketing split
            // Sunday into the following zero-based week).
            const fixtures: Array<[string, string]> = [
                ['2026-01-09', '2026-W02'],
                ['2026-01-01', '2026-W01'],
                ['2027-01-01', '2026-W53'],
                ['2026-12-28', '2026-W53'],
                ['2026-01-04', '2026-W01'],
            ];
            for (const [date] of fixtures) {
                await repo.insert(
                    IwbEvent.from({
                        id: `e-${date}`,
                        occurredAt: epoch(date),
                    }),
                );
            }

            const results = await database.timeSeries(IwbEvent, 'occurredAt', {
                startAtUtc: epoch('2025-12-30'),
                endAtUtc: epoch('2027-01-02') + 1,
                interval: TimeInterval.Week,
                timeColIsEpochSec: true,
            });
            const buckets = new Map(
                results.map((row) => [row.bucket, row.total]),
            );
            expect(buckets.get('2026-W02')).toBe(1);
            expect(buckets.get('2026-W01')).toBe(2);
            expect(buckets.get('2026-W53')).toBe(2);
            // No zero-based or out-of-range labels.
            for (const bucket of buckets.keys()) {
                expect(bucket).not.toMatch(/W00/);
            }
        } finally {
            dispose();
        }
    });
});
