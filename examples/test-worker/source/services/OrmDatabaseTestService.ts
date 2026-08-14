// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { sql } from 'drizzle-orm';

import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { OrmDatabase } from '@system-inc/base-foundation/orm/database/OrmDatabase';
import { DatabaseBinding } from '@system-inc/base-foundation/orm/DatabaseBinding';
import { InjectDatabase } from '@system-inc/base-foundation/orm/decorators/InjectDatabase';
import { equals } from '@system-inc/base-foundation/orm/filters/OrmEqualsFilter';
import { gte } from '@system-inc/base-foundation/orm/filters/OrmGteFilter';
import { gt } from '@system-inc/base-foundation/orm/filters/OrmGtFilter';
import { inArray } from '@system-inc/base-foundation/orm/filters/OrmInArrayFilter';
import { like } from '@system-inc/base-foundation/orm/filters/OrmLikeFilter';
import { lt } from '@system-inc/base-foundation/orm/filters/OrmLtFilter';
import { notEquals } from '@system-inc/base-foundation/orm/filters/OrmNotEqualsFilter';
import { OrmBatchResult } from '@system-inc/base-foundation/orm/interfaces/result/OrmBatchResult';
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';
import { OrmPostEntity } from '../entities/OrmPostEntity';
import { OrmProductEntity } from '../entities/OrmProductEntity';
import { OrmTestEntity } from '../entities/OrmTestEntity';
import { OrmUserEntity } from '../entities/OrmUserEntity';

const D1_DATABASE = new DatabaseBinding('d1');

@Injectable()
@HttpService()
export class OrmDatabaseTestService {
    constructor(
        @InjectDatabase()
        private readonly defaultDb: OrmDatabase,
        @InjectDatabase(D1_DATABASE)
        private readonly d1Db: OrmDatabase,
    ) {
        console.log('OrmDatabaseTestService.constructor');
    }

    /** Resolves the data context for the requested database. */
    private getDatabase(db: string): OrmDatabase {
        return db === 'd1' ? this.d1Db : this.defaultDb;
    }

    // Setup test data
    @HttpRoute('GET', '/test/orm/database/:db/setup')
    async setupTestData(@HttpPath('db') db: string): Promise<Response> {
        // Clear existing test data
        await this.getDatabase(db).truncate(OrmTestEntity, {
            confirm: true,
        });

        // Insert test entities - need to provide IDs for direct database inserts
        const testData = [
            {
                id: crypto.randomUUID(),
                name: 'Alice',
                age: 25,
                email: 'alice@test.com',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'Bob',
                age: 30,
                email: 'bob@test.com',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'Charlie',
                age: 35,
                email: 'charlie@test.com',
                status: 'inactive',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'David',
                age: 40,
                email: 'david@test.com',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'Eve',
                age: 45,
                email: 'eve@test.com',
                status: 'inactive',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'Frank',
                age: 30,
                email: 'frank@test.com',
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'Grace',
                age: 35,
                email: 'grace@test.com',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'Henry',
                age: 50,
                email: 'henry@test.com',
                status: 'inactive',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'Ivy',
                age: 28,
                email: 'ivy@test.com',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'Jack',
                age: 33,
                email: 'jack@test.com',
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        const result = await this.getDatabase(db).insertBatch(
            OrmTestEntity,
            testData,
        );

        return Response.json({
            message: 'Test data created',
            count: testData.length,
            result,
        });
    }

    /**
     * Exercises `executeRows`: a raw SELECT resolves to a plain row array
     * on every dialect, while `execute` exposes the driver shape (MySQL
     * `{ rows }`, SQLite the array itself) — the contrast this endpoint
     * reports is exactly what `executeRows` exists to hide. Seeds its own
     * marker row so it is independent of suite ordering.
     */
    @HttpRoute('GET', '/test/orm/database/:db/execute-rows')
    async testExecuteRows(@HttpPath('db') db: string): Promise<Response> {
        const database = this.getDatabase(db);
        const marker = `execute-rows-${crypto.randomUUID()}`;
        await database.insertBatch(OrmTestEntity, [
            {
                id: crypto.randomUUID(),
                name: marker,
                age: 42,
                email: `${marker}@test.com`,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);

        const rows = await database.executeRows<{
            name: string;
            age: number;
        }>(sql`SELECT name, age FROM orm_test_entity WHERE name = ${marker}`);
        const rawResult = await database.execute(
            sql`SELECT name FROM orm_test_entity WHERE name = ${marker}`,
        );

        return Response.json({
            rowsIsArray: Array.isArray(rows),
            rows: rows,
            rawIsArray: Array.isArray(rawResult),
        });
    }

    // Test new update method with OrmFindOptionsWhere
    @HttpRoute('GET', '/test/orm/database/:db/update-where')
    async testUpdateWhere(@HttpPath('db') db: string): Promise<Response> {
        // Update all entities with age > 35 to have status 'senior'
        const updateResult = await this.getDatabase(db).update(
            OrmTestEntity,
            { age: gt(35) },
            { status: 'senior' },
        );

        // Verify the update
        const updatedEntities = await this.getDatabase(db).find(OrmTestEntity, {
            where: { status: 'senior' },
            order: { name: 'ASC' },
        });

        return Response.json({
            updateResult,
            updatedCount: updatedEntities.length,
            updatedEntities: updatedEntities.map((e) => ({
                name: e.name,
                age: e.age,
                status: e.status,
            })),
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/update-complex')
    async testUpdateComplex(@HttpPath('db') db: string): Promise<Response> {
        // Complex update: Update entities with multiple conditions
        const updateResult = await this.getDatabase(db).update(
            OrmTestEntity,
            {
                age: gte(30),
                status: equals('active'),
            },
            { status: 'veteran' },
        );

        // Verify the update
        const updatedEntities = await this.getDatabase(db).find(OrmTestEntity, {
            where: { status: 'veteran' },
            order: { name: 'ASC' },
        });

        return Response.json({
            updateResult,
            updatedCount: updatedEntities.length,
            updatedEntities: updatedEntities.map((e) => ({
                name: e.name,
                age: e.age,
                status: e.status,
            })),
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/update-like')
    async testUpdateLike(@HttpPath('db') db: string): Promise<Response> {
        // Update entities with names starting with 'J'
        const updateResult = await this.getDatabase(db).update(
            OrmTestEntity,
            { name: like('J%') },
            { status: 'j-team' },
        );

        // Verify the update
        const updatedEntities = await this.getDatabase(db).find(OrmTestEntity, {
            where: { status: 'j-team' },
            order: { name: 'ASC' },
        });

        return Response.json({
            updateResult,
            updatedCount: updatedEntities.length,
            updatedEntities: updatedEntities.map((e) => ({
                name: e.name,
                status: e.status,
            })),
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/update-in-array')
    async testUpdateInArray(@HttpPath('db') db: string): Promise<Response> {
        // Update entities with specific ages
        const updateResult = await this.getDatabase(db).update(
            OrmTestEntity,
            { age: inArray([25, 30, 35]) },
            { status: 'selected-age' },
        );

        // Verify the update
        const updatedEntities = await this.getDatabase(db).find(OrmTestEntity, {
            where: { status: 'selected-age' },
            order: { age: 'ASC' },
        });

        return Response.json({
            updateResult,
            updatedCount: updatedEntities.length,
            updatedEntities: updatedEntities.map((e) => ({
                name: e.name,
                age: e.age,
                status: e.status,
            })),
        });
    }

    // Test updateBatch with specific entities
    @HttpRoute('GET', '/test/orm/database/:db/update-batch')
    async testUpdateBatch(@HttpPath('db') db: string): Promise<Response> {
        // First get some specific entities
        const entities = await this.getDatabase(db).find(OrmTestEntity, {
            limit: 3,
        });

        if (entities.length === 0) {
            return Response.json(
                { error: 'No entities found' },
                { status: 404 },
            );
        }

        // Update specific entities by their IDs
        const updateResult = await this.getDatabase(db).updateBatch(
            OrmTestEntity,
            entities.map((e, index) => ({
                conditions: { id: e.id },
                values: {
                    status: `batch-updated-${index}`,
                    age: e.age + 100,
                },
            })),
        );

        // Verify the updates
        const updatedEntities = await this.getDatabase(db).find(OrmTestEntity, {
            where: { id: inArray(entities.map((e) => e.id)) },
            order: { name: 'ASC' },
        });

        return Response.json({
            updateResult,
            updatedCount: updatedEntities.length,
            updatedEntities: updatedEntities.map((e) => ({
                id: e.id,
                name: e.name,
                age: e.age,
                status: e.status,
            })),
        });
    }

    // Test delete with complex conditions
    @HttpRoute('GET', '/test/orm/database/:db/delete-where')
    async testDeleteWhere(@HttpPath('db') db: string): Promise<Response> {
        // Count before delete
        const countBefore = await this.getDatabase(db).count(OrmTestEntity);

        // Delete entities with age < 30
        const deleteResult = await this.getDatabase(db).delete(OrmTestEntity, {
            age: lt(30),
        });

        // Count after delete
        const countAfter = await this.getDatabase(db).count(OrmTestEntity);

        return Response.json({
            countBefore,
            countAfter,
            deleteResult,
            deletedCount: countBefore - countAfter,
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/delete-complex')
    async testDeleteComplex(@HttpPath('db') db: string): Promise<Response> {
        // Delete with multiple conditions
        const countBefore = await this.getDatabase(db).count(OrmTestEntity);

        const deleteResult = await this.getDatabase(db).delete(OrmTestEntity, {
            age: gte(40),
            status: notEquals('senior'),
        });

        const countAfter = await this.getDatabase(db).count(OrmTestEntity);

        return Response.json({
            countBefore,
            countAfter,
            deleteResult,
            deletedCount: countBefore - countAfter,
        });
    }

    // Test deleteBatch with specific entities
    @HttpRoute('GET', '/test/orm/database/:db/delete-batch')
    async testDeleteBatch(@HttpPath('db') db: string): Promise<Response> {
        // Get some entities to delete
        const entitiesToDelete = await this.getDatabase(db).find(
            OrmTestEntity,
            {
                where: { status: like('%updated%') },
                limit: 5,
            },
        );

        if (entitiesToDelete.length === 0) {
            return Response.json({
                message: 'No entities with updated status to delete',
                deletedCount: 0,
            });
        }

        // Delete specific entities by ID
        const deleteResult = await this.getDatabase(db).deleteBatch(
            OrmTestEntity,
            entitiesToDelete.map((e) => ({ id: e.id })),
        );

        return Response.json({
            deleteResult,
            deletedCount: entitiesToDelete.length,
            deletedIds: entitiesToDelete.map((e) => e.id),
        });
    }

    // Test upsert with complex conditions
    @HttpRoute('GET', '/test/orm/database/:db/upsert-where')
    async testUpsertWhere(@HttpPath('db') db: string): Promise<Response> {
        // Try to upsert based on a complex condition
        // For upsert operations, we need to provide ALL required fields in values
        // since if no match is found, these values will be used for insert
        const upsertResult = await this.getDatabase(db).upsert(
            OrmTestEntity,
            {
                name: 'UniqueTest',
                email: 'unique@test.com',
            },
            {
                id: crypto.randomUUID(),
                name: 'UniqueTest',
                email: 'unique@test.com',
                age: 99,
                status: 'upserted',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        );

        // Verify the upsert
        const entity = await this.getDatabase(db).findOne(OrmTestEntity, {
            where: { name: 'UniqueTest' },
        });

        return Response.json({
            upsertResult,
            entity,
        });
    }

    // Test upsertBatch
    @HttpRoute('GET', '/test/orm/database/:db/upsert-batch')
    async testUpsertBatch(@HttpPath('db') db: string): Promise<Response> {
        // Get Alice's existing record to get her ID and createdAt
        const alice = await this.getDatabase(db).findOne(OrmTestEntity, {
            where: { name: 'Alice' },
        });

        // Prepare upsert data - some may exist, some may not
        // For ALL entities in an upsert, we need to provide IDs and createdAt
        // because MySQL's INSERT ... ON DUPLICATE KEY UPDATE requires valid values
        // for all required fields, even when updating existing records
        const upsertData = [
            {
                // For existing record, use the existing ID and createdAt in conditions
                conditions: alice
                    ? {
                          id: alice.id,
                          name: 'Alice',
                          email: 'alice@test.com',
                          createdAt: alice.createdAt,
                          updatedAt: alice.updatedAt,
                      }
                    : { name: 'Alice', email: 'alice@test.com' },
                values: alice
                    ? { age: 26, status: 'upsert-batch-1' }
                    : {
                          id: crypto.randomUUID(),
                          age: 26,
                          status: 'upsert-batch-1',
                          createdAt: new Date(),
                          updatedAt: new Date(),
                      },
            },
            {
                conditions: { name: 'NewUser1', email: 'new1@test.com' },
                values: {
                    id: crypto.randomUUID(),
                    age: 60,
                    status: 'upsert-batch-new',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
            {
                conditions: { name: 'NewUser2', email: 'new2@test.com' },
                values: {
                    id: crypto.randomUUID(),
                    age: 65,
                    status: 'upsert-batch-new',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        ];

        const upsertResult = await this.getDatabase(db).upsertBatch(
            OrmTestEntity,
            upsertData,
        );

        // Verify the upserts
        const entities = await this.getDatabase(db).find(OrmTestEntity, {
            where: { status: like('upsert-batch%') },
            order: { name: 'ASC' },
        });

        return Response.json({
            upsertResult,
            upsertedCount: entities.length,
            entities: entities.map((e) => ({
                name: e.name,
                email: e.email,
                age: e.age,
                status: e.status,
            })),
        });
    }

    // Test transaction with new API
    @HttpRoute('GET', '/test/orm/database/:db/transaction')
    async testTransaction(@HttpPath('db') db: string): Promise<Response> {
        const result = await this.getDatabase(db).transaction(async (tx) => {
            // Update multiple groups in a transaction
            const update1 = await tx.update(
                OrmTestEntity,
                { status: 'active' },
                { status: 'tx-active' },
            );

            const update2 = await tx.update(
                OrmTestEntity,
                { status: 'inactive' },
                { status: 'tx-inactive' },
            );

            // Insert new entity - need to provide ID for direct database insert
            const insert = await tx.insert(OrmTestEntity, {
                id: crypto.randomUUID(),
                name: 'TransactionTest',
                age: 77,
                email: 'tx@test.com',
                status: 'tx-new',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Delete some entities
            const deleteOp = await tx.delete(OrmTestEntity, {
                status: 'pending',
            });

            return {
                update1,
                update2,
                insert,
                deleteOp,
            };
        });

        // Verify transaction results
        const finalCounts = {
            txActive: await this.getDatabase(db).count(OrmTestEntity, {
                where: { status: 'tx-active' },
            }),
            txInactive: await this.getDatabase(db).count(OrmTestEntity, {
                where: { status: 'tx-inactive' },
            }),
            txNew: await this.getDatabase(db).count(OrmTestEntity, {
                where: { status: 'tx-new' },
            }),
            pending: await this.getDatabase(db).count(OrmTestEntity, {
                where: { status: 'pending' },
            }),
        };

        return Response.json({
            transactionResult: result,
            finalCounts,
        });
    }

    // Test with related entities
    @HttpRoute('GET', '/test/orm/database/:db/update-related-setup')
    async setupRelatedData(@HttpPath('db') db: string): Promise<Response> {
        // Clear existing data
        await this.getDatabase(db).truncate(OrmPostEntity, {
            confirm: true,
        });
        await this.getDatabase(db).truncate(OrmUserEntity, {
            confirm: true,
        });

        // Create users - need to provide IDs for direct database inserts
        const userResult = await this.getDatabase(db).insertBatch(
            OrmUserEntity,
            [
                {
                    id: crypto.randomUUID(),
                    username: 'user1',
                    email: 'user1@test.com',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: crypto.randomUUID(),
                    username: 'user2',
                    email: 'user2@test.com',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: crypto.randomUUID(),
                    username: 'user3',
                    email: 'user3@test.com',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ],
        );

        // Get created users - order by username to ensure consistent ordering
        const users = await this.getDatabase(db).find(OrmUserEntity, {
            order: { username: 'ASC' },
        });

        // Find user1 specifically
        const user1 = users.find((u) => u.username === 'user1');
        const user2 = users.find((u) => u.username === 'user2');
        const user3 = users.find((u) => u.username === 'user3');

        if (!user1 || !user2 || !user3) {
            return Response.json(
                { error: 'Failed to create users' },
                { status: 500 },
            );
        }

        // Create posts - need to provide IDs for direct database inserts
        const postResult = await this.getDatabase(db).insertBatch(
            OrmPostEntity,
            [
                {
                    id: crypto.randomUUID(),
                    title: 'Post 1',
                    content: 'Content 1',
                    authorId: user1.id,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: crypto.randomUUID(),
                    title: 'Post 2',
                    content: 'Content 2 - Draft',
                    authorId: user1.id,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: crypto.randomUUID(),
                    title: 'Post 3',
                    content: 'Content 3',
                    authorId: user2.id,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: crypto.randomUUID(),
                    title: 'Post 4',
                    content: 'Content 4',
                    authorId: user2.id,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                {
                    id: crypto.randomUUID(),
                    title: 'Post 5',
                    content: 'Content 5 - Draft',
                    authorId: user3.id,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ],
        );

        return Response.json({
            usersCreated: userResult.affectedRows,
            postsCreated: postResult.affectedRows,
            users: users.map((u) => ({ id: u.id, username: u.username })),
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/update-related')
    async testUpdateRelated(@HttpPath('db') db: string): Promise<Response> {
        // Get a user
        const user = await this.getDatabase(db).findOne(OrmUserEntity, {
            where: { username: 'user1' },
        });

        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        // Update all posts by this user with 'Draft' in content
        const updateResult = await this.getDatabase(db).update(
            OrmPostEntity,
            {
                authorId: user.id,
                content: like('%Draft%'),
            },
            { content: 'Updated content' },
        );

        // Verify the update - only get the posts that were updated
        const updatedPosts = await this.getDatabase(db).find(OrmPostEntity, {
            where: {
                authorId: user.id,
                content: 'Updated content',
            },
            order: { title: 'ASC' },
        });

        return Response.json({
            userId: user.id,
            updateResult,
            updatedPosts: updatedPosts.map((p) => ({
                title: p.title,
                content: p.content,
            })),
        });
    }

    // Test edge cases
    @HttpRoute('GET', '/test/orm/database/:db/update-no-match')
    async testUpdateNoMatch(@HttpPath('db') db: string): Promise<Response> {
        // Try to update with conditions that don't match any entities
        const updateResult = await this.getDatabase(db).update(
            OrmTestEntity,
            {
                age: gt(1000),
                status: 'non-existent',
            },
            { status: 'should-not-update' },
        );

        return Response.json({
            updateResult,
            message: 'Update with no matching conditions',
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/delete-no-match')
    async testDeleteNoMatch(@HttpPath('db') db: string): Promise<Response> {
        // Try to delete with conditions that don't match any entities
        const deleteResult = await this.getDatabase(db).delete(OrmTestEntity, {
            age: lt(0),
            name: 'NonExistentName',
        });

        return Response.json({
            deleteResult,
            message: 'Delete with no matching conditions',
        });
    }

    // Performance test
    @HttpRoute('GET', '/test/orm/database/:db/performance-batch-vs-where')
    async testPerformanceBatchVsWhere(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Setup: Create test products
        await this.getDatabase(db).truncate(OrmProductEntity, {
            confirm: true,
        });

        const products = [];
        for (let i = 0; i < 100; i++) {
            products.push({
                id: crypto.randomUUID(),
                name: `Product ${i}`,
                sku: `SKU-PERF-${i}`,
                price: Math.random() * 1000,
                stockQuantity: Math.floor(Math.random() * 100),
                status:
                    i % 3 === 0 ? 'active' : i % 3 === 1 ? 'draft' : 'archived',
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }
        await this.getDatabase(db).insertBatch(OrmProductEntity, products);

        // Test 1: Update using where conditions (single operation)
        const whereStart = Date.now();
        const whereResult = await this.getDatabase(db).update(
            OrmProductEntity,
            { status: 'active' },
            { stockQuantity: 999 },
        );
        const whereTime = Date.now() - whereStart;

        // Reset data
        await this.getDatabase(db).update(
            OrmProductEntity,
            { stockQuantity: 999 },
            { stockQuantity: 50 },
        );

        // Test 2: Update using batch (multiple specific updates)
        const activeProducts = await this.getDatabase(db).find(
            OrmProductEntity,
            {
                where: { status: 'active' },
            },
        );

        const batchStart = Date.now();
        const batchResult = await this.getDatabase(db).updateBatch(
            OrmProductEntity,
            activeProducts.map((p) => ({
                conditions: { id: p.id },
                values: { stockQuantity: 999 },
            })),
        );
        const batchTime = Date.now() - batchStart;

        return Response.json({
            whereUpdate: {
                time: whereTime,
                affectedRows: whereResult.affectedRows,
            },
            batchUpdate: {
                time: batchTime,
                affectedRows: batchResult.affectedRows,
            },
            analysis: {
                faster: whereTime < batchTime ? 'where' : 'batch',
                timeDifference: Math.abs(whereTime - batchTime),
                recommendation:
                    'Use "update" for bulk updates with same values, "updateBatch" for specific individual updates',
            },
        });
    }

    // Cleanup
    @HttpRoute('GET', '/test/orm/database/:db/cleanup')
    async cleanup(@HttpPath('db') db: string): Promise<Response> {
        const testDeleted = await this.getDatabase(db).truncate(OrmTestEntity, {
            confirm: true,
        });
        const postDeleted = await this.getDatabase(db).truncate(OrmPostEntity, {
            confirm: true,
        });
        const userDeleted = await this.getDatabase(db).truncate(OrmUserEntity, {
            confirm: true,
        });
        const productDeleted = await this.getDatabase(db).truncate(
            OrmProductEntity,
            { confirm: true },
        );

        return Response.json({
            message: 'All test data cleaned up',
            deleted: {
                test: testDeleted.affectedRows,
                posts: postDeleted.affectedRows,
                users: userDeleted.affectedRows,
                products: productDeleted.affectedRows,
            },
        });
    }

    // Test increment and decrement operations
    @HttpRoute('GET', '/test/orm/database/:db/increment-decrement')
    async testIncrementDecrement(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Setup: Clear and create test data
        await this.getDatabase(db).truncate(OrmTestEntity, {
            confirm: true,
        });

        const testEntity = {
            id: crypto.randomUUID(),
            name: 'IncrementTest',
            age: 10,
            email: 'increment@test.com',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await this.getDatabase(db).insert(OrmTestEntity, testEntity);

        // Test 1: Basic increment
        const incrementResult1 = await this.getDatabase(db).increment(
            OrmTestEntity,
            { id: testEntity.id },
            'age',
            5,
        );

        const afterIncrement1 = await this.getDatabase(db).findOne(
            OrmTestEntity,
            {
                where: { id: testEntity.id },
            },
        );

        // Test 2: Increment without value (should default to 1)
        const incrementResult2 = await this.getDatabase(db).increment(
            OrmTestEntity,
            { id: testEntity.id },
            'age',
        );

        const afterIncrement2 = await this.getDatabase(db).findOne(
            OrmTestEntity,
            {
                where: { id: testEntity.id },
            },
        );

        // Test 3: Basic decrement
        const decrementResult1 = await this.getDatabase(db).decrement(
            OrmTestEntity,
            { id: testEntity.id },
            'age',
            3,
        );

        const afterDecrement1 = await this.getDatabase(db).findOne(
            OrmTestEntity,
            {
                where: { id: testEntity.id },
            },
        );

        // Test 4: Decrement without value (should default to 1)
        const decrementResult2 = await this.getDatabase(db).decrement(
            OrmTestEntity,
            { id: testEntity.id },
            'age',
        );

        const afterDecrement2 = await this.getDatabase(db).findOne(
            OrmTestEntity,
            {
                where: { id: testEntity.id },
            },
        );

        // Test 5: Increment/Decrement with complex conditions
        await this.getDatabase(db).insertBatch(OrmTestEntity, [
            {
                id: crypto.randomUUID(),
                name: 'MultiTest1',
                age: 20,
                email: 'multi1@test.com',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'MultiTest2',
                age: 20,
                email: 'multi2@test.com',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: crypto.randomUUID(),
                name: 'MultiTest3',
                age: 30,
                email: 'multi3@test.com',
                status: 'inactive',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);

        // Increment all active entities with age 20
        const multiIncrementResult = await this.getDatabase(db).increment(
            OrmTestEntity,
            { age: 20, status: 'active' },
            'age',
            10,
        );

        const multiAfterIncrement = await this.getDatabase(db).find(
            OrmTestEntity,
            {
                where: { name: like('MultiTest%') },
                order: { name: 'ASC' },
            },
        );

        // Test 6: Increment with no matching conditions
        const noMatchResult = await this.getDatabase(db).increment(
            OrmTestEntity,
            { id: 'non-existent-id' },
            'age',
            100,
        );

        return Response.json({
            increment1: {
                result: incrementResult1,
                before: testEntity.age,
                after: afterIncrement1?.age,
                expected: 15,
            },
            increment2: {
                result: incrementResult2,
                before: 15,
                after: afterIncrement2?.age,
                expected: 16,
            },
            decrement1: {
                result: decrementResult1,
                before: 16,
                after: afterDecrement1?.age,
                expected: 13,
            },
            decrement2: {
                result: decrementResult2,
                before: 13,
                after: afterDecrement2?.age,
                expected: 12,
            },
            multiIncrement: {
                result: multiIncrementResult,
                affectedRows: multiIncrementResult.affectedRows,
                expectedAffectedRows: 2,
                entities: multiAfterIncrement.map((e) => ({
                    name: e.name,
                    age: e.age,
                    status: e.status,
                })),
            },
            noMatch: {
                result: noMatchResult,
                affectedRows: noMatchResult.affectedRows,
                expectedAffectedRows: 0,
            },
        });
    }

    // Test repository increment/decrement
    @HttpRoute('GET', '/test/orm/database/:db/repository-increment-decrement')
    async testRepositoryIncrementDecrement(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Setup: Clear and create test data
        await this.getDatabase(db).truncate(OrmTestEntity, {
            confirm: true,
        });

        const testEntity = {
            id: crypto.randomUUID(),
            name: 'RepoIncrementTest',
            age: 50,
            email: 'repo@test.com',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await this.getDatabase(db).insert(OrmTestEntity, testEntity);

        // Get repository
        const repository = this.getDatabase(db).getRepository(OrmTestEntity);

        // Test increment via repository
        const incrementResult = await repository.increment(
            { id: testEntity.id },
            'age',
            25,
        );

        const afterIncrement = await repository.findOne({
            where: { id: testEntity.id },
        });

        // Test decrement via repository
        const decrementResult = await repository.decrement(
            { id: testEntity.id },
            'age',
            15,
        );

        const afterDecrement = await repository.findOne({
            where: { id: testEntity.id },
        });

        // Test with filter conditions
        const filterIncrementResult = await repository.increment(
            { status: 'active', age: gte(60) },
            'age',
            5,
        );

        const afterFilterIncrement = await repository.findOne({
            where: { id: testEntity.id },
        });

        return Response.json({
            increment: {
                result: incrementResult,
                before: 50,
                after: afterIncrement?.age,
                expected: 75,
            },
            decrement: {
                result: decrementResult,
                before: 75,
                after: afterDecrement?.age,
                expected: 60,
            },
            filterIncrement: {
                result: filterIncrementResult,
                before: 60,
                after: afterFilterIncrement?.age,
                expected: 65,
            },
        });
    }

    // WriteBatch tests — multi-entity scenarios

    @HttpRoute('GET', '/test/orm/database/:db/write-batch/setup')
    async setupWriteBatchData(@HttpPath('db') db: string): Promise<Response> {
        await this.getDatabase(db).truncate(OrmPostEntity, {
            confirm: true,
        });
        await this.getDatabase(db).truncate(OrmUserEntity, {
            confirm: true,
        });
        return Response.json({ ok: true });
    }

    @HttpRoute('GET', '/test/orm/database/:db/write-batch/multi-entity')
    async testWriteBatchMultiEntity(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const user = OrmUserEntity.from({
            id: crypto.randomUUID(),
            username: 'wb_user_multi',
            email: 'wb_user_multi@test.com',
        });
        const post = OrmPostEntity.from({
            id: crypto.randomUUID(),
            title: 'WB Multi Entity Post',
            content: 'content',
            authorId: user.id,
        });

        const result = await this.getDatabase(db).writeBatch((batch) => {
            batch.insert(user);
            batch.insert(post);
        });

        const persistedUser = await this.getDatabase(db).findOne(
            OrmUserEntity,
            {
                where: { id: user.id },
            },
        );
        const persistedPost = await this.getDatabase(db).findOne(
            OrmPostEntity,
            {
                where: { id: post.id },
            },
        );

        return Response.json({
            result,
            persistedUser,
            persistedPost,
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/write-batch/mixed-array')
    async testWriteBatchMixedArray(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Pass mixed entity types in a single `insert([...])` call. The
        // dispatcher should split them into per-type ops while preserving
        // call order (user, post, user — three ops in that order).
        const user1 = OrmUserEntity.from({
            id: crypto.randomUUID(),
            username: 'wb_mixed_user1',
            email: 'wb_mixed_user1@test.com',
        });
        const post1 = OrmPostEntity.from({
            id: crypto.randomUUID(),
            title: 'WB Mixed Post',
            content: 'content',
            authorId: user1.id,
        });
        const user2 = OrmUserEntity.from({
            id: crypto.randomUUID(),
            username: 'wb_mixed_user2',
            email: 'wb_mixed_user2@test.com',
        });

        const result = await this.getDatabase(db).writeBatch((batch) => {
            batch.insert([user1, post1, user2]);
        });

        const userCount = await this.getDatabase(db).count(OrmUserEntity, {
            where: { username: like('wb_mixed_user%') },
        });
        const postCount = await this.getDatabase(db).count(OrmPostEntity, {
            where: { title: 'WB Mixed Post' },
        });

        return Response.json({
            result,
            userCount,
            postCount,
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/write-batch/call-order')
    async testWriteBatchCallOrder(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Verify that interleaved calls across entity types preserve the
        // call order. The post references the user, so if the post were
        // submitted before the user, the FK reference (authorId) would
        // point at a not-yet-inserted row. In the wrapping-transaction
        // path that's a logical error at most (no FK enforced here), but
        // we still verify the persistence shows both rows landed.
        const user = OrmUserEntity.from({
            id: crypto.randomUUID(),
            username: 'wb_order_user',
            email: 'wb_order_user@test.com',
        });
        const post = OrmPostEntity.from({
            id: crypto.randomUUID(),
            title: 'WB Order Post',
            content: 'content',
            authorId: user.id,
        });

        const result = await this.getDatabase(db).writeBatch((batch) => {
            batch.insert(user);
            batch.insert(post);
        });

        const persistedUser = await this.getDatabase(db).findOne(
            OrmUserEntity,
            {
                where: { id: user.id },
            },
        );
        const persistedPost = await this.getDatabase(db).findOne(
            OrmPostEntity,
            {
                where: { id: post.id },
            },
        );

        return Response.json({
            result,
            userFirst: persistedUser?.id === user.id,
            postRefMatches: persistedPost?.authorId === user.id,
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/write-batch/multi-method')
    async testWriteBatchMultiMethod(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Seed a user + post via writeBatch, then run another writeBatch
        // that updates the user and deletes the post atomically.
        const user = OrmUserEntity.from({
            id: crypto.randomUUID(),
            username: 'wb_multimethod',
            email: 'wb_multimethod@test.com',
        });
        const post = OrmPostEntity.from({
            id: crypto.randomUUID(),
            title: 'WB MultiMethod Post',
            content: 'content',
            authorId: user.id,
        });

        await this.getDatabase(db).writeBatch((batch) => {
            batch.insert(user);
            batch.insert(post);
        });

        // Reload through repositories to get tracked entity instances
        const userRepo = this.getDatabase(db).getRepository(OrmUserEntity);
        const postRepo = this.getDatabase(db).getRepository(OrmPostEntity);
        const reloadedUser = await userRepo.findOne({
            where: { id: user.id },
        });
        const reloadedPost = await postRepo.findOne({
            where: { id: post.id },
        });
        if (!reloadedUser || !reloadedPost) {
            return Response.json({ error: 'Setup failed' }, { status: 500 });
        }
        reloadedUser.username = 'wb_multimethod_renamed';

        const result = await this.getDatabase(db).writeBatch((batch) => {
            batch.update(reloadedUser);
            batch.delete(reloadedPost);
        });

        const finalUser = await this.getDatabase(db).findOne(OrmUserEntity, {
            where: { id: user.id },
        });
        const finalPost = await this.getDatabase(db).findOne(OrmPostEntity, {
            where: { id: post.id },
        });

        return Response.json({
            result,
            userRenamed: finalUser?.username === 'wb_multimethod_renamed',
            postDeleted: finalPost === null,
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/write-batch/atomicity-multi')
    async testWriteBatchAtomicityMulti(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Insert a user, then attempt to insert a post with a PK collision.
        // Whole batch should roll back: the user must NOT persist.
        const seedPostId = crypto.randomUUID();
        await this.getDatabase(db).insert(OrmPostEntity, {
            id: seedPostId,
            title: 'WB Atomicity Seed',
            content: 'seed',
            authorId: crypto.randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const newUser = OrmUserEntity.from({
            id: crypto.randomUUID(),
            username: 'wb_atomicity_user',
            email: 'wb_atomicity_user@test.com',
        });
        const collidingPost = OrmPostEntity.from({
            id: seedPostId, // PK collision — will fail
            title: 'WB Atomicity Collide',
            content: 'collide',
            authorId: newUser.id,
        });

        let errorMessage: string | undefined;
        try {
            await this.getDatabase(db).writeBatch((batch) => {
                batch.insert(newUser);
                batch.insert(collidingPost);
            });
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : String(e);
        }

        const persistedUser = await this.getDatabase(db).findOne(
            OrmUserEntity,
            {
                where: { id: newUser.id },
            },
        );

        return Response.json({
            errorMessage,
            persistedUser,
            atomic: errorMessage !== undefined && persistedUser === null,
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/write-batch/interleaved-order')
    async testWriteBatchInterleavedOrder(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Stresses run-length grouping in the dispatcher: insert a post,
        // delete it, then re-insert at the same id within one batch. A naive
        // groupBy-by-entity-type would collapse the two inserts together and
        // PK-collide; run-length preserves order so each op runs on its own.
        const userId = crypto.randomUUID();
        const postId = crypto.randomUUID();

        const user = OrmUserEntity.from({
            id: userId,
            username: 'wb_interleaved_user',
            email: 'wb_interleaved_user@test.com',
        });
        const postV1 = OrmPostEntity.from({
            id: postId,
            title: 'WB Interleaved v1',
            content: 'v1',
            authorId: userId,
        });
        const postV2 = OrmPostEntity.from({
            id: postId, // intentional reuse — must succeed because of preceding delete
            title: 'WB Interleaved v2',
            content: 'v2',
            authorId: userId,
        });

        let errorMessage: string | undefined;
        try {
            await this.getDatabase(db).writeBatch((batch) => {
                batch.insert(user);
                batch.insert(postV1);
                batch.delete(postV1);
                batch.insert(postV2);
            });
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : String(e);
        }

        const persistedPost = await this.getDatabase(db).findOne(
            OrmPostEntity,
            {
                where: { id: postId },
            },
        );

        return Response.json({
            errorMessage,
            finalContent: persistedPost?.content,
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/write-batch/raw-execute')
    async testWriteBatchRawExecute(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // A raw parameterized statement batched alongside entity ops — the
        // shape modules use for counter updates (postCount = postCount + 1).
        // Regression guard: drizzle's D1 session batch dies on any
        // parameterized `db.run(sql...)` ("Cannot read properties of
        // undefined (reading 'bind')"); the D1Adapter works around it.
        const updatedUsername = 'wb_raw_execute_updated';
        const user = OrmUserEntity.from({
            id: crypto.randomUUID(),
            username: 'wb_raw_execute',
            email: 'wb_raw_execute@test.com',
        });

        let errorMessage: string | undefined;
        let result: OrmBatchResult | undefined;
        try {
            result = await this.getDatabase(db).writeBatch((batch) => {
                batch.insert(user);
                batch.execute(
                    sql`UPDATE orm_user_entity SET username = ${updatedUsername} WHERE id = ${user.id}`,
                );
            });
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : String(e);
        }

        const persistedUser = await this.getDatabase(db).findOne(
            OrmUserEntity,
            {
                where: { id: user.id },
            },
        );

        return Response.json({
            errorMessage,
            result,
            rawApplied: persistedUser?.username === updatedUsername,
        });
    }

    @HttpRoute('GET', '/test/orm/database/:db/write-batch/cleanup')
    async cleanupWriteBatchData(@HttpPath('db') db: string): Promise<Response> {
        await this.getDatabase(db).truncate(OrmPostEntity, {
            confirm: true,
        });
        await this.getDatabase(db).truncate(OrmUserEntity, {
            confirm: true,
        });
        return Response.json({ ok: true });
    }
}
