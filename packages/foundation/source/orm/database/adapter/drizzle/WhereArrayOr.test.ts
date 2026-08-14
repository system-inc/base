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
import { equals } from '../../../filters/OrmEqualsFilter';
import { isNull } from '../../../filters/OrmIsNullFilter';
import { notEquals } from '../../../filters/OrmNotEqualsFilter';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

@OrmTable('wao_subscription')
class WaoSubscription extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 128 })
    declare emailAddress: string;

    @OrmColumn({ kind: 'uuid' }, { nullable: true })
    declare ownerProfileId: string | null;

    @OrmColumn({ kind: 'uuid' }, { nullable: true })
    declare ownerAccountId: string | null;

    @OrmColumn({ kind: 'integer' })
    declare createdAtEpoch: number;
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
        CREATE TABLE wao_subscription (
            id TEXT PRIMARY KEY,
            emailAddress TEXT NOT NULL,
            ownerProfileId TEXT,
            ownerAccountId TEXT,
            createdAtEpoch INTEGER NOT NULL
        );
    `);

    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(WaoSubscription),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [WaoSubscription],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

/**
 * An array-valued `where` is OR across its elements, with each element's
 * fields ANDed together (TypeORM semantics, which the find options were
 * modeled on). The regression: the adapter ANDed the branches together, so
 * branches with mutually exclusive predicates (owned-by-ids OR
 * unclaimed-by-email) matched zero rows regardless of data.
 */
describe('where arrays are OR across branches', () => {
    let database: OrmDatabaseImpl;
    let dispose: () => void;

    const PROFILE = 'p1';
    const ACCOUNT = 'a1';
    const EMAIL = 'user@example.com';

    // The two ownership branches from the real-world case: a row claimed by
    // the profile/account ids, a row unclaimed but matching the email, and a
    // row matching neither.
    const ownershipBranches = [
        { ownerProfileId: PROFILE, ownerAccountId: ACCOUNT },
        {
            emailAddress: EMAIL,
            ownerProfileId: isNull(),
            ownerAccountId: isNull(),
        },
    ];

    beforeEach(async () => {
        ({ database, dispose } = createSqliteDatabase());
        await database.insert(WaoSubscription, {
            id: 's1',
            emailAddress: EMAIL,
            ownerProfileId: PROFILE,
            ownerAccountId: ACCOUNT,
            createdAtEpoch: NOON,
        });
        await database.insert(WaoSubscription, {
            id: 's2',
            emailAddress: EMAIL,
            ownerProfileId: null,
            ownerAccountId: null,
            createdAtEpoch: NOON,
        });
        await database.insert(WaoSubscription, {
            id: 's3',
            emailAddress: 'other@example.com',
            ownerProfileId: null,
            ownerAccountId: null,
            createdAtEpoch: NOON,
        });
    });
    afterEach(() => dispose());

    it('find: returns rows matching either branch', async () => {
        const results = await database.find(WaoSubscription, {
            where: ownershipBranches,
        });
        expect(results.map((row) => row.id).sort()).toEqual(['s1', 's2']);
    });

    it('count: counts rows matching either branch', async () => {
        expect(
            await database.count(WaoSubscription, {
                where: ownershipBranches,
            }),
        ).toBe(2);
    });

    it('count: ignores limit/offset — it is the TOTAL for pagination', async () => {
        // Audit finding 8: limit/offset used to apply to the one-row
        // COUNT(*) aggregate, so any offset >= 1 skipped the row and
        // reported 0 from page 2 onward.
        expect(
            await database.count(WaoSubscription, {
                where: ownershipBranches,
                limit: 1,
                offset: 40,
            }),
        ).toBe(2);
    });

    it('findAndCount: items and total both use OR semantics', async () => {
        const [items, total] = await database.findAndCount(WaoSubscription, {
            where: ownershipBranches,
            limit: 1,
        });
        expect(items).toHaveLength(1);
        expect(total).toBe(2);
    });

    it('findOne: matches a row through the second branch alone', async () => {
        const result = await database.findOne(WaoSubscription, {
            where: [
                { ownerProfileId: 'no-such-profile' },
                { id: 's2', emailAddress: EMAIL },
            ],
        });
        expect(result?.id).toBe('s2');
    });

    it('a single-object where still ANDs its fields', async () => {
        expect(
            await database.count(WaoSubscription, {
                where: { emailAddress: EMAIL, ownerProfileId: PROFILE },
            }),
        ).toBe(1);
    });

    it('a single-element array behaves like the plain object', async () => {
        expect(
            await database.count(WaoSubscription, {
                where: [{ emailAddress: EMAIL, ownerProfileId: PROFILE }],
            }),
        ).toBe(1);
    });

    it('equals(null)/notEquals(null) compile to IS [NOT] NULL', async () => {
        // Audit finding 14: these used to emit `= NULL`/`<> NULL`, which
        // match zero rows under SQL three-valued logic — while the
        // "equivalent" bare-null where value worked.
        expect(
            await database.count(WaoSubscription, {
                where: { ownerProfileId: equals(null) },
            }),
        ).toBe(2);
        expect(
            await database.count(WaoSubscription, {
                where: { ownerProfileId: notEquals(null) },
            }),
        ).toBe(1);
    });

    it('timeSeries: the base where is OR across branches', async () => {
        const results = await database.timeSeries(
            WaoSubscription,
            'createdAtEpoch',
            {
                startAtUtc: RANGE_START,
                endAtUtc: RANGE_END,
                interval: TimeInterval.Day,
                timeColIsEpochSec: true,
                where: ownershipBranches,
            },
        );
        const total = results.reduce((sum, bucket) => sum + bucket.total, 0);
        expect(total).toBe(2);
    });
});
