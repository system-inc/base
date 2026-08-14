// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../entity/OrmTrackingEntity';
import { ormRequireTable } from '../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { BetterSQLiteAdapter } from '../adapter/drizzle/sqlite/BetterSQLiteAdapter';
import { OrmDatabaseImpl } from '../internal/OrmDatabaseImpl';

// Audit finding 4: insert used to persist only DIRTY fields, so a
// clone()d or hydrated (clean) entity inserted rows with NULL data.
@OrmTable('ipsv_note')
class IpsvNote extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 64 }, { nullable: true })
    declare name: string | null;
}

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE ipsv_note (
            id TEXT PRIMARY KEY,
            name TEXT
        );
    `);

    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(IpsvNote),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [IpsvNote],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

describe('insert persists all set values, not just dirty fields', () => {
    let database: OrmDatabaseImpl;
    let dispose: () => void;

    beforeEach(() => {
        ({ database, dispose } = createSqliteDatabase());
    });
    afterEach(() => dispose());

    it('a clone()d clean entity inserts its full data', async () => {
        const repo = database.getRepository(IpsvNote);
        const original = IpsvNote.from({ id: 'n1', name: 'hello' });
        await repo.insert(original);

        // The duplicate-a-row idiom: clone (clean dirty set), retarget the
        // id, insert. Only `id` is dirty — `name` must still persist.
        const loaded = await repo.findOne({ where: { id: 'n1' } });
        const copy = loaded!.clone();
        copy.id = 'n2';
        await repo.insert(copy);

        const row = await repo.findOne({ where: { id: 'n2' } });
        expect(row?.name).toBe('hello');
    });

    it('a clone()d entity upserts its full data', async () => {
        const repo = database.getRepository(IpsvNote);
        await repo.insert(IpsvNote.from({ id: 'n1', name: 'hello' }));

        const loaded = await repo.findOne({ where: { id: 'n1' } });
        const copy = loaded!.clone();
        copy.id = 'n3';
        await repo.upsert(copy);

        const row = await repo.findOne({ where: { id: 'n3' } });
        expect(row?.name).toBe('hello');
    });

    it('updating a no-change entity is a no-op, not an error', async () => {
        // Audit finding 22: an empty SET used to hit drizzle's "No values
        // to set" throw — a load-maybe-modify-save flow failed whenever
        // nothing changed (for entities without an update-date column).
        const repo = database.getRepository(IpsvNote);
        await repo.insert(IpsvNote.from({ id: 'n1', name: 'hello' }));
        const loaded = await repo.findOne({ where: { id: 'n1' } });

        await expect(repo.update(loaded!)).resolves.toBeDefined();

        // One clean entity must not abort an atomic batch either.
        const cleanAgain = await repo.findOne({ where: { id: 'n1' } });
        await expect(
            database.writeBatch((batch) => {
                batch.update(cleanAgain!);
            }),
        ).resolves.toBeDefined();
    });

    it('batch insert of a clean clone persists its full data', async () => {
        const repo = database.getRepository(IpsvNote);
        await repo.insert(IpsvNote.from({ id: 'n1', name: 'hello' }));
        const loaded = await repo.findOne({ where: { id: 'n1' } });
        const copy = loaded!.clone();
        copy.id = 'n4';

        await database.writeBatch((batch) => {
            batch.insert(copy);
        });

        const row = await repo.findOne({ where: { id: 'n4' } });
        expect(row?.name).toBe('hello');
    });
});
