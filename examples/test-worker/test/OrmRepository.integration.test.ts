// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmDeleteResult } from '@system-inc/base-foundation/orm/interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '@system-inc/base-foundation/orm/interfaces/result/OrmInsertResult';
import { OrmUpdateResult } from '@system-inc/base-foundation/orm/interfaces/result/OrmUpdateResult';
import { IntegrationTestEnvironment } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';
import { OrmArticleEntity } from '../source/entities/OrmArticleEntity';
import { OrmAuthorEntity } from '../source/entities/OrmAuthorEntity';
import { OrmBookEntity } from '../source/entities/OrmBookEntity';
import { OrmCategoryEntity } from '../source/entities/OrmCategoryEntity';
import { OrmCommentEntity } from '../source/entities/OrmCommentEntity';
import { OrmCompositeEntity } from '../source/entities/OrmCompositeEntity';
import { OrmGenreEntity } from '../source/entities/OrmGenreEntity';
import { OrmOrderEntity } from '../source/entities/OrmOrderEntity';
import { OrmPostEntity } from '../source/entities/OrmPostEntity';
import { OrmProductEntity } from '../source/entities/OrmProductEntity';
import { OrmTagEntity } from '../source/entities/OrmTagEntity';
import { OrmTestEntity } from '../source/entities/OrmTestEntity';
import { OrmUserEntity } from '../source/entities/OrmUserEntity';

// Type definitions for API responses
interface InsertEntityResponse<T> {
    entity: T;
    result: OrmInsertResult<T>;
}

interface UpdateEntityResponse<T> {
    entity: T;
    result: OrmUpdateResult<T>;
}

interface DeleteEntityResponse<T> {
    entity: T;
    result: OrmDeleteResult<T>;
}

interface BulkInsertResponse<T> {
    count: number;
    result: OrmInsertResult<T>;
}

interface BulkUpdateResponse<T> {
    count: number;
    result: OrmUpdateResult<T>;
}

interface BulkDeleteResponse<T> {
    count: number;
    result: OrmDeleteResult<T>;
}

interface QueryResponse<T> {
    count: number;
    entities: T[];
}

interface OrmBatchResultResponse {
    affectedRows: number;
    results: Array<{ affectedRows?: number; insertedId?: unknown }>;
}

interface WriteBatchResponse<T> {
    result: OrmBatchResultResponse;
    entity?: T;
    entities?: T[];
    count?: number;
}

interface WriteBatchMixedResponse {
    result: OrmBatchResultResponse;
    inserted: OrmTestEntity;
    updatedThenDeleted: OrmTestEntity;
}

interface WriteBatchAtomicityResponse {
    errorMessage?: string;
    persisted: OrmTestEntity | null;
    atomic: boolean;
}

interface FindAndCountResponse<T> {
    totalCount: number;
    pageCount: number;
    entities: T[];
}

interface CountResponse {
    count: number;
}

interface TransactionResponse {
    entity1: OrmTestEntity;
    entity2: OrmTestEntity;
}

interface ChangeTrackingResponse {
    changesBeforeModification: Record<string, unknown>;
    changesAfterModification: Record<string, unknown>;
    changesAfterUpdate: Record<string, unknown>;
    entity: OrmTestEntity;
}

interface RelationsSetupResponse {
    users: OrmUserEntity[];
    posts: OrmPostEntity[];
    comments: OrmCommentEntity[];
}

interface RelationsQueryResponse<T> {
    count: number;
    posts?: T[];
    users?: T[];
}

interface RelationsCleanupResponse {
    deletedComments?: number;
    deletedPosts?: number;
    deletedUsers?: number;
}

const baseUrl = IntegrationTestEnvironment.get().client.getServerBaseUrl();

describe.each(['default', 'd1'])(
    'OrmRepository Integration Tests (%s)',
    (db) => {
        beforeAll(async () => {});

        afterAll(async () => {});

        describe('Basic CRUD Operations', () => {
            afterAll(async () => {
                // Clean up any test data created
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/filters/cleanup`,
                );
            });

            test('insert entity', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const result: InsertEntityResponse<OrmTestEntity> =
                    await response.json();

                // Assert API response
                expect(response.status).toBe(200);
                expect(result.entity).toBeDefined();
                expect(result.entity.id).toBeDefined();
                expect(result.entity.name).toBe('Test Entity');
                expect(result.entity.age).toBe(25);
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBe(1);
                }
                if (result.result.insertedId !== undefined) {
                    expect(result.result.insertedId).toBeDefined();
                }
            });

            test('find one entity', async () => {
                // Arrange - insert an entity first
                const insertResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const insertResult: InsertEntityResponse<OrmTestEntity> =
                    await insertResponse.json();
                const entityId = insertResult.entity.id;

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/find-one/${entityId}`,
                    );
                const entity: OrmTestEntity = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(entity.id).toBe(entityId);
                expect(entity.name).toBe('Test Entity');
                expect(entity.age).toBe(25);
            });

            test('update entity', async () => {
                // Arrange - insert an entity first
                const insertResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const insertResult: InsertEntityResponse<OrmTestEntity> =
                    await insertResponse.json();
                const entityId = insertResult.entity.id;

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/update/${entityId}/UpdatedName/99`,
                    );
                const result: UpdateEntityResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.entity.name).toBe('UpdatedName');
                expect(result.entity.age).toBe(99);
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBeGreaterThanOrEqual(
                        1,
                    );
                }

                // Verify the update persisted
                const verifyResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/find-one/${entityId}`,
                    );
                const verifyEntity: OrmTestEntity = await verifyResponse.json();
                expect(verifyEntity.name).toBe('UpdatedName');
                expect(verifyEntity.age).toBe(99);
            });

            test('upsert entity - insert case', async () => {
                const newId = crypto.randomUUID();

                // Act - upsert with new ID (should insert)
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/upsert/${newId}/UpsertInsert/77`,
                    );
                const result: UpdateEntityResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.entity.id).toBe(newId);
                expect(result.entity.name).toBe('UpsertInsert');
                expect(result.entity.age).toBe(77);
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBeGreaterThanOrEqual(
                        1,
                    );
                }
            });

            test('upsert entity - update case', async () => {
                // Arrange - insert an entity first
                const insertResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const insertResult: InsertEntityResponse<OrmTestEntity> =
                    await insertResponse.json();
                const entityId = insertResult.entity.id;

                // Act - upsert with existing ID (should update)
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/upsert/${entityId}/UpsertUpdate/88`,
                    );
                const result: UpdateEntityResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.entity.name).toBe('UpsertUpdate');
                expect(result.entity.age).toBe(88);
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBeGreaterThanOrEqual(
                        1,
                    );
                }
            });

            test('delete entity', async () => {
                // Arrange - insert an entity first
                const insertResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const insertResult: InsertEntityResponse<OrmTestEntity> =
                    await insertResponse.json();
                const entityId = insertResult.entity.id;

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/delete/${entityId}`,
                    );
                const result: DeleteEntityResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                if (result.result.affectedRows !== undefined) {
                    console.log(
                        'OrmRepository.integration.test.ts - delete result',
                        result,
                    );
                    expect(result.result.affectedRows).toBeGreaterThanOrEqual(
                        1,
                    );
                }

                // Verify the entity was deleted
                const verifyResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/find-one/${entityId}`,
                    );
                expect(verifyResponse.status).toBe(404);
            });
        });

        describe('Batch Operations', () => {
            afterEach(async () => {
                // Clean up any test data created
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/filters/cleanup`,
                );
            });

            test('bulk insert', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert-bulk`,
                    );
                const result: BulkInsertResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBe(5);
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBe(5);
                }
            });

            test('bulk update', async () => {
                // Arrange - insert some entities first
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/insert-bulk`,
                );

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/update-bulk`,
                    );
                const result: BulkUpdateResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBeGreaterThan(0);
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBeGreaterThan(0);
                }
            });

            test('bulk upsert', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/upsert-bulk`,
                    );
                const result: BulkInsertResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBe(3);
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBeGreaterThanOrEqual(
                        3,
                    );
                }
            });

            test('bulk delete', async () => {
                // Arrange - ensure we have entities to delete
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/insert-bulk`,
                );

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/delete-bulk`,
                    );
                const result: BulkDeleteResponse<OrmTestEntity> =
                    await response.json();

                // Assert - should either delete entities or return 404 if none exist
                if (response.status === 200) {
                    expect(result.count).toBeGreaterThan(0);
                    if (result.result.affectedRows !== undefined) {
                        expect(result.result.affectedRows).toBeGreaterThan(0);
                    }
                } else {
                    expect(response.status).toBe(404);
                }
            });
        });

        describe('WriteBatch Operations', () => {
            afterEach(async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/write-batch/cleanup`,
                );
            });

            test('empty batch returns zero affected rows', async () => {
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/write-batch/empty`,
                    );
                const result: WriteBatchResponse<OrmTestEntity> =
                    await response.json();

                expect(response.status).toBe(200);
                expect(result.result.affectedRows).toBe(0);
                expect(result.result.results).toHaveLength(0);
            });

            test('single insert via writeBatch', async () => {
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/write-batch/insert-single`,
                    );
                const result: WriteBatchResponse<OrmTestEntity> =
                    await response.json();

                expect(response.status).toBe(200);
                expect(result.entity).toBeDefined();
                expect(result.entity!.name).toBe('WriteBatch Single');
                expect(result.result.results).toHaveLength(1);
            });

            test('multi-row insert produces a single insert op', async () => {
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/write-batch/insert-multi`,
                    );
                const result: WriteBatchResponse<OrmTestEntity> =
                    await response.json();

                expect(response.status).toBe(200);
                expect(result.count).toBe(3);
                // Three entities go into ONE insert op (not three).
                expect(result.result.results).toHaveLength(1);
            });

            test('update via writeBatch', async () => {
                // Arrange: seed an entity to update
                const insertResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const insertResult: InsertEntityResponse<OrmTestEntity> =
                    await insertResponse.json();
                const id = insertResult.entity.id;

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/write-batch/update/${id}/WriteBatchUpdated/42`,
                    );
                const result: WriteBatchResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.entity!.name).toBe('WriteBatchUpdated');
                expect(result.entity!.age).toBe(42);

                // Verify persistence
                const verifyResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/find-one/${id}`,
                    );
                const verifyEntity: OrmTestEntity = await verifyResponse.json();
                expect(verifyEntity.name).toBe('WriteBatchUpdated');
            });

            test('delete via writeBatch', async () => {
                // Arrange
                const insertResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const insertResult: InsertEntityResponse<OrmTestEntity> =
                    await insertResponse.json();
                const id = insertResult.entity.id;

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/write-batch/delete/${id}`,
                    );

                // Assert
                expect(response.status).toBe(200);
                const verifyResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/find-one/${id}`,
                    );
                // The entity should be gone (404 or null).
                expect(
                    verifyResponse.status === 404 ||
                        verifyResponse.status === 200,
                ).toBe(true);
                if (verifyResponse.status === 200) {
                    const body = await verifyResponse.json();
                    expect(body).toBeNull();
                }
            });

            test('upsert insert case uses native ON CONFLICT semantics', async () => {
                const newId = crypto.randomUUID();
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/write-batch/upsert-insert/${newId}/UpsertViaBatch/55`,
                    );
                const result: WriteBatchResponse<OrmTestEntity> =
                    await response.json();

                expect(response.status).toBe(200);
                expect(result.entity!.id).toBe(newId);
                expect(result.entity!.name).toBe('UpsertViaBatch');
            });

            test('upsert update case (PK already exists) updates without separate read', async () => {
                // Arrange: insert an entity, then upsert with the same PK
                const insertResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const insertResult: InsertEntityResponse<OrmTestEntity> =
                    await insertResponse.json();
                const id = insertResult.entity.id;

                // Act — upsert with same PK should update
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/write-batch/upsert-update/${id}/UpsertConflict/88`,
                    );
                const result: WriteBatchResponse<OrmTestEntity> =
                    await response.json();

                expect(response.status).toBe(200);

                // Verify: the row at this PK now has the upserted values
                const verifyResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/find-one/${id}`,
                    );
                const verifyEntity: OrmTestEntity = await verifyResponse.json();
                expect(verifyEntity.id).toBe(id);
                expect(verifyEntity.name).toBe('UpsertConflict');
                expect(verifyEntity.age).toBe(88);
                // Sanity check we didn't break the response shape
                expect(result.result.results.length).toBeGreaterThanOrEqual(1);
            });

            test('mixed kinds (insert + update + delete) in one batch', async () => {
                // Arrange: seed a victim entity
                const insertResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const insertResult: InsertEntityResponse<OrmTestEntity> =
                    await insertResponse.json();
                const victimId = insertResult.entity.id;

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/write-batch/mixed/${victimId}`,
                    );
                const result: WriteBatchMixedResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.result.results).toHaveLength(3); // insert + update + delete

                // The victim was updated then deleted — should be gone.
                const verifyResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/find-one/${victimId}`,
                    );
                if (verifyResponse.status === 200) {
                    const body = await verifyResponse.json();
                    expect(body).toBeNull();
                }
            });

            test('atomicity: failed op rolls back the rest', async () => {
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/write-batch/atomicity`,
                    );
                const result: WriteBatchAtomicityResponse =
                    await response.json();

                expect(response.status).toBe(200);
                expect(result.errorMessage).toBeDefined();
                expect(result.persisted).toBeNull();
                expect(result.atomic).toBe(true);
            });
        });

        describe('Query Operations', () => {
            beforeEach(async () => {
                // Insert test data for queries
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/insert-bulk`,
                );
            });

            afterEach(async () => {
                // Clean up test data after each test
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/filters/cleanup`,
                );
            });

            test('find all entities', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/find-all`,
                    );
                const result: QueryResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBeGreaterThan(0);
                expect(Array.isArray(result.entities)).toBe(true);
            });

            test('find with conditions', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/find-with-conditions`,
                    );
                const result: QueryResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(Array.isArray(result.entities)).toBe(true);
                // All returned entities should have age = 30
                result.entities.forEach((entity: OrmTestEntity) => {
                    expect(entity.age).toBe(30);
                });
            });

            test('find and count', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/find-and-count`,
                    );
                const result: FindAndCountResponse<OrmTestEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.totalCount).toBeGreaterThanOrEqual(0);
                expect(result.pageCount).toBeLessThanOrEqual(5); // limit was 5
                expect(Array.isArray(result.entities)).toBe(true);
            });

            test('count entities', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/count`,
                    );
                const result: CountResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(typeof result.count).toBe('number');
                expect(result.count).toBeGreaterThanOrEqual(0);
            });
        });

        // D1 has no interactive transactions — see WriteBatch Operations.
        (db === 'd1' ? describe.skip : describe)('Transaction Support', () => {
            afterAll(async () => {
                // Clean up any test data created
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/filters/cleanup`,
                );
            });

            test('transaction operations', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/transaction`,
                    );
                const result: TransactionResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.entity1).toBeDefined();
                expect(result.entity2).toBeDefined();
                expect(result.entity1.age).toBe(333); // Should be updated value
                expect(result.entity2.age).toBe(222);
            });
        });

        describe('Composite Key Operations', () => {
            test('insert composite entity', async () => {
                const userId = crypto.randomUUID();
                const projectId = crypto.randomUUID();

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/composite/insert/${userId}/${projectId}/admin`,
                    );
                const result: InsertEntityResponse<OrmCompositeEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.entity.userId).toBe(userId);
                expect(result.entity.projectId).toBe(projectId);
                expect(result.entity.role).toBe('admin');
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBe(1);
                }
            });

            test('update composite entity', async () => {
                // Arrange - insert first
                const userId = crypto.randomUUID();
                const projectId = crypto.randomUUID();
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl +
                        `/test/orm/repository/${db}/composite/insert/${userId}/${projectId}/member`,
                );

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/composite/update/${userId}/${projectId}/owner`,
                    );
                const result: UpdateEntityResponse<OrmCompositeEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.entity.role).toBe('owner');
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBeGreaterThanOrEqual(
                        1,
                    );
                }
            });

            test('delete composite entity', async () => {
                // Arrange - insert first
                const userId = crypto.randomUUID();
                const projectId = crypto.randomUUID();
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl +
                        `/test/orm/repository/${db}/composite/insert/${userId}/${projectId}/viewer`,
                );

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/composite/delete/${userId}/${projectId}`,
                    );
                const result: DeleteEntityResponse<OrmCompositeEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                if (result.result.affectedRows !== undefined) {
                    expect(result.result.affectedRows).toBeGreaterThanOrEqual(
                        1,
                    );
                }
            });
        });

        describe('Change Tracking', () => {
            test('change tracking functionality', async () => {
                // Arrange - insert an entity first
                const insertResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/insert`,
                    );
                const insertResult: InsertEntityResponse<OrmTestEntity> =
                    await insertResponse.json();
                const entityId = insertResult.entity.id;

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/change-tracking/${entityId}`,
                    );
                const result: ChangeTrackingResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);

                // Before modification - should have no changes (just loaded from DB)
                expect(
                    Object.keys(result.changesBeforeModification).length,
                ).toBe(0);

                // After modification - should have changes for name and age
                expect(result.changesAfterModification.name).toBe(
                    'Modified Name',
                );
                expect(result.changesAfterModification.age).toBe(999);

                // After update - changes should be cleared
                expect(Object.keys(result.changesAfterUpdate).length).toBe(0);

                // Entity should have the new values
                expect(result.entity.name).toBe('Modified Name');
                expect(result.entity.age).toBe(999);
            });
        });

        describe('Relations Operations', () => {
            beforeAll(async () => {
                // Clean up any existing data before starting relations tests
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/relations/cleanup`,
                );
            });

            afterAll(async () => {
                // Clean up after all relations tests
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/relations/cleanup`,
                );
            });

            test('setup test data for relations', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/relations/setup`,
                    );
                const result: RelationsSetupResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.users).toHaveLength(2);
                expect(result.posts).toHaveLength(3);
                expect(result.comments).toHaveLength(3);

                // Verify user data
                expect(result.users[0].username).toBe('john_doe');
                expect(result.users[1].username).toBe('jane_smith');

                // Verify post data
                expect(result.posts[0].authorId).toBe(result.users[0].id);
                expect(result.posts[2].authorId).toBe(result.users[1].id);

                // Verify comment data
                expect(result.comments[0].postId).toBe(result.posts[0].id);
                expect(result.comments[0].authorId).toBe(result.users[1].id);
            });

            test('find posts with author relation', async () => {
                // Arrange - ensure test data exists
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/relations/setup`,
                );

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/find-with-author`,
                    );
                const result: RelationsQueryResponse<OrmPostEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBeGreaterThan(0);
                expect(result.posts).toBeDefined();

                // Verify that posts have author loaded
                const postsWithAuthor = result.posts!;
                postsWithAuthor.forEach((post: OrmPostEntity) => {
                    expect(post.author).toBeDefined();
                    expect(post.author?.id).toBe(post.authorId);
                });
            });

            test('find users with posts relation', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/find-with-posts`,
                    );
                const result: RelationsQueryResponse<OrmUserEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBeGreaterThan(0);
                expect(result.users).toBeDefined();

                // Verify that users have posts loaded
                const usersWithPosts = result.users!;
                expect(
                    usersWithPosts.some(
                        (user: OrmUserEntity) =>
                            user.posts && user.posts.length > 0,
                    ),
                ).toBe(true);
            });

            test('find with nested relations', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/find-with-nested`,
                    );
                const result: RelationsQueryResponse<OrmUserEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBeGreaterThan(0);
                expect(result.users).toBeDefined();

                // Verify nested relations are loaded
                const usersWithNested = result.users!;
                const userWithPosts = usersWithNested.find(
                    (user: OrmUserEntity) =>
                        user.posts && user.posts.length > 0,
                );

                if (userWithPosts) {
                    expect(userWithPosts.posts).toBeDefined();
                    // Check if any post has comments
                    const postWithComments = userWithPosts.posts?.find(
                        (post: OrmPostEntity) =>
                            post.comments && post.comments.length > 0,
                    );
                    if (postWithComments) {
                        expect(postWithComments.comments).toBeDefined();
                    }
                }
            });

            test('find posts with all relations', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/find-post-with-all`,
                    );
                const result: RelationsQueryResponse<OrmPostEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBeGreaterThan(0);
                expect(result.posts).toBeDefined();

                // Verify all relations are loaded
                const postsWithAll = result.posts!;
                postsWithAll.forEach((post: OrmPostEntity) => {
                    expect(post.author).toBeDefined();
                    if (post.comments && post.comments.length > 0) {
                        post.comments.forEach((comment: OrmCommentEntity) => {
                            expect(comment.author).toBeDefined();
                        });
                    }
                });
            });

            test('find one with deep relations', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/find-one-with-relations/john_doe`,
                    );
                const user: OrmUserEntity = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(user.username).toBe('john_doe');
                expect(user.posts).toBeDefined();
                expect(Array.isArray(user.posts)).toBe(true);

                // Check nested relations
                if (user.posts && user.posts.length > 0) {
                    user.posts.forEach((post: OrmPostEntity) => {
                        if (post.comments && post.comments.length > 0) {
                            post.comments.forEach(
                                (comment: OrmCommentEntity) => {
                                    expect(comment.author).toBeDefined();
                                },
                            );
                        }
                    });
                }

                // Check user comments
                if (user.comments && user.comments.length > 0) {
                    user.comments.forEach((comment: OrmCommentEntity) => {
                        expect(comment.post).toBeDefined();
                    });
                }
            });

            test('filters posts by a to-one relation column (author.username)', async () => {
                // Arrange
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/relations/setup`,
                );

                // Act — OrmPostEntity has no username; filter through `author`.
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/find-posts-by-author-username/john_doe`,
                    );
                const result: RelationsQueryResponse<OrmPostEntity> =
                    await response.json();

                // Assert — every returned post belongs to a john_doe author,
                // proving the EXISTS predicate actually filters by the related
                // column (and didn't just return all posts).
                expect(response.status).toBe(200);
                expect(result.count).toBeGreaterThan(0);
                result.posts!.forEach((post: OrmPostEntity) => {
                    expect(post.author?.username).toBe('john_doe');
                });
            });

            test('relation predicate returns nothing when no related row matches', async () => {
                // Arrange
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/relations/setup`,
                );

                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/find-posts-by-author-username/nobody_xyz`,
                    );
                const result: RelationsQueryResponse<OrmPostEntity> =
                    await response.json();

                // Assert — the filter excludes everything (not a silent no-op).
                expect(response.status).toBe(200);
                expect(result.count).toBe(0);
            });

            test('counts posts by a to-one relation column', async () => {
                // Arrange
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/relations/setup`,
                );

                // Act — exercises the count path (core query, not the RQB).
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/count-posts-by-author-username/jane_smith`,
                    );
                const result: { count: number } = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBeGreaterThan(0);
            });

            test('filters posts by a to-many relation column (comments.authorId)', async () => {
                // Arrange — capture this batch's ids so the assertion isolates
                // to exactly this seed (authorId is unique per setup).
                const setupResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/relations/setup`,
                    );
                const setup: RelationsSetupResponse =
                    await setupResponse.json();
                const jane = setup.users[1]; // jane_smith
                const postJaneCommentedOn = setup.posts[0]; // jane commented here

                // Act — posts that have a comment authored by jane.
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/find-posts-by-comment-author/${jane.id}`,
                    );
                const result: RelationsQueryResponse<OrmPostEntity> =
                    await response.json();

                // Assert — exactly the one post jane commented on in this batch.
                expect(response.status).toBe(200);
                expect(result.posts!.map((post) => post.id)).toEqual([
                    postJaneCommentedOn.id,
                ]);
            });

            test('cleanup relations test data', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/relations/cleanup`,
                    );
                const result: RelationsCleanupResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                if (result.deletedComments !== undefined) {
                    expect(result.deletedComments).toBeGreaterThanOrEqual(0);
                }
                if (result.deletedPosts !== undefined) {
                    expect(result.deletedPosts).toBeGreaterThanOrEqual(0);
                }
                if (result.deletedUsers !== undefined) {
                    expect(result.deletedUsers).toBeGreaterThanOrEqual(0);
                }
            });
        });

        describe('Filter Operators', () => {
            interface FilterTestResponse {
                filter: string;
                count: number;
                entities: OrmTestEntity[];
            }

            interface FilterSetupResponse {
                message: string;
                count: number;
                deletedCount?: number;
            }

            interface FilterCleanupResponse {
                message: string;
                deletedCount: number;
            }

            beforeAll(async () => {
                // Clean up any existing test data first
                const cleanupResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/filters/cleanup`,
                    );
                const cleanupResult: FilterCleanupResponse =
                    await cleanupResponse.json();
                console.log('Pre-test cleanup:', cleanupResult);

                // Setup test data for filter tests
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/filters/setup`,
                    );
                expect(response.status).toBe(200);
                const result: FilterSetupResponse = await response.json();
                expect(result.count).toBe(7);

                // Verify we have exactly the data we expect
                const verifyResponse =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/find-all`,
                    );
                const verifyResult: QueryResponse<OrmTestEntity> =
                    await verifyResponse.json();
                console.log('Total entities after setup:', verifyResult.count);
                console.log(
                    'Entities with age 30:',
                    verifyResult.entities.filter(
                        (e: OrmTestEntity) => e.age === 30,
                    ).length,
                );
            });

            afterAll(async () => {
                // Cleanup filter test data
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/filters/cleanup`,
                );
            });

            describe('Comparison Operators', () => {
                test('equals filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/equals/30`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age equals 30');
                    expect(result.count).toBe(2); // Bob and Frank
                    result.entities.forEach((entity) => {
                        expect(entity.age).toBe(30);
                    });
                });

                test('not equals filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/not-equals/30`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age not equals 30');
                    expect(result.count).toBe(5); // All except Bob and Frank
                    result.entities.forEach((entity) => {
                        expect(entity.age).not.toBe(30);
                    });
                });

                test('greater than filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/greater-than/35`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age > 35');
                    expect(result.count).toBe(2); // David(40) and Eve(45)
                    result.entities.forEach((entity) => {
                        expect(entity.age).toBeGreaterThan(35);
                    });
                });

                test('greater than or equals filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/greater-than-equals/35`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age >= 35');
                    expect(result.count).toBe(4); // Charlie(35), Grace(35), David(40), Eve(45)
                    result.entities.forEach((entity) => {
                        expect(entity.age).toBeGreaterThanOrEqual(35);
                    });
                });

                test('less than filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/less-than/35`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age < 35');
                    expect(result.count).toBe(3); // Alice(25), Bob(30), Frank(30)
                    result.entities.forEach((entity) => {
                        expect(entity.age).toBeLessThan(35);
                    });
                });

                test('less than or equals filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/less-than-equals/35`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age <= 35');
                    expect(result.count).toBe(5); // Alice(25), Bob(30), Frank(30), Charlie(35), Grace(35)
                    result.entities.forEach((entity) => {
                        expect(entity.age).toBeLessThanOrEqual(35);
                    });
                });
            });

            describe('Array Operators', () => {
                test('in array filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/in-array`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age in [25, 35, 45]');
                    expect(result.count).toBe(4); // Alice(25), Charlie(35), Grace(35), Eve(45)
                    result.entities.forEach((entity) => {
                        expect([25, 35, 45]).toContain(entity.age);
                    });
                });

                test('not in array filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/not-in-array`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age not in [30, 40]');
                    expect(result.count).toBe(4); // Alice(25), Charlie(35), Grace(35), Eve(45)
                    result.entities.forEach((entity) => {
                        expect([30, 40]).not.toContain(entity.age);
                    });
                });
            });

            describe('Range Operators', () => {
                test('between filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/between/30/40`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age between 30 and 40');
                    expect(result.count).toBe(5); // Bob(30), Frank(30), Charlie(35), Grace(35), David(40)
                    result.entities.forEach((entity) => {
                        expect(entity.age).toBeGreaterThanOrEqual(30);
                        expect(entity.age).toBeLessThanOrEqual(40);
                    });
                });

                test('not between filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/not-between/30/40`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('age not between 30 and 40');
                    expect(result.count).toBe(2); // Alice(25), Eve(45)
                    result.entities.forEach((entity) => {
                        expect(entity.age < 30 || entity.age > 40).toBe(true);
                    });
                });
            });

            describe('Pattern Matching Operators', () => {
                test('like filter - starts with', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/like/D%25`, // URL encode %
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe("name like 'D%'"); // Server will have decoded %25 to %
                    expect(result.count).toBe(1); // David
                    result.entities.forEach((entity) => {
                        expect(entity.name).toMatch(/^D/);
                    });
                });

                test('like filter - contains', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/like/%25a%25`, // URL encode %
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe("name like '%a%'");
                    expect(result.count).toBe(5); // Alice, Charlie, David, Frank, Grace (contains 'a')
                    result.entities.forEach((entity) => {
                        expect(entity.name.toLowerCase()).toContain('a');
                    });
                });

                test('not like filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/not-like/%25e`, // URL encode %
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe("name not like '%e'");
                    // Names ending with 'e': Alice, Charlie, Eve, Grace (4)
                    // Names NOT ending with 'e': Bob, David, Frank (3)
                    expect(result.count).toBe(3);
                    result.entities.forEach((entity) => {
                        expect(entity.name).not.toMatch(/e$/);
                    });
                });
            });

            describe('Null Operators', () => {
                test('is null filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/is-null`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('email is null');
                    expect(result.count).toBe(2); // Charlie and Eve
                    result.entities.forEach((entity) => {
                        expect(entity.email).toBeNull();
                    });
                });

                test('is not null filter', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/is-not-null`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe('email is not null');
                    expect(result.count).toBe(5); // Alice, Bob, David, Frank, Grace
                    result.entities.forEach((entity) => {
                        expect(entity.email).not.toBeNull();
                    });
                });
            });

            describe('Complex Queries', () => {
                test('multiple filters combined', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/complex`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe(
                        "age >= 30 AND name like '%a%' AND email is not null",
                    );
                    // Should get David(40), Frank(30), Grace(35) - all have age >= 30, contain 'a', and have email
                    expect(result.count).toBe(3);
                    result.entities.forEach((entity) => {
                        expect(entity.age).toBeGreaterThanOrEqual(30);
                        expect(entity.name.toLowerCase()).toContain('a');
                        expect(entity.email).not.toBeNull();
                    });
                });

                test('backward compatibility - direct values', async () => {
                    const response =
                        await IntegrationTestEnvironment.get().client.sendRequest(
                            baseUrl +
                                `/test/orm/repository/${db}/filters/backward-compat`,
                        );
                    const result: FilterTestResponse = await response.json();

                    expect(response.status).toBe(200);
                    expect(result.filter).toBe(
                        'age = 30 (using direct value, not filter object)',
                    );
                    expect(result.count).toBe(2); // Bob and Frank
                    result.entities.forEach((entity) => {
                        expect(entity.age).toBe(30);
                    });
                });
            });
        });

        describe('Default Values Support', () => {
            interface DefaultValuesTestResponse<T> {
                entity?: T;
                product?: T;
                order?: T;
                category?: T;
                tag?: T;
                defaultsApplied: Record<string, boolean>;
            }

            beforeAll(async () => {
                // Clean up any leftover data from prior runs so the suite
                // starts from a known clean state (Tag/Category names are reused
                // across tests and unique constraints will fail otherwise).
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/test-data/cleanup`,
                );
            });

            afterAll(async () => {
                // Clean up test data
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/test-data/cleanup`,
                );
            });

            test('product entity default values', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/defaults/create-product`,
                    );
                const result: DefaultValuesTestResponse<OrmProductEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.product).toBeDefined();

                // Verify all defaults were applied
                expect(result.defaultsApplied.description).toBe(true);
                expect(result.defaultsApplied.price).toBe(true);
                expect(result.defaultsApplied.stockQuantity).toBe(true);
                expect(result.defaultsApplied.isActive).toBe(true);
                expect(result.defaultsApplied.status).toBe(true);
                expect(result.defaultsApplied.weight).toBe(true);
                expect(result.defaultsApplied.publishedAt).toBe(true);

                // Verify actual values
                expect(result.product!.description).toBe(
                    'No description available',
                );
                expect(result.product!.price).toBe(99.99);
                expect(result.product!.stockQuantity).toBe(10);
                expect(result.product!.isActive).toBe(true);
                expect(result.product!.status).toBe('draft');
                expect(result.product!.weight).toBe(0);
            });

            test('order entity function-based defaults', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/defaults/create-order`,
                    );
                const result: DefaultValuesTestResponse<OrmOrderEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.order).toBeDefined();

                // Verify function-based defaults were applied
                expect(result.defaultsApplied.orderNumber).toBe(true);
                expect(result.defaultsApplied.status).toBe(true);
                expect(result.defaultsApplied.subtotal).toBe(true);
                expect(result.defaultsApplied.tax).toBe(true);
                expect(result.defaultsApplied.shipping).toBe(true);
                expect(result.defaultsApplied.total).toBe(true);
                expect(result.defaultsApplied.currency).toBe(true);
                expect(result.defaultsApplied.orderDate).toBe(true);

                // Verify generated order number and default values
                expect(result.order!.orderNumber).toMatch(/^ORD-\d+$/);
                expect(result.order!.status).toBe('pending');
                expect(result.order!.subtotal).toBe(0); // Testing falsy default
                expect(result.order!.tax).toBe(8.5);
                expect(result.order!.shipping).toBe(12.0);
                expect(result.order!.total).toBe(20.5);
                expect(result.order!.currency).toBe('USD');
            });

            test('category entity boolean and numeric defaults', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/defaults/create-category`,
                    );
                const result: DefaultValuesTestResponse<OrmCategoryEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.category).toBeDefined();

                // Verify defaults
                expect(result.defaultsApplied.sortOrder).toBe(true);
                expect(result.defaultsApplied.isVisible).toBe(true);

                expect(result.category!.sortOrder).toBe(0);
                expect(result.category!.isVisible).toBe(true);
            });

            test('tag entity with varchar primary key defaults', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/defaults/create-tag`,
                    );
                const result: DefaultValuesTestResponse<OrmTagEntity> =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.tag).toBeDefined();

                // Verify defaults
                expect(result.defaultsApplied.color).toBe(true);
                expect(result.defaultsApplied.usageCount).toBe(true);

                expect(result.tag!.color).toBe('#000000');
                expect(result.tag!.usageCount).toBe(0);
                expect(result.tag!.name).toBe('featured');
            });
        });

        describe('Many-to-Many Relationships', () => {
            interface ManyToManySetupResponse {
                categories: Array<{ id: number; name: string }>;
                tags: Array<{ name: string; color: string }>;
                products: Array<{ id: string; name: string; sku: string }>;
            }

            interface ManyToManyAssignResponse {
                message: string;
                product: { id: string; name: string };
                categories: Array<{ id: number; name: string }>;
                note: string;
            }

            interface ManyToManyRelationsResponse {
                count: number;
                products: Array<{
                    id: string;
                    name: string;
                    sku: string;
                    categoriesCount: number;
                    tagsCount: number;
                }>;
                note: string;
            }

            interface ManyToManyCleanupResponse {
                deletedProducts?: number;
                deletedCategories?: number;
                deletedTags?: number;
            }

            beforeAll(async () => {
                // Clean up any existing data
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/many-to-many/cleanup`,
                );
            });

            afterAll(async () => {
                // Clean up test data
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/many-to-many/cleanup`,
                );
            });

            test('setup many-to-many test data', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/many-to-many/setup`,
                    );
                const result: ManyToManySetupResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.categories).toHaveLength(3);
                expect(result.tags).toHaveLength(3);
                expect(result.products).toHaveLength(3);

                // Verify categories
                expect(result.categories.map((c) => c.name)).toEqual(
                    expect.arrayContaining([
                        'Electronics',
                        'Clothing',
                        'Books',
                    ]),
                );

                // Verify tags
                expect(result.tags.map((t) => t.name)).toEqual(
                    expect.arrayContaining(['new', 'sale', 'featured']),
                );

                // Verify products
                expect(result.products.map((p) => p.name)).toEqual(
                    expect.arrayContaining([
                        'Laptop',
                        'T-Shirt',
                        'Programming Book',
                    ]),
                );
            });

            test('demonstrate many-to-many relationship structure', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/many-to-many/assign-categories`,
                    );
                const result: ManyToManyAssignResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.message).toBe(
                    'Many-to-many relationship structure exists',
                );
                expect(result.product).toBeDefined();
                expect(result.categories).toBeDefined();
                expect(result.categories.length).toBeGreaterThan(0);
                expect(result.note).toContain('orm_product_categories');
            });

            test('find products with many-to-many relations', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/many-to-many/find-with-relations`,
                    );
                const result: ManyToManyRelationsResponse =
                    await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.count).toBeGreaterThan(0);
                expect(result.products).toBeDefined();
                expect(Array.isArray(result.products)).toBe(true);

                // Verify product structure
                result.products.forEach((product) => {
                    expect(product.id).toBeDefined();
                    expect(product.name).toBeDefined();
                    expect(product.sku).toBeDefined();
                    expect(typeof product.categoriesCount).toBe('number');
                    expect(typeof product.tagsCount).toBe('number');
                });
            });

            test('cleanup many-to-many test data', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/many-to-many/cleanup`,
                    );
                const result: ManyToManyCleanupResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                if (result.deletedProducts !== undefined) {
                    expect(result.deletedProducts).toBeGreaterThanOrEqual(0);
                }
                if (result.deletedCategories !== undefined) {
                    expect(result.deletedCategories).toBeGreaterThanOrEqual(0);
                }
                if (result.deletedTags !== undefined) {
                    expect(result.deletedTags).toBeGreaterThanOrEqual(0);
                }
            });
        });

        describe('Index and Unique Constraints', () => {
            interface ConstraintTestResponse {
                success: boolean;
                message: string;
                error?: string;
                created?: Array<{
                    name: string;
                    sku: string;
                    vendorCode: string | null;
                }>;
            }

            interface IndexTestResponse {
                indexedQueries: {
                    skuIndex: {
                        found: boolean;
                        timeMs: number;
                    };
                    compositePriceStatusIndex: {
                        count: number;
                        timeMs: number;
                    };
                };
                note: string;
            }

            interface ConstraintCleanupResponse {
                deletedProducts?: number;
                deletedOrders?: number;
                deletedCategories?: number;
                deletedTags?: number;
            }

            afterAll(async () => {
                // Clean up test data
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/repository/${db}/test-data/cleanup`,
                );
            });

            test('unique SKU constraint enforcement', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/constraints/test-unique-sku`,
                    );
                const result: ConstraintTestResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.success).toBe(true);
                expect(result.message).toBe(
                    'Unique constraint properly enforced',
                );
                expect(result.error).toBeDefined();
            });

            test('composite unique constraint enforcement', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/constraints/test-composite-unique`,
                    );
                const result: ConstraintTestResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.success).toBe(true);
                expect(result.message).toBe(
                    'Composite unique constraint properly enforced',
                );
                expect(result.created).toBeDefined();
                expect(result.created).toHaveLength(2);

                // Verify the two successfully created products
                const [product1, product2] = result.created!;
                expect(product1.vendorCode).toBe(product2.vendorCode);
                expect(product1.sku).not.toBe(product2.sku);
            });

            test('indexed column queries', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/constraints/test-indexes`,
                    );
                const result: IndexTestResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.indexedQueries).toBeDefined();

                // Verify SKU index query
                expect(result.indexedQueries.skuIndex.found).toBe(true);
                expect(typeof result.indexedQueries.skuIndex.timeMs).toBe(
                    'number',
                );

                // Verify composite index query
                expect(
                    result.indexedQueries.compositePriceStatusIndex.count,
                ).toBeGreaterThanOrEqual(0);
                expect(
                    typeof result.indexedQueries.compositePriceStatusIndex
                        .timeMs,
                ).toBe('number');

                expect(result.note).toContain(
                    'Indexes improve query performance',
                );
            });

            test('cleanup constraint test data', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/test-data/cleanup`,
                    );
                const result: ConstraintCleanupResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                if (result.deletedProducts !== undefined) {
                    expect(result.deletedProducts).toBeGreaterThanOrEqual(0);
                }
                if (result.deletedOrders !== undefined) {
                    expect(result.deletedOrders).toBeGreaterThanOrEqual(0);
                }
            });
        });

        describe('OrmJoinColumn decorator', () => {
            interface JoinColumnSetupResponse {
                authors: InsertEntityResponse<OrmAuthorEntity>[];
                articles: InsertEntityResponse<OrmArticleEntity>[];
            }

            interface JoinColumnTestResponse {
                articlesCount: number;
                articles: Array<{
                    id: string;
                    title: string;
                    authorId: string;
                    authorName?: string;
                    authorEmail?: string;
                }>;
                note: string;
            }

            interface JoinColumnCleanupResponse {
                deletedArticles?: number;
                deletedAuthors?: number;
            }

            test('setup test data with OrmJoinColumn', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/join-column/setup`,
                    );
                const result: JoinColumnSetupResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.authors).toHaveLength(2);
                expect(result.articles).toHaveLength(3);

                // Verify authors were created
                result.authors.forEach((author) => {
                    if (author.result.affectedRows !== undefined) {
                        expect(author.result.affectedRows).toBe(1);
                    }
                    expect(author.entity).toBeDefined();
                    expect(author.entity.id).toBeDefined();
                    expect(author.entity.name).toBeDefined();
                    expect(author.entity.email).toBeDefined();
                    expect(author.entity.code).toBeDefined();
                });

                // Verify articles were created
                result.articles.forEach((article) => {
                    if (article.result.affectedRows !== undefined) {
                        expect(article.result.affectedRows).toBe(1);
                    }
                    expect(article.entity).toBeDefined();
                    expect(article.entity.id).toBeDefined();
                    expect(article.entity.title).toBeDefined();
                    expect(article.entity.content).toBeDefined();
                    expect(article.entity.authorId).toBeDefined();
                });
            });

            test('test relations with custom join column name', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/join-column/test-relation`,
                    );
                const result: JoinColumnTestResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.articlesCount).toBeGreaterThan(0);
                expect(result.articles).toBeDefined();
                expect(Array.isArray(result.articles)).toBe(true);

                // Verify each article has its author loaded
                result.articles.forEach((article) => {
                    expect(article.id).toBeDefined();
                    expect(article.title).toBeDefined();
                    expect(article.authorId).toBeDefined();
                    expect(article.authorName).toBeDefined();
                    expect(article.authorEmail).toBeDefined();
                });

                // Check note mentions the custom column name
                expect(result.note).toContain('writer_id');
                expect(result.note).toContain('OrmJoinColumn');
            });

            test('cleanup OrmJoinColumn test data', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/join-column/cleanup`,
                    );
                const result: JoinColumnCleanupResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                if (result.deletedArticles !== undefined) {
                    expect(result.deletedArticles).toBeGreaterThanOrEqual(0);
                }
                if (result.deletedAuthors !== undefined) {
                    expect(result.deletedAuthors).toBeGreaterThanOrEqual(0);
                }
            });
        });

        describe('Junction entity with custom join table', () => {
            interface JoinTableSetupResponse {
                genres: InsertEntityResponse<OrmGenreEntity>[];
                books: InsertEntityResponse<OrmBookEntity>[];
            }

            interface JoinTableTestResponse {
                books: Array<{
                    id: string;
                    title: string;
                    isbn: string;
                    genreCount: number;
                    genres: string[];
                }>;
                genres: Array<{
                    id: string;
                    name: string;
                    bookCount: number;
                    books: string[];
                }>;
                note: string;
            }

            interface JoinTableCleanupResponse {
                deletedBooks?: number;
                deletedGenres?: number;
            }

            test('setup test data with junction entity', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/repository/${db}/join-table/setup`,
                    );
                const result: JoinTableSetupResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                expect(result.genres).toHaveLength(3);
                expect(result.books).toHaveLength(3);

                // Verify genres were created
                result.genres.forEach((genre) => {
                    if (genre.result.affectedRows !== undefined) {
                        expect(genre.result.affectedRows).toBe(1);
                    }
                    expect(genre.entity).toBeDefined();
                    expect(genre.entity.id).toBeDefined();
                    expect(genre.entity.name).toBeDefined();
                });

                // Verify books were created
                result.books.forEach((book) => {
                    if (book.result.affectedRows !== undefined) {
                        expect(book.result.affectedRows).toBe(1);
                    }
                    expect(book.entity).toBeDefined();
                    expect(book.entity.id).toBeDefined();
                    expect(book.entity.title).toBeDefined();
                    expect(book.entity.isbn).toBeDefined();
                    expect(book.entity.pages).toBeDefined();
                });
            });

            test('test many-to-many relations with custom join table', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/join-table/test-many-to-many`,
                    );
                const result: JoinTableTestResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);

                // Verify books have genres
                expect(result.books).toBeDefined();
                expect(Array.isArray(result.books)).toBe(true);
                result.books.forEach((book) => {
                    expect(book.id).toBeDefined();
                    expect(book.title).toBeDefined();
                    expect(book.isbn).toBeDefined();
                    expect(book.genreCount).toBeGreaterThanOrEqual(0);
                    expect(Array.isArray(book.genres)).toBe(true);
                });

                // Verify genres have books
                expect(result.genres).toBeDefined();
                expect(Array.isArray(result.genres)).toBe(true);
                result.genres.forEach((genre) => {
                    expect(genre.id).toBeDefined();
                    expect(genre.name).toBeDefined();
                    expect(genre.bookCount).toBeGreaterThanOrEqual(0);
                    expect(Array.isArray(genre.books)).toBe(true);
                });

                // Check note mentions the custom join table
                expect(result.note).toContain('orm_book_genre_mapping');
                expect(result.note).toContain('junction');
            });

            test('cleanup junction entity test data', async () => {
                // Act
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl +
                            `/test/orm/repository/${db}/join-table/cleanup`,
                    );
                const result: JoinTableCleanupResponse = await response.json();

                // Assert
                expect(response.status).toBe(200);
                if (result.deletedBooks !== undefined) {
                    expect(result.deletedBooks).toBeGreaterThanOrEqual(0);
                }
                if (result.deletedGenres !== undefined) {
                    expect(result.deletedGenres).toBeGreaterThanOrEqual(0);
                }
            });
        });
    },
);
