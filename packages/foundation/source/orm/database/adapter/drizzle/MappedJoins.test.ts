// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Client as PlanetScaleClient } from '@planetscale/database';
import Database from 'better-sqlite3';
import { drizzle as drizzleMySql } from 'drizzle-orm/planetscale-serverless';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmJoinColumn } from '../../../decorators/OrmJoinColumn';
import { OrmManyToOne } from '../../../decorators/OrmManyToOne';
import { OrmPrimaryAutoColumn } from '../../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../../entity/OrmTrackingEntity';
import { inArray } from '../../../filters/OrmInArrayFilter';
import { parentColumn } from '../../../interfaces/find/OrmMappedJoin';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleMySql } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleMySql';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { MySqlAdapter } from './mysql/MySqlAdapter';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

@OrmTable('mj_role')
class MjRole extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 64 })
    declare type: string;
}

@OrmTable('mj_role_assignment')
class MjRoleAssignment extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'uuid' })
    declare userId: string;

    @OrmColumn({ kind: 'uuid' })
    declare profileId: string;

    @OrmColumn({ kind: 'uuid' })
    declare roleId: string;

    // Custom database column name to exercise name mapping.
    @OrmColumn({ kind: 'varchar', length: 16 }, { name: 'status_code' })
    declare status: string;

    @OrmColumn({ kind: 'boolean' }, { default: false })
    declare temporary: boolean;

    @OrmColumn({ kind: 'datetime', mode: 'date' }, { nullable: true })
    declare expiresAt: Date | null;

    @OrmColumn({ kind: 'json' }, { nullable: true })
    declare meta: { source: string } | null;

    @OrmManyToOne(() => MjRole, { joinColumn: 'roleId' })
    @OrmJoinColumn({ name: 'roleId', referencedColumnName: 'id' })
    declare role?: MjRole;
}

@OrmTable('mj_user')
class MjUser extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 64 })
    declare name: string;

    @OrmColumn({ kind: 'uuid' })
    declare profileId: string;

    // populated by mapped joins in the tests
    accessRoles?: MjRoleAssignment[];
    primaryAssignment?: MjRoleAssignment | null;
}

const entities = [MjRole, MjRoleAssignment, MjUser];

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE mj_role (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL
        );
        CREATE TABLE mj_role_assignment (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            profileId TEXT NOT NULL,
            roleId TEXT NOT NULL,
            status_code TEXT NOT NULL,
            temporary INTEGER NOT NULL DEFAULT 0,
            expiresAt TEXT,
            meta TEXT
        );
        CREATE TABLE mj_user (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            profileId TEXT NOT NULL
        );
    `);

    const metadata = entities.map((entity) => ormRequireTable(entity));
    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema(metadata);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities,
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

describe('Mapped joins (sqlite end-to-end)', () => {
    let database: OrmDatabaseImpl;
    let dispose: () => void;

    let adminRole: MjRole;
    let memberRole: MjRole;
    let user: MjUser;

    const expiry = new Date('2030-01-02T03:04:05.000Z');

    beforeAll(async () => {
        ({ database, dispose } = createSqliteDatabase());

        adminRole = new MjRole();
        adminRole.type = 'Administrator';
        memberRole = new MjRole();
        memberRole.type = 'Member';
        await database.getRepository(MjRole).insert([adminRole, memberRole]);

        user = new MjUser();
        user.name = 'kam';
        user.profileId = crypto.randomUUID();
        const otherUser = new MjUser();
        otherUser.name = 'other';
        otherUser.profileId = crypto.randomUUID();
        await database.getRepository(MjUser).insert([user, otherUser]);

        const active = new MjRoleAssignment();
        active.userId = user.id;
        active.profileId = user.profileId;
        active.roleId = adminRole.id;
        active.status = 'Active';
        active.temporary = true;
        active.expiresAt = expiry;
        active.meta = { source: 'test' };

        const activeMember = new MjRoleAssignment();
        activeMember.userId = user.id;
        activeMember.profileId = user.profileId;
        activeMember.roleId = memberRole.id;
        activeMember.status = 'Active';
        activeMember.temporary = false;
        activeMember.expiresAt = null;
        activeMember.meta = null;

        const revoked = new MjRoleAssignment();
        revoked.userId = user.id;
        revoked.profileId = user.profileId;
        revoked.roleId = adminRole.id;
        revoked.status = 'Revoked';
        revoked.temporary = false;
        revoked.expiresAt = null;
        revoked.meta = null;

        // matches on userId but not profileId — must not load
        const otherProfile = new MjRoleAssignment();
        otherProfile.userId = user.id;
        otherProfile.profileId = crypto.randomUUID();
        otherProfile.roleId = adminRole.id;
        otherProfile.status = 'Active';
        otherProfile.temporary = false;
        otherProfile.expiresAt = null;
        otherProfile.meta = null;

        await database
            .getRepository(MjRoleAssignment)
            .insert([active, activeMember, revoked, otherProfile]);
    });

    afterAll(() => {
        dispose();
    });

    it('loads a composite-predicate filtered join with a nested relation in one query', async () => {
        const found = await database.getRepository(MjUser).findOne({
            where: { id: user.id },
            joins: [
                {
                    property: 'accessRoles',
                    entity: MjRoleAssignment,
                    type: 'many',
                    where: {
                        userId: parentColumn('id'),
                        profileId: parentColumn('profileId'),
                        status: 'Active',
                    },
                    relations: { role: true },
                },
            ],
        });

        expect(found).not.toBeNull();
        const roles = found!.accessRoles!;
        expect(roles).toHaveLength(2);
        expect(roles[0]).toBeInstanceOf(MjRoleAssignment);

        const adminAssignment = roles.find(
            (assignment) => assignment.role?.type === 'Administrator',
        );
        expect(adminAssignment).toBeDefined();
        expect(adminAssignment!.role).toBeInstanceOf(MjRole);

        // JSON-native values coerced back to column types
        expect(adminAssignment!.temporary).toBe(true);
        expect(adminAssignment!.expiresAt).toBeInstanceOf(Date);
        expect(adminAssignment!.expiresAt!.getTime()).toBe(expiry.getTime());
        expect(adminAssignment!.meta).toEqual({ source: 'test' });

        // custom database column name mapped back to the property
        expect(adminAssignment!.status).toBe('Active');

        // hydrated entities are not born dirty
        expect(Object.keys(adminAssignment!.getChangedFields())).toHaveLength(
            0,
        );
    });

    it('returns an empty array for a many join with no matches', async () => {
        const found = await database.getRepository(MjUser).findOne({
            where: { name: 'other' },
            joins: [
                {
                    property: 'accessRoles',
                    entity: MjRoleAssignment,
                    type: 'many',
                    where: {
                        userId: parentColumn('id'),
                        profileId: parentColumn('profileId'),
                    },
                },
            ],
        });

        expect(found).not.toBeNull();
        expect(found!.accessRoles).toEqual([]);
    });

    it('maps a one join to an entity or null', async () => {
        const joins = [
            {
                property: 'primaryAssignment',
                entity: MjRoleAssignment,
                type: 'one' as const,
                where: {
                    userId: parentColumn('id'),
                    profileId: parentColumn('profileId'),
                    roleId: memberRole.id,
                },
            },
        ];

        const found = await database.getRepository(MjUser).findOne({
            where: { id: user.id },
            joins,
        });
        expect(found!.primaryAssignment).toBeInstanceOf(MjRoleAssignment);
        expect(found!.primaryAssignment!.roleId).toBe(memberRole.id);

        const other = await database.getRepository(MjUser).findOne({
            where: { name: 'other' },
            joins,
        });
        expect(other!.primaryAssignment).toBeNull();
    });

    it('supports scalar filters inside the join where', async () => {
        const found = await database.getRepository(MjUser).findOne({
            where: { id: user.id },
            joins: [
                {
                    property: 'accessRoles',
                    entity: MjRoleAssignment,
                    type: 'many',
                    where: {
                        userId: parentColumn('id'),
                        profileId: parentColumn('profileId'),
                        status: inArray(['Active', 'Revoked']),
                    },
                },
            ],
        });

        expect(found!.accessRoles).toHaveLength(3);
    });

    it('runs raw execute statements atomically inside a write batch', async () => {
        const repository = database.getRepository(MjRole);
        const role = new MjRole();
        role.type = 'BatchExecuteTest';
        await repository.insert(role);

        const { sql } = await import('drizzle-orm');
        await database.writeBatch((batch) => {
            batch.execute(
                sql`UPDATE mj_role SET type = 'BatchExecuteUpdated' WHERE id = ${role.id}`,
            );
        });

        const updated = await repository.findOne({ where: { id: role.id } });
        expect(updated?.type).toBe('BatchExecuteUpdated');
    });

    it('hydrates joins for every row of a find', async () => {
        const found = await database.getRepository(MjUser).find({
            where: {},
            joins: [
                {
                    property: 'accessRoles',
                    entity: MjRoleAssignment,
                    type: 'many',
                    where: {
                        userId: parentColumn('id'),
                        profileId: parentColumn('profileId'),
                        status: 'Active',
                    },
                },
            ],
        });

        expect(found).toHaveLength(2);
        const byName = new Map(found.map((item) => [item.name, item]));
        expect(byName.get('kam')!.accessRoles).toHaveLength(2);
        expect(byName.get('other')!.accessRoles).toEqual([]);
    });
});

describe('Mapped joins (mysql SQL generation)', () => {
    it('compiles joins into correlated json_arrayagg subqueries in one statement', () => {
        const metadata = entities.map((entity) => ormRequireTable(entity));
        const schema = new OrmSchemaBuilderDrizzleMySql().createSchema(
            metadata,
        );
        // The client is never used — the test only compiles SQL via
        // toSQL() — but the driver requires a Client instance.
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

        const userMetadata = ormRequireTable(MjUser);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const queryOptions = (adapter as any).buildQueryOptions(userMetadata, {
            where: { id: 'abc' },
            joins: [
                {
                    property: 'accessRoles',
                    entity: MjRoleAssignment,
                    type: 'many',
                    where: {
                        userId: parentColumn('id'),
                        profileId: parentColumn('profileId'),
                        status: 'Active',
                    },
                    relations: { role: true },
                },
            ],
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = (db as any).query.mj_user.findMany(queryOptions);
        const { sql: statement, params } = query.toSQL();

        // one statement, correlated through the parent's columns
        expect(statement).toContain('json_arrayagg');
        expect(statement).toContain('`mj_role_assignment` AS __mj0');
        expect(statement).toMatch(/__mj0\.`userId` = .*`mj_user`.*`id`/);
        expect(statement).toContain('__mj0.`profileId`');
        // custom column name used in SQL, property key used as JSON key
        expect(statement).toContain("'status', __mj0.`status_code`");
        // the nested declared relation rides along as a subquery
        expect(statement).toContain('`mj_role` AS __mj1');
        expect(statement).toMatch(/__mj1\.`id` = __mj0\.`roleId`/);
        // constants are bound parameters, not inlined
        expect(params).toContain('Active');
        expect(statement).not.toContain("'Active'");
    });
});
