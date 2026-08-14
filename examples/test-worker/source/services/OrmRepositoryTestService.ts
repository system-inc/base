// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { OrmDatabase } from '@system-inc/base-foundation/orm/database/OrmDatabase';
import { OrmRepository } from '@system-inc/base-foundation/orm/database/repository/OrmRepository';
import { DatabaseBinding } from '@system-inc/base-foundation/orm/DatabaseBinding';
import { InjectDatabase } from '@system-inc/base-foundation/orm/decorators/InjectDatabase';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';
import { between } from '@system-inc/base-foundation/orm/filters/OrmBetweenFilter';
import { equals } from '@system-inc/base-foundation/orm/filters/OrmEqualsFilter';
import { gte } from '@system-inc/base-foundation/orm/filters/OrmGteFilter';
import { gt } from '@system-inc/base-foundation/orm/filters/OrmGtFilter';
import { inArray } from '@system-inc/base-foundation/orm/filters/OrmInArrayFilter';
import { isNotNull } from '@system-inc/base-foundation/orm/filters/OrmIsNotNullFilter';
import { isNull } from '@system-inc/base-foundation/orm/filters/OrmIsNullFilter';
import { like } from '@system-inc/base-foundation/orm/filters/OrmLikeFilter';
import { lte } from '@system-inc/base-foundation/orm/filters/OrmLteFilter';
import { lt } from '@system-inc/base-foundation/orm/filters/OrmLtFilter';
import { notBetween } from '@system-inc/base-foundation/orm/filters/OrmNotBetweenFilter';
import { notEquals } from '@system-inc/base-foundation/orm/filters/OrmNotEqualsFilter';
import { notInArray } from '@system-inc/base-foundation/orm/filters/OrmNotInArrayFilter';
import { notLike } from '@system-inc/base-foundation/orm/filters/OrmNotLikeFilter';
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';
import { OrmArticleEntity } from '../entities/OrmArticleEntity';
import { OrmAuthorEntity } from '../entities/OrmAuthorEntity';
import { OrmBookEntity } from '../entities/OrmBookEntity';
import { OrmBookGenreEntity } from '../entities/OrmBookGenreEntity';
import { OrmCategoryEntity } from '../entities/OrmCategoryEntity';
import { OrmCommentEntity } from '../entities/OrmCommentEntity';
import { OrmCompositeEntity } from '../entities/OrmCompositeEntity';
import { OrmGenreEntity } from '../entities/OrmGenreEntity';
import { OrmOrderEntity } from '../entities/OrmOrderEntity';
import { OrmPostEntity } from '../entities/OrmPostEntity';
import { OrmProductCategoryEntity } from '../entities/OrmProductCategoryEntity';
import { OrmProductEntity } from '../entities/OrmProductEntity';
import { OrmProductTagEntity } from '../entities/OrmProductTagEntity';
import { OrmTagEntity } from '../entities/OrmTagEntity';
import { OrmTestEntity } from '../entities/OrmTestEntity';
import { OrmUserEntity } from '../entities/OrmUserEntity';

const D1_DATABASE = new DatabaseBinding('d1');

@Injectable()
@HttpService()
export class OrmRepositoryTestService {
    constructor(
        @InjectDatabase()
        private readonly defaultDb: OrmDatabase,
        @InjectDatabase(D1_DATABASE)
        private readonly d1Db: OrmDatabase,
    ) {
        console.log('OrmRepositoryTestService.constructor');
    }

    /**
     * Resolves the data context for the requested database. Routes take
     * a `:db` path segment (`default` or `d1`) so the same suite can be
     * exercised against PlanetScale (the @default settings) and D1.
     */
    private getDatabase(db: string): OrmDatabase {
        return db === 'd1' ? this.d1Db : this.defaultDb;
    }

    /** Resolves the repository for the requested database. */
    private getRepo<EntityType extends OrmTrackingEntity>(
        db: string,
        entity: Constructor<EntityType>,
    ): OrmRepository<EntityType> {
        return this.getDatabase(db).getRepository(entity);
    }

    // Basic CRUD operations

    @HttpRoute('GET', '/test/orm/repository/:db/insert')
    async testInsert(@HttpPath('db') db: string): Promise<Response> {
        const entity = OrmTestEntity.from({
            name: 'Test Entity',
            age: 25,
        });

        const result = await this.getRepo(db, OrmTestEntity).insert(entity);
        console.log('Insert result:', result);

        return Response.json({ entity, result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/find-one/:id')
    async testFindOne(
        @HttpPath('db') db: string,
        @HttpPath('id') id: string,
    ): Promise<Response> {
        const entity = await this.getRepo(db, OrmTestEntity).findOne({
            where: { id },
        });

        if (!entity) {
            return Response.json(
                { error: 'Entity not found' },
                { status: 404 },
            );
        }

        return Response.json(entity);
    }

    @HttpRoute('GET', '/test/orm/repository/:db/update/:id/:name/:age')
    async testUpdate(
        @HttpPath('db') db: string,
        @HttpPath('id') id: string,
        @HttpPath('name') name: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entity = await this.getRepo(db, OrmTestEntity).findOne({
            where: { id },
        });

        if (!entity) {
            return Response.json(
                { error: 'Entity not found' },
                { status: 404 },
            );
        }

        entity.name = name;
        entity.age = age;

        const result = await this.getRepo(db, OrmTestEntity).update(entity);
        console.log('Update result:', result);

        return Response.json({ entity, result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/upsert/:id/:name/:age')
    async testUpsert(
        @HttpPath('db') db: string,
        @HttpPath('id') id: string,
        @HttpPath('name') name: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entity = OrmTestEntity.from({
            id,
            name,
            age,
        });

        const result = await this.getRepo(db, OrmTestEntity).upsert(entity);
        console.log('Upsert result:', result);

        return Response.json({ entity, result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/delete/:id')
    async testDelete(
        @HttpPath('db') db: string,
        @HttpPath('id') id: string,
    ): Promise<Response> {
        const entity = await this.getRepo(db, OrmTestEntity).findOne({
            where: { id },
        });

        if (!entity) {
            return Response.json(
                { error: 'Entity not found' },
                { status: 404 },
            );
        }

        const result = await this.getRepo(db, OrmTestEntity).delete(entity);
        console.log('Delete result:', result);

        return Response.json({ entity, result });
    }

    // Batch operations

    @HttpRoute('GET', '/test/orm/repository/:db/insert-bulk')
    async testInsertBulk(@HttpPath('db') db: string): Promise<Response> {
        const entities = [
            OrmTestEntity.from({ name: 'Entity 1', age: 20 }),
            OrmTestEntity.from({ name: 'Entity 2', age: 30 }),
            OrmTestEntity.from({ name: 'Entity 3', age: 40 }),
            OrmTestEntity.from({ name: 'Entity 4', age: 50 }),
            OrmTestEntity.from({ name: 'Entity 5', age: 60 }),
        ];

        const result = await this.getRepo(db, OrmTestEntity).insert(entities);
        console.log('Bulk insert result:', result);

        return Response.json({ count: entities.length, result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/update-bulk')
    async testUpdateBulk(@HttpPath('db') db: string): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            limit: 5,
        });

        for (const entity of entities) {
            entity.name = `${entity.name} - Updated`;
            entity.age = entity.age + 10;
        }

        const result = await this.getRepo(db, OrmTestEntity).update(entities);
        console.log('Bulk update result:', result);

        return Response.json({ count: entities.length, result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/upsert-bulk')
    async testUpsertBulk(@HttpPath('db') db: string): Promise<Response> {
        const entities = [
            OrmTestEntity.from({ name: 'Upsert 1', age: 100 }),
            OrmTestEntity.from({ name: 'Upsert 2', age: 200 }),
            OrmTestEntity.from({ name: 'Upsert 3', age: 300 }),
        ];

        const result = await this.getRepo(db, OrmTestEntity).upsert(entities);
        console.log('Bulk upsert result:', result);

        return Response.json({ count: entities.length, result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/delete-bulk')
    async testDeleteBulk(@HttpPath('db') db: string): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { name: 'Entity 1' },
        });

        if (entities.length === 0) {
            return Response.json(
                { error: 'No entities to delete' },
                { status: 404 },
            );
        }

        const result = await this.getRepo(db, OrmTestEntity).delete(entities);
        console.log('Bulk delete result:', result);

        return Response.json({ count: entities.length, result });
    }

    // WriteBatch operations

    @HttpRoute('GET', '/test/orm/repository/:db/write-batch/empty')
    async testWriteBatchEmpty(@HttpPath('db') db: string): Promise<Response> {
        const result = await this.getRepo(db, OrmTestEntity).writeBatch(() => {
            // intentionally no ops
        });
        return Response.json({ result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/write-batch/insert-single')
    async testWriteBatchInsertSingle(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const entity = OrmTestEntity.from({
            name: 'WriteBatch Single',
            age: 31,
        });
        const result = await this.getRepo(db, OrmTestEntity).writeBatch(
            (batch) => {
                batch.insert(entity);
            },
        );
        return Response.json({ entity, result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/write-batch/insert-multi')
    async testWriteBatchInsertMulti(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const entities = [
            OrmTestEntity.from({ name: 'WriteBatch Multi 1', age: 41 }),
            OrmTestEntity.from({ name: 'WriteBatch Multi 2', age: 42 }),
            OrmTestEntity.from({ name: 'WriteBatch Multi 3', age: 43 }),
        ];
        const result = await this.getRepo(db, OrmTestEntity).writeBatch(
            (batch) => {
                batch.insert(entities);
            },
        );
        return Response.json({ count: entities.length, entities, result });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/write-batch/update/:id/:name/:age',
    )
    async testWriteBatchUpdate(
        @HttpPath('db') db: string,
        @HttpPath('id') id: string,
        @HttpPath('name') name: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entity = await this.getRepo(db, OrmTestEntity).findOne({
            where: { id },
        });
        if (!entity) {
            return Response.json(
                { error: 'Entity not found' },
                { status: 404 },
            );
        }
        entity.name = name;
        entity.age = age;
        const result = await this.getRepo(db, OrmTestEntity).writeBatch(
            (batch) => {
                batch.update(entity);
            },
        );
        return Response.json({ entity, result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/write-batch/delete/:id')
    async testWriteBatchDelete(
        @HttpPath('db') db: string,
        @HttpPath('id') id: string,
    ): Promise<Response> {
        const entity = await this.getRepo(db, OrmTestEntity).findOne({
            where: { id },
        });
        if (!entity) {
            return Response.json(
                { error: 'Entity not found' },
                { status: 404 },
            );
        }
        const result = await this.getRepo(db, OrmTestEntity).writeBatch(
            (batch) => {
                batch.delete(entity);
            },
        );
        return Response.json({ entity, result });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/write-batch/upsert-insert/:id/:name/:age',
    )
    async testWriteBatchUpsertInsert(
        @HttpPath('db') db: string,
        @HttpPath('id') id: string,
        @HttpPath('name') name: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entity = OrmTestEntity.from({ id, name, age });
        const result = await this.getRepo(db, OrmTestEntity).writeBatch(
            (batch) => {
                batch.upsert(entity);
            },
        );
        return Response.json({ entity, result });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/write-batch/upsert-update/:id/:name/:age',
    )
    async testWriteBatchUpsertUpdate(
        @HttpPath('db') db: string,
        @HttpPath('id') id: string,
        @HttpPath('name') name: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        // Caller is responsible for picking an id that already exists.
        const entity = OrmTestEntity.from({ id, name, age });
        const result = await this.getRepo(db, OrmTestEntity).writeBatch(
            (batch) => {
                batch.upsert(entity);
            },
        );
        return Response.json({ entity, result });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/write-batch/mixed/:victimId')
    async testWriteBatchMixed(
        @HttpPath('db') db: string,
        @HttpPath('victimId') victimId: string,
    ): Promise<Response> {
        const victim = await this.getRepo(db, OrmTestEntity).findOne({
            where: { id: victimId },
        });
        if (!victim) {
            return Response.json(
                { error: 'Victim entity not found' },
                { status: 404 },
            );
        }

        const toInsert = OrmTestEntity.from({
            name: 'WriteBatch Mixed Insert',
            age: 51,
        });
        victim.name = 'WriteBatch Mixed Updated';

        const result = await this.getRepo(db, OrmTestEntity).writeBatch(
            (batch) => {
                batch.insert(toInsert);
                batch.update(victim);
                // delete the original we just updated — net effect: insert one
                // new row, victim is gone. Verifies all three op kinds are
                // applied atomically.
                batch.delete(victim);
            },
        );

        return Response.json({
            inserted: toInsert,
            updatedThenDeleted: victim,
            result,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/write-batch/atomicity')
    async testWriteBatchAtomicity(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Build two inserts where the second one will fail (PK collision).
        // Mint the id up front so both rows collide — auto-uuid ids are
        // assigned at insert time, so without an explicit id the
        // beforeInsert hook would mint two distinct uuids and there'd be
        // no collision to test atomicity against.
        const good = OrmTestEntity.from({
            id: crypto.randomUUID(),
            name: 'WriteBatch Atomicity Good',
            age: 61,
        });
        const colliding = OrmTestEntity.from({
            id: good.id, // intentional duplicate read back from `good`
            name: 'WriteBatch Atomicity Bad',
            age: 62,
        });

        let errorMessage: string | undefined;
        try {
            await this.getRepo(db, OrmTestEntity).writeBatch((batch) => {
                batch.insert(good);
                batch.insert(colliding);
            });
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : String(e);
        }

        // If the batch is atomic, the "good" row should NOT have been
        // committed (the second insert rolled back the whole batch).
        const persisted = await this.getRepo(db, OrmTestEntity).findOne({
            where: { id: good.id },
        });

        return Response.json({
            errorMessage,
            persisted,
            // True iff atomicity held.
            atomic: errorMessage !== undefined && persisted === null,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/write-batch/cleanup')
    async testWriteBatchCleanup(@HttpPath('db') db: string): Promise<Response> {
        // Wipe entities created by the writeBatch tests.
        const entities = await this.getRepo(db, OrmTestEntity).find({});
        const matchingNames = entities.filter((e) =>
            e.name.startsWith('WriteBatch '),
        );
        if (matchingNames.length === 0) {
            return Response.json({ deleted: 0 });
        }
        const result = await this.getRepo(db, OrmTestEntity).delete(
            matchingNames,
        );
        return Response.json({
            deleted: result.affectedRows ?? matchingNames.length,
        });
    }

    // Query operations

    @HttpRoute('GET', '/test/orm/repository/:db/find-all')
    async testFindAll(@HttpPath('db') db: string): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({});
        return Response.json({ count: entities.length, entities });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/find-with-conditions')
    async testFindWithConditions(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: 30 },
            order: { name: 'ASC' },
            limit: 10,
        });

        return Response.json({ count: entities.length, entities });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/find-and-count')
    async testFindAndCount(@HttpPath('db') db: string): Promise<Response> {
        const [entities, count] = await this.getRepo(
            db,
            OrmTestEntity,
        ).findAndCount({
            where: { age: 30 },
            limit: 5,
            offset: 0,
        });

        return Response.json({
            totalCount: count,
            pageCount: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/count')
    async testCount(@HttpPath('db') db: string): Promise<Response> {
        const count = await this.getRepo(db, OrmTestEntity).count({
            where: { age: 30 },
        });

        return Response.json({ count });
    }

    // Transaction test

    @HttpRoute('GET', '/test/orm/repository/:db/transaction')
    async testTransaction(@HttpPath('db') db: string): Promise<Response> {
        const result = await this.getDatabase(db).transaction(async (tx) => {
            const entity1 = OrmTestEntity.from({
                name: 'Transaction Test 1',
                age: 111,
            });

            const entity2 = OrmTestEntity.from({
                name: 'Transaction Test 2',
                age: 222,
            });

            const repo = tx.getRepository(OrmTestEntity);

            await repo.insert(entity1);
            await repo.insert(entity2);

            // Update the first entity
            entity1.age = 333;
            await repo.update(entity1);

            return { entity1, entity2 };
        });

        return Response.json(result);
    }

    // Composite key tests

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/composite/insert/:userId/:projectId/:role',
    )
    async testCompositeInsert(
        @HttpPath('db') db: string,
        @HttpPath('userId') userId: string,
        @HttpPath('projectId') projectId: string,
        @HttpPath('role') role: string,
    ): Promise<Response> {
        const entity = OrmCompositeEntity.from({
            userId,
            projectId,
            role,
            assignedAt: new Date(),
        });

        const result = await this.getRepo(db, OrmCompositeEntity).insert(
            entity,
        );
        console.log('Composite insert result:', result);

        return Response.json({ entity, result });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/composite/update/:userId/:projectId/:role',
    )
    async testCompositeUpdate(
        @HttpPath('db') db: string,
        @HttpPath('userId') userId: string,
        @HttpPath('projectId') projectId: string,
        @HttpPath('role') newRole: string,
    ): Promise<Response> {
        const entity = await this.getRepo(db, OrmCompositeEntity).findOne({
            where: { userId, projectId },
        });

        if (!entity) {
            return Response.json(
                { error: 'Composite entity not found' },
                { status: 404 },
            );
        }

        entity.role = newRole;
        entity.assignedAt = new Date();

        const result = await this.getRepo(db, OrmCompositeEntity).update(
            entity,
        );
        console.log('Composite update result:', result);

        return Response.json({ entity, result });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/composite/delete/:userId/:projectId',
    )
    async testCompositeDelete(
        @HttpPath('db') db: string,
        @HttpPath('userId') userId: string,
        @HttpPath('projectId') projectId: string,
    ): Promise<Response> {
        const entity = await this.getRepo(db, OrmCompositeEntity).findOne({
            where: { userId, projectId },
        });

        if (!entity) {
            return Response.json(
                { error: 'Composite entity not found' },
                { status: 404 },
            );
        }

        const result = await this.getRepo(db, OrmCompositeEntity).delete(
            entity,
        );
        console.log('Composite delete result:', result);

        return Response.json({ entity, result });
    }

    // Change tracking test

    @HttpRoute('GET', '/test/orm/repository/:db/change-tracking/:id')
    async testChangeTracking(
        @HttpPath('db') db: string,
        @HttpPath('id') id: string,
    ): Promise<Response> {
        const entity = await this.getRepo(db, OrmTestEntity).findOne({
            where: { id },
        });

        if (!entity) {
            return Response.json(
                { error: 'Entity not found' },
                { status: 404 },
            );
        }

        const changesBeforeModification = entity.getChangedFields();

        // Make some changes
        entity.name = 'Modified Name';
        entity.age = 999;

        const changesAfterModification = entity.getChangedFields();

        // Update and check changes are cleared
        await this.getRepo(db, OrmTestEntity).update(entity);
        const changesAfterUpdate = entity.getChangedFields();

        return Response.json({
            changesBeforeModification,
            changesAfterModification,
            changesAfterUpdate,
            entity,
        });
    }

    // Relations tests

    @HttpRoute('GET', '/test/orm/repository/:db/relations/setup')
    async testRelationsSetup(@HttpPath('db') db: string): Promise<Response> {
        // Portable atomic write — works on D1 (no interactive transactions).
        // IDs are minted synchronously by `batch.insert(...)` so later
        // operations in the same callback can reference them.
        const user1 = OrmUserEntity.from({
            username: 'john_doe',
            email: 'john@example.com',
        });
        const user2 = OrmUserEntity.from({
            username: 'jane_smith',
            email: 'jane@example.com',
        });

        let post1!: OrmPostEntity;
        let post2!: OrmPostEntity;
        let post3!: OrmPostEntity;
        let comment1!: OrmCommentEntity;
        let comment2!: OrmCommentEntity;
        let comment3!: OrmCommentEntity;

        await this.getDatabase(db).writeBatch((batch) => {
            batch.insert([user1, user2]);

            post1 = OrmPostEntity.from({
                title: 'First Post',
                content: 'This is the content of the first post',
                authorId: user1.id,
            });
            post2 = OrmPostEntity.from({
                title: 'Second Post',
                content: 'This is the content of the second post',
                authorId: user1.id,
            });
            post3 = OrmPostEntity.from({
                title: "Jane's Post",
                content: "This is Jane's post content",
                authorId: user2.id,
            });
            batch.insert([post1, post2, post3]);

            comment1 = OrmCommentEntity.from({
                content: 'Great post!',
                authorId: user2.id,
                postId: post1.id,
            });
            comment2 = OrmCommentEntity.from({
                content: 'Thanks for sharing',
                authorId: user1.id,
                postId: post3.id,
            });
            comment3 = OrmCommentEntity.from({
                content: 'Interesting perspective',
                authorId: user2.id,
                postId: post1.id,
            });
            batch.insert([comment1, comment2, comment3]);
        });

        return Response.json({
            users: [user1, user2],
            posts: [post1, post2, post3],
            comments: [comment1, comment2, comment3],
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/relations/find-with-author')
    async testFindPostWithAuthor(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const posts = await this.getRepo(db, OrmPostEntity).find({
            relations: {
                author: true,
            },
            limit: 5,
        });

        return Response.json({
            count: posts.length,
            posts,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/relations/find-with-posts')
    async testFindUserWithPosts(@HttpPath('db') db: string): Promise<Response> {
        const users = await this.getRepo(db, OrmUserEntity).find({
            relations: {
                posts: true,
            },
            limit: 5,
        });

        return Response.json({
            count: users.length,
            users,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/relations/find-with-nested')
    async testFindWithNestedRelations(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const users = await this.getRepo(db, OrmUserEntity).find({
            relations: {
                posts: {
                    comments: true,
                },
                comments: true,
            },
            limit: 5,
        });

        return Response.json({
            count: users.length,
            users,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/relations/find-post-with-all')
    async testFindPostWithAllRelations(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const posts = await this.getRepo(db, OrmPostEntity).find({
            relations: {
                author: true,
                comments: {
                    author: true,
                },
            },
            limit: 5,
        });

        return Response.json({
            count: posts.length,
            posts,
        });
    }

    // Relation-predicate filtering: filter a parent by a *related* entity's
    // column (compiled to an EXISTS subquery). The parent has no such column of
    // its own — this is the "find through the relation" case.

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/relations/find-posts-by-author-username/:username',
    )
    async testFindPostsByAuthorUsername(
        @HttpPath('db') db: string,
        @HttpPath('username') username: string,
    ): Promise<Response> {
        // OrmPostEntity has no username column — filter through its `author`
        // (many-to-one) relation.
        const posts = await this.getRepo(db, OrmPostEntity).find({
            where: { author: { username } },
            relations: { author: true },
        });
        return Response.json({ count: posts.length, posts });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/relations/count-posts-by-author-username/:username',
    )
    async testCountPostsByAuthorUsername(
        @HttpPath('db') db: string,
        @HttpPath('username') username: string,
    ): Promise<Response> {
        const count = await this.getRepo(db, OrmPostEntity).count({
            where: { author: { username } },
        });
        return Response.json({ count });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/relations/find-posts-by-comment-author/:authorId',
    )
    async testFindPostsByCommentAuthor(
        @HttpPath('db') db: string,
        @HttpPath('authorId') authorId: string,
    ): Promise<Response> {
        // Filter posts through their `comments` (one-to-many) relation.
        const posts = await this.getRepo(db, OrmPostEntity).find({
            where: { comments: { authorId } },
            relations: { comments: true },
        });
        return Response.json({ count: posts.length, posts });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/relations/find-one-with-relations/:username',
    )
    async testFindOneWithRelations(
        @HttpPath('db') db: string,
        @HttpPath('username') username: string,
    ): Promise<Response> {
        const user = await this.getRepo(db, OrmUserEntity).findOne({
            where: { username },
            relations: {
                posts: {
                    comments: {
                        author: true,
                    },
                },
                comments: {
                    post: true,
                },
            },
        });

        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        return Response.json(user);
    }

    @HttpRoute('GET', '/test/orm/repository/:db/relations/cleanup')
    async testRelationsCleanup(@HttpPath('db') db: string): Promise<Response> {
        const comments = await this.getRepo(db, OrmCommentEntity).find({});
        const posts = await this.getRepo(db, OrmPostEntity).find({});
        const users = await this.getRepo(db, OrmUserEntity).find({});

        // Atomic delete in reverse FK order. Portable across all adapters.
        await this.getDatabase(db).writeBatch((batch) => {
            if (comments.length > 0) batch.delete(comments);
            if (posts.length > 0) batch.delete(posts);
            if (users.length > 0) batch.delete(users);
        });

        return Response.json({
            deletedComments: comments.length > 0 ? comments.length : undefined,
            deletedPosts: posts.length > 0 ? posts.length : undefined,
            deletedUsers: users.length > 0 ? users.length : undefined,
        });
    }

    // Filter operators tests

    @HttpRoute('GET', '/test/orm/repository/:db/filters/setup')
    async testFiltersSetup(@HttpPath('db') db: string): Promise<Response> {
        // Clean up any existing data first to make this idempotent
        const existingEntities = await this.getRepo(db, OrmTestEntity).find({});
        if (existingEntities.length > 0) {
            await this.getRepo(db, OrmTestEntity).delete(existingEntities);
        }

        // Create test data with various ages and names for filter testing
        const testData = [
            { name: 'Alice', age: 25, email: 'alice@test.com' },
            { name: 'Bob', age: 30, email: 'bob@test.com' },
            { name: 'Charlie', age: 35, email: null },
            { name: 'David', age: 40, email: 'david@test.com' },
            { name: 'Eve', age: 45, email: null },
            { name: 'Frank', age: 30, email: 'frank@test.com' },
            { name: 'Grace', age: 35, email: 'grace@test.com' },
        ];

        const entities = testData.map((data) => OrmTestEntity.from(data));
        await this.getRepo(db, OrmTestEntity).insert(entities);

        return Response.json({
            message: 'Filter test data created',
            count: entities.length,
            deletedCount: existingEntities.length,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/equals/:age')
    async testFilterEquals(
        @HttpPath('db') db: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: equals(age) },
        });

        return Response.json({
            filter: `age equals ${age}`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/not-equals/:age')
    async testFilterNotEquals(
        @HttpPath('db') db: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: notEquals(age) },
        });

        return Response.json({
            filter: `age not equals ${age}`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/greater-than/:age')
    async testFilterGt(
        @HttpPath('db') db: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: gt(age) },
        });

        return Response.json({
            filter: `age > ${age}`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/filters/greater-than-equals/:age',
    )
    async testFilterGte(
        @HttpPath('db') db: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: gte(age) },
        });

        return Response.json({
            filter: `age >= ${age}`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/less-than/:age')
    async testFilterLt(
        @HttpPath('db') db: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: lt(age) },
        });

        return Response.json({
            filter: `age < ${age}`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/less-than-equals/:age')
    async testFilterLte(
        @HttpPath('db') db: string,
        @HttpPath('age', () => Number) age: number,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: lte(age) },
        });

        return Response.json({
            filter: `age <= ${age}`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/in-array')
    async testFilterInArray(@HttpPath('db') db: string): Promise<Response> {
        const ages = [25, 35, 45];
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: inArray(ages) },
        });

        return Response.json({
            filter: `age in [${ages.join(', ')}]`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/not-in-array')
    async testFilterNotInArray(@HttpPath('db') db: string): Promise<Response> {
        const ages = [30, 40];
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: notInArray(ages) },
        });

        return Response.json({
            filter: `age not in [${ages.join(', ')}]`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/between/:min/:max')
    async testFilterBetween(
        @HttpPath('db') db: string,
        @HttpPath('min', () => Number) min: number,
        @HttpPath('max', () => Number) max: number,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: between(min, max) },
        });

        return Response.json({
            filter: `age between ${min} and ${max}`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/not-between/:min/:max')
    async testFilterNotBetween(
        @HttpPath('db') db: string,
        @HttpPath('min', () => Number) min: number,
        @HttpPath('max', () => Number) max: number,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: notBetween(min, max) },
        });

        return Response.json({
            filter: `age not between ${min} and ${max}`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/like/:pattern')
    async testFilterLike(
        @HttpPath('db') db: string,
        @HttpPath('pattern') pattern: string,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { name: like(pattern) },
        });

        return Response.json({
            filter: `name like '${pattern}'`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/not-like/:pattern')
    async testFilterNotLike(
        @HttpPath('db') db: string,
        @HttpPath('pattern') pattern: string,
    ): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { name: notLike(pattern) },
        });

        return Response.json({
            filter: `name not like '${pattern}'`,
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/is-null')
    async testFilterIsNull(@HttpPath('db') db: string): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { email: isNull() },
        });

        return Response.json({
            filter: 'email is null',
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/is-not-null')
    async testFilterIsNotNull(@HttpPath('db') db: string): Promise<Response> {
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { email: isNotNull() },
        });

        return Response.json({
            filter: 'email is not null',
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/complex')
    async testFilterComplex(@HttpPath('db') db: string): Promise<Response> {
        // Test combining multiple filters
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: {
                age: gte(30),
                name: like('%a%'),
                email: isNotNull(),
            },
        });

        return Response.json({
            filter: "age >= 30 AND name like '%a%' AND email is not null",
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/backward-compat')
    async testFilterBackwardCompatibility(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Test that direct values still work (implicit equals)
        const entities = await this.getRepo(db, OrmTestEntity).find({
            where: { age: 30 }, // Should work like equals(30)
        });

        return Response.json({
            filter: 'age = 30 (using direct value, not filter object)',
            count: entities.length,
            entities,
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/filters/cleanup')
    async testFiltersCleanup(@HttpPath('db') db: string): Promise<Response> {
        // Delete all test entities
        const entities = await this.getRepo(db, OrmTestEntity).find({});

        if (entities.length > 0) {
            const result = await this.getRepo(db, OrmTestEntity).delete(
                entities,
            );
            return Response.json({
                message: 'Filter test data cleaned up',
                deletedCount: result.affectedRows,
            });
        }

        return Response.json({
            message: 'No test data to clean up',
            deletedCount: 0,
        });
    }

    // Default Values Tests

    @HttpRoute('GET', '/test/orm/repository/:db/defaults/create-product')
    async testDefaultValuesCreateProduct(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Create a product with minimal data - defaults should be applied
        const product = OrmProductEntity.from({
            name: 'Test Product',
            sku: `SKU-${Date.now()}`,
        });

        await this.getRepo(db, OrmProductEntity).insert(product);

        // Retrieve to verify defaults were applied
        const retrieved = await this.getRepo(db, OrmProductEntity).findOne({
            where: { id: product.id },
        });

        if (!retrieved) {
            return Response.json(
                { error: 'Product not found after insert' },
                { status: 404 },
            );
        }

        return Response.json({
            product: retrieved,
            defaultsApplied: {
                description:
                    retrieved.description === 'No description available',
                price: retrieved.price === 99.99,
                stockQuantity: retrieved.stockQuantity === 10,
                isActive: retrieved.isActive === true,
                status: retrieved.status === 'draft',
                weight: retrieved.weight === 0,
                publishedAt: retrieved.publishedAt instanceof Date,
            },
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/defaults/create-order')
    async testDefaultValuesCreateOrder(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Create an order with minimal data - defaults should be applied
        const order = OrmOrderEntity.from({
            customerId: 123,
        });

        await this.getRepo(db, OrmOrderEntity).insert(order);

        // Retrieve to verify defaults were applied
        const retrieved = await this.getRepo(db, OrmOrderEntity).findOne({
            where: { id: order.id },
        });

        if (!retrieved) {
            return Response.json(
                { error: 'Order not found after insert' },
                { status: 404 },
            );
        }

        return Response.json({
            order: retrieved,
            defaultsApplied: {
                orderNumber: retrieved.orderNumber.startsWith('ORD-'),
                status: retrieved.status === 'pending',
                subtotal: retrieved.subtotal === 0, // Testing falsy default
                tax: retrieved.tax === 8.5,
                shipping: retrieved.shipping === 12.0,
                total: retrieved.total === 20.5,
                currency: retrieved.currency === 'USD',
                orderDate: retrieved.orderDate instanceof Date,
            },
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/defaults/create-category')
    async testDefaultValuesCreateCategory(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const category = OrmCategoryEntity.from({
            name: 'Electronics',
            slug: 'electronics',
        });

        await this.getRepo(db, OrmCategoryEntity).insert(category);

        const retrieved = await this.getRepo(db, OrmCategoryEntity).findOne({
            where: { id: category.id },
        });

        if (!retrieved) {
            return Response.json(
                { error: 'Category not found after insert' },
                { status: 404 },
            );
        }

        return Response.json({
            category: retrieved,
            defaultsApplied: {
                sortOrder: retrieved.sortOrder === 0,
                isVisible: retrieved.isVisible === true,
            },
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/defaults/create-tag')
    async testDefaultValuesCreateTag(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const tag = OrmTagEntity.from({
            name: 'featured',
        });

        await this.getRepo(db, OrmTagEntity).insert(tag);

        const retrieved = await this.getRepo(db, OrmTagEntity).findOne({
            where: { name: tag.name },
        });

        if (!retrieved) {
            return Response.json(
                { error: 'Tag not found after insert' },
                { status: 404 },
            );
        }

        return Response.json({
            tag: retrieved,
            defaultsApplied: {
                color: retrieved.color === '#000000',
                usageCount: retrieved.usageCount === 0,
            },
        });
    }

    // Many-to-Many Relationship Tests

    @HttpRoute('GET', '/test/orm/repository/:db/many-to-many/setup')
    async testManyToManySetup(@HttpPath('db') db: string): Promise<Response> {
        const categories = [
            OrmCategoryEntity.from({
                name: 'Electronics',
                slug: 'electronics',
            }),
            OrmCategoryEntity.from({ name: 'Clothing', slug: 'clothing' }),
            OrmCategoryEntity.from({ name: 'Books', slug: 'books' }),
        ];

        const tags = [
            OrmTagEntity.from({ name: 'new', color: '#00FF00' }),
            OrmTagEntity.from({ name: 'sale', color: '#FF0000' }),
            OrmTagEntity.from({ name: 'featured', color: '#FFD700' }),
        ];

        const products = [
            OrmProductEntity.from({
                name: 'Laptop',
                sku: 'LAPTOP-001',
                price: 999.99,
                stockQuantity: 10,
            }),
            OrmProductEntity.from({
                name: 'T-Shirt',
                sku: 'TSHIRT-001',
                price: 29.99,
                stockQuantity: 100,
            }),
            OrmProductEntity.from({
                name: 'Programming Book',
                sku: 'BOOK-001',
                price: 49.99,
                stockQuantity: 50,
            }),
        ];

        // Categories use a DB-assigned serial primary key, so insert them
        // individually: a single insert back-populates the generated id onto the
        // entity (a batch insert can't return per-row serial ids), and the
        // junction rows below reference `category.id`. Products (uuid) and tags
        // (varchar `name`) are client-keyed, so they batch fine.
        const categoryRepo = this.getRepo(db, OrmCategoryEntity);
        for (const category of categories) {
            await categoryRepo.insert(category);
        }
        await this.getDatabase(db).writeBatch((batch) => {
            batch.insert(tags);
            batch.insert(products);
        });

        // Link each product to a category and some tags through the
        // explicit junction entities
        const links = [
            OrmProductCategoryEntity.from({
                productId: products[0].id,
                categoryId: categories[0].id,
            }),
            OrmProductCategoryEntity.from({
                productId: products[1].id,
                categoryId: categories[1].id,
            }),
            OrmProductCategoryEntity.from({
                productId: products[2].id,
                categoryId: categories[2].id,
            }),
        ];
        const tagLinks = [
            OrmProductTagEntity.from({
                productId: products[0].id,
                tagId: tags[0].name,
            }),
            OrmProductTagEntity.from({
                productId: products[0].id,
                tagId: tags[2].name,
            }),
            OrmProductTagEntity.from({
                productId: products[1].id,
                tagId: tags[1].name,
            }),
        ];
        await this.getDatabase(db).writeBatch((batch) => {
            batch.insert(links);
            batch.insert(tagLinks);
        });

        return Response.json({
            categories: categories.map((c) => ({ id: c.id, name: c.name })),
            tags: tags.map((t) => ({ name: t.name, color: t.color })),
            products: products.map((p) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
            })),
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/many-to-many/assign-categories')
    async testManyToManyAssignCategories(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // This would typically be done through a junction table insert
        // For now, we'll demonstrate the relationship exists
        const products = await this.getRepo(db, OrmProductEntity).find({
            limit: 1,
        });

        const categories = await this.getRepo(db, OrmCategoryEntity).find({
            limit: 2,
        });

        if (products.length === 0 || categories.length === 0) {
            return Response.json(
                { error: 'No products or categories found. Run setup first.' },
                { status: 404 },
            );
        }

        // Link the product to the categories through the junction entity;
        // upsert keeps the route idempotent across repeated calls
        const assignments = categories.map((category) =>
            OrmProductCategoryEntity.from({
                productId: products[0].id,
                categoryId: category.id,
            }),
        );
        await this.getDatabase(db).writeBatch((batch) => {
            batch.upsert(assignments);
        });

        return Response.json({
            message: 'Many-to-many relationship structure exists',
            product: {
                id: products[0].id,
                name: products[0].name,
            },
            categories: categories.map((c) => ({
                id: c.id,
                name: c.name,
            })),
            note: 'Junction table orm_product_categories links these through the explicit OrmProductCategoryEntity',
        });
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/many-to-many/find-with-relations',
    )
    async testManyToManyFindWithRelations(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Find products with their categories and tags, traversing the
        // junction entities via nested relations
        const products = await this.getRepo(db, OrmProductEntity).find({
            relations: {
                productCategories: {
                    category: true,
                },
                productTags: {
                    tag: true,
                },
            },
            limit: 5,
        });

        return Response.json({
            count: products.length,
            products: products.map((p) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                categoriesCount: p.productCategories?.length || 0,
                tagsCount: p.productTags?.length || 0,
            })),
            note: 'Many-to-many relations load through the junction entities',
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/many-to-many/cleanup')
    async testManyToManyCleanup(@HttpPath('db') db: string): Promise<Response> {
        const products = await this.getRepo(db, OrmProductEntity).find({});
        const categories = await this.getRepo(db, OrmCategoryEntity).find({});
        const tags = await this.getRepo(db, OrmTagEntity).find({});
        const categoryLinks = await this.getRepo(
            db,
            OrmProductCategoryEntity,
        ).find({});
        const tagLinks = await this.getRepo(db, OrmProductTagEntity).find({});

        await this.getDatabase(db).writeBatch((batch) => {
            if (categoryLinks.length > 0) batch.delete(categoryLinks);
            if (tagLinks.length > 0) batch.delete(tagLinks);
            if (products.length > 0) batch.delete(products);
            if (categories.length > 0) batch.delete(categories);
            if (tags.length > 0) batch.delete(tags);
        });

        return Response.json({
            deletedProducts: products.length > 0 ? products.length : undefined,
            deletedCategories:
                categories.length > 0 ? categories.length : undefined,
            deletedTags: tags.length > 0 ? tags.length : undefined,
        });
    }

    // Index and Unique Constraint Tests

    @HttpRoute('GET', '/test/orm/repository/:db/constraints/test-unique-sku')
    async testUniqueSkuConstraint(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const sku = `UNIQUE-${Date.now()}`;

        // Create first product with this SKU
        const product1 = OrmProductEntity.from({
            name: 'Product 1',
            sku: sku,
        });

        await this.getRepo(db, OrmProductEntity).insert(product1);

        // Try to create second product with same SKU - should fail
        const product2 = OrmProductEntity.from({
            name: 'Product 2',
            sku: sku,
        });

        try {
            await this.getRepo(db, OrmProductEntity).insert(product2);
            return Response.json({
                success: false,
                message: 'Unique constraint was not enforced',
            });
        } catch (error) {
            return Response.json({
                success: true,
                message: 'Unique constraint properly enforced',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    @HttpRoute(
        'GET',
        '/test/orm/repository/:db/constraints/test-composite-unique',
    )
    async testCompositeUniqueConstraint(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        const sku = `SKU-${Date.now()}`;
        const vendorCode = 'VENDOR-001';

        // Create first product with this SKU and vendor code combination
        const product1 = OrmProductEntity.from({
            name: 'Product 1',
            sku: sku,
            vendorCode: vendorCode,
        });

        await this.getRepo(db, OrmProductEntity).insert(product1);

        // Create second product with same SKU but different vendor code - should succeed
        const product2 = OrmProductEntity.from({
            name: 'Product 2',
            sku: `${sku}-2`,
            vendorCode: vendorCode,
        });

        await this.getRepo(db, OrmProductEntity).insert(product2);

        // Try to create third product with same SKU and vendor code - should fail
        const product3 = OrmProductEntity.from({
            name: 'Product 3',
            sku: sku,
            vendorCode: vendorCode,
        });

        try {
            await this.getRepo(db, OrmProductEntity).insert(product3);
            return Response.json({
                success: false,
                message: 'Composite unique constraint was not enforced',
            });
        } catch (error) {
            return Response.json({
                success: true,
                message: 'Composite unique constraint properly enforced',
                error: error instanceof Error ? error.message : 'Unknown error',
                created: [
                    {
                        name: product1.name,
                        sku: product1.sku,
                        vendorCode: product1.vendorCode,
                    },
                    {
                        name: product2.name,
                        sku: product2.sku,
                        vendorCode: product2.vendorCode,
                    },
                ],
            });
        }
    }

    @HttpRoute('GET', '/test/orm/repository/:db/constraints/test-indexes')
    async testIndexedQueries(@HttpPath('db') db: string): Promise<Response> {
        // Create some test products
        const products = [];
        for (let i = 0; i < 5; i++) {
            products.push(
                OrmProductEntity.from({
                    name: `Product ${i}`,
                    sku: `SKU-IDX-${i}`,
                    price: Math.random() * 1000,
                    status: i % 2 === 0 ? 'active' : 'draft',
                }),
            );
        }

        await this.getRepo(db, OrmProductEntity).insert(products);

        // Test query using indexed column (sku)
        const bySkuStart = Date.now();
        const foundBySku = await this.getRepo(db, OrmProductEntity).findOne({
            where: { sku: 'SKU-IDX-4' },
        });
        const bySkuTime = Date.now() - bySkuStart;

        // Test query using composite index (price, status)
        const byPriceStatusStart = Date.now();
        const foundByPriceStatus = await this.getRepo(
            db,
            OrmProductEntity,
        ).find({
            where: {
                price: gte(500),
                status: 'active',
            },
            limit: 5,
        });
        const byPriceStatusTime = Date.now() - byPriceStatusStart;

        return Response.json({
            indexedQueries: {
                skuIndex: {
                    found: foundBySku !== null,
                    timeMs: bySkuTime,
                },
                compositePriceStatusIndex: {
                    count: foundByPriceStatus.length,
                    timeMs: byPriceStatusTime,
                },
            },
            note: 'Indexes improve query performance for these columns',
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/test-data/cleanup')
    async testDataCleanup(@HttpPath('db') db: string): Promise<Response> {
        const products = await this.getRepo(db, OrmProductEntity).find({});
        const orders = await this.getRepo(db, OrmOrderEntity).find({});
        const categories = await this.getRepo(db, OrmCategoryEntity).find({});
        const tags = await this.getRepo(db, OrmTagEntity).find({});

        let deletedProducts: number | undefined = undefined;
        let deletedOrders: number | undefined = undefined;
        let deletedCategories: number | undefined = undefined;
        let deletedTags: number | undefined = undefined;

        if (products.length > 0) {
            const result = await this.getRepo(db, OrmProductEntity).delete(
                products,
            );
            deletedProducts = result.affectedRows;
        }

        if (orders.length > 0) {
            const result = await this.getRepo(db, OrmOrderEntity).delete(
                orders,
            );
            deletedOrders = result.affectedRows;
        }

        if (categories.length > 0) {
            const result = await this.getRepo(db, OrmCategoryEntity).delete(
                categories,
            );
            deletedCategories = result.affectedRows;
        }

        if (tags.length > 0) {
            const result = await this.getRepo(db, OrmTagEntity).delete(tags);
            deletedTags = result.affectedRows;
        }

        return Response.json({
            deletedProducts,
            deletedOrders,
            deletedCategories,
            deletedTags,
        });
    }

    // OrmJoinColumn tests

    @HttpRoute('GET', '/test/orm/repository/:db/join-column/setup')
    async testJoinColumnSetup(@HttpPath('db') db: string): Promise<Response> {
        // Create authors
        const author1 = OrmAuthorEntity.from({
            name: 'John Doe',
            email: 'john@example.com',
            code: 'JD001',
        });

        const author2 = OrmAuthorEntity.from({
            name: 'Jane Smith',
            email: 'jane@example.com',
            code: 'JS002',
        });

        const authorResult1 = await this.getRepo(db, OrmAuthorEntity).insert(
            author1,
        );
        const authorResult2 = await this.getRepo(db, OrmAuthorEntity).insert(
            author2,
        );

        // Create articles with custom join column
        const article1 = OrmArticleEntity.from({
            title: 'Understanding ORM',
            content: 'This article explains ORM concepts...',
            authorId: author1.id,
        });

        const article2 = OrmArticleEntity.from({
            title: 'Advanced TypeScript',
            content: 'Deep dive into TypeScript features...',
            authorId: author2.id,
        });

        const article3 = OrmArticleEntity.from({
            title: 'Database Best Practices',
            content: 'Learn about database optimization...',
            authorId: author1.id,
        });

        const articleResult1 = await this.getRepo(db, OrmArticleEntity).insert(
            article1,
        );
        const articleResult2 = await this.getRepo(db, OrmArticleEntity).insert(
            article2,
        );
        const articleResult3 = await this.getRepo(db, OrmArticleEntity).insert(
            article3,
        );

        return Response.json({
            authors: [
                { entity: author1, result: authorResult1 },
                { entity: author2, result: authorResult2 },
            ],
            articles: [
                { entity: article1, result: articleResult1 },
                { entity: article2, result: articleResult2 },
                { entity: article3, result: articleResult3 },
            ],
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/join-column/test-relation')
    async testJoinColumnRelation(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Find articles with their authors using the custom join column
        const articles = await this.getRepo(db, OrmArticleEntity).find({
            relations: { author: true },
        });

        // Verify the relation works with custom column name
        const articlesWithAuthors = articles.map((article) => ({
            id: article.id,
            title: article.title,
            authorId: article.authorId,
            authorName: article.author?.name,
            authorEmail: article.author?.email,
        }));

        return Response.json({
            articlesCount: articles.length,
            articles: articlesWithAuthors,
            note: 'Uses custom column name "writer_id" in database via OrmJoinColumn',
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/join-column/cleanup')
    async testJoinColumnCleanup(@HttpPath('db') db: string): Promise<Response> {
        const articles = await this.getRepo(db, OrmArticleEntity).find({});
        const authors = await this.getRepo(db, OrmAuthorEntity).find({});

        let deletedArticles: number | undefined = undefined;
        let deletedAuthors: number | undefined = undefined;

        if (articles.length > 0) {
            const result = await this.getRepo(db, OrmArticleEntity).delete(
                articles,
            );
            deletedArticles = result.affectedRows;
        }

        if (authors.length > 0) {
            const result = await this.getRepo(db, OrmAuthorEntity).delete(
                authors,
            );
            deletedAuthors = result.affectedRows;
        }

        return Response.json({
            deletedArticles,
            deletedAuthors,
        });
    }

    // Junction-entity (custom join table) tests

    @HttpRoute('GET', '/test/orm/repository/:db/join-table/setup')
    async testJoinTableSetup(@HttpPath('db') db: string): Promise<Response> {
        // Create genres
        const genre1 = OrmGenreEntity.from({
            name: 'Science Fiction',
            description: 'Futuristic and imaginative concepts',
        });

        const genre2 = OrmGenreEntity.from({
            name: 'Mystery',
            description: 'Suspenseful stories with puzzles to solve',
        });

        const genre3 = OrmGenreEntity.from({
            name: 'Fantasy',
            description: 'Magical and mythical elements',
        });

        const genreResult1 = await this.getRepo(db, OrmGenreEntity).insert(
            genre1,
        );
        const genreResult2 = await this.getRepo(db, OrmGenreEntity).insert(
            genre2,
        );
        const genreResult3 = await this.getRepo(db, OrmGenreEntity).insert(
            genre3,
        );

        // Create books
        const book1 = OrmBookEntity.from({
            title: 'The Time Machine',
            isbn: '9780141439976',
            pages: 118,
        });

        const book2 = OrmBookEntity.from({
            title: 'Murder on the Orient Express',
            isbn: '9780062693662',
            pages: 274,
        });

        const book3 = OrmBookEntity.from({
            title: 'Dune',
            isbn: '9780441172719',
            pages: 688,
        });

        const bookResult1 = await this.getRepo(db, OrmBookEntity).insert(book1);
        const bookResult2 = await this.getRepo(db, OrmBookEntity).insert(book2);
        const bookResult3 = await this.getRepo(db, OrmBookEntity).insert(book3);

        // Link books to genres through the explicit junction entity
        const mappings = [
            { book: book1, genre: genre1 },
            { book: book1, genre: genre3 },
            { book: book2, genre: genre2 },
            { book: book3, genre: genre1 },
            { book: book3, genre: genre3 },
        ].map(({ book, genre }) =>
            OrmBookGenreEntity.from({ bookId: book.id, genreId: genre.id }),
        );
        await this.getRepo(db, OrmBookGenreEntity).insert(mappings);

        return Response.json({
            genres: [
                { entity: genre1, result: genreResult1 },
                { entity: genre2, result: genreResult2 },
                { entity: genre3, result: genreResult3 },
            ],
            books: [
                { entity: book1, result: bookResult1 },
                { entity: book2, result: bookResult2 },
                { entity: book3, result: bookResult3 },
            ],
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/join-table/test-many-to-many')
    async testJoinTableManyToMany(
        @HttpPath('db') db: string,
    ): Promise<Response> {
        // Find books with their genres through the junction entity
        const books = await this.getRepo(db, OrmBookEntity).find({
            relations: { genreMappings: { genre: true } },
        });

        const booksWithGenres = books.map((book) => ({
            id: book.id,
            title: book.title,
            isbn: book.isbn,
            genreCount: book.genreMappings?.length || 0,
            genres:
                book.genreMappings
                    ?.map((mapping) => mapping.genre?.name)
                    .filter((name): name is string => name !== undefined) || [],
        }));

        // Find genres with their books
        const genres = await this.getRepo(db, OrmGenreEntity).find({
            relations: { bookMappings: { book: true } },
        });

        const genresWithBooks = genres.map((genre) => ({
            id: genre.id,
            name: genre.name,
            bookCount: genre.bookMappings?.length || 0,
            books:
                genre.bookMappings
                    ?.map((mapping) => mapping.book?.title)
                    .filter((title): title is string => title !== undefined) ||
                [],
        }));

        return Response.json({
            books: booksWithGenres,
            genres: genresWithBooks,
            note: 'Uses the explicit junction entity over "orm_book_genre_mapping" with custom column names (book_id/genre_id)',
        });
    }

    @HttpRoute('GET', '/test/orm/repository/:db/join-table/cleanup')
    async testJoinTableCleanup(@HttpPath('db') db: string): Promise<Response> {
        const books = await this.getRepo(db, OrmBookEntity).find({});
        const genres = await this.getRepo(db, OrmGenreEntity).find({});
        const mappings = await this.getRepo(db, OrmBookGenreEntity).find({});

        let deletedBooks: number | undefined = undefined;
        let deletedGenres: number | undefined = undefined;

        if (mappings.length > 0) {
            await this.getRepo(db, OrmBookGenreEntity).delete(mappings);
        }

        if (books.length > 0) {
            const result = await this.getRepo(db, OrmBookEntity).delete(books);
            deletedBooks = result.affectedRows;
        }

        if (genres.length > 0) {
            const result = await this.getRepo(db, OrmGenreEntity).delete(
                genres,
            );
            deletedGenres = result.affectedRows;
        }

        return Response.json({
            deletedBooks,
            deletedGenres,
        });
    }
}
