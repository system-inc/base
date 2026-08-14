// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { IntegrationTestEnvironment } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';

const baseUrl = IntegrationTestEnvironment.get().client.getServerBaseUrl();

// Type definitions for test responses
interface TestEntity {
    id: string;
    name: string;
    age: number;
    email: string | null;
    status: string | null;
}

interface UpdateResult {
    affectedRows: number;
    raw?: unknown;
}

interface InsertResult {
    affectedRows: number;
    raw?: unknown;
    insertedId?: string;
}

interface DeleteResult {
    affectedRows: number;
    raw?: unknown;
}

interface SetupResponse {
    message: string;
    count: number;
    result: InsertResult;
}

interface UpdateResponse {
    updateResult: UpdateResult;
    updatedCount: number;
    updatedEntities: TestEntity[];
}

interface DeleteResponse {
    countBefore: number;
    countAfter: number;
    deleteResult: DeleteResult;
    deletedCount: number;
}

interface BatchResponse {
    deleteResult?: DeleteResult;
    updateResult?: UpdateResult;
    updatedCount?: number;
    updatedEntities?: TestEntity[];
    deletedCount?: number;
    deletedIds?: string[];
    message?: string;
}

interface UpsertResponse {
    upsertResult: InsertResult;
    entity?: TestEntity | null;
    upsertedCount?: number;
    entities?: TestEntity[];
}

interface TransactionResponse {
    transactionResult: {
        update1: UpdateResult;
        update2: UpdateResult;
        insert: InsertResult;
        deleteOp: DeleteResult;
    };
    finalCounts: {
        txActive: number;
        txInactive: number;
        txNew: number;
        pending: number;
    };
}

interface RelatedDataResponse {
    usersCreated: number;
    postsCreated: number;
    users: Array<{ id: string; username: string }>;
}

interface RelatedUpdateResponse {
    userId: string;
    updateResult: UpdateResult;
    updatedPosts: Array<{
        title: string;
        content: string;
    }>;
}

interface PerformanceResponse {
    whereUpdate: {
        time: number;
        affectedRows: number;
    };
    batchUpdate: {
        time: number;
        affectedRows: number;
    };
    analysis: {
        faster: 'where' | 'batch';
        timeDifference: number;
        recommendation: string;
    };
}

interface CleanupResponse {
    message: string;
    deleted: {
        test: number;
        posts: number;
        users: number;
        products: number;
    };
}

interface IncrementDecrementResponse {
    increment1: {
        result: UpdateResult;
        before: number;
        after: number;
        expected: number;
    };
    increment2: {
        result: UpdateResult;
        before: number;
        after: number;
        expected: number;
    };
    decrement1: {
        result: UpdateResult;
        before: number;
        after: number;
        expected: number;
    };
    decrement2: {
        result: UpdateResult;
        before: number;
        after: number;
        expected: number;
    };
    multiIncrement: {
        result: UpdateResult;
        affectedRows: number;
        expectedAffectedRows: number;
        entities: Array<{
            name: string;
            age: number;
            status: string | null;
        }>;
    };
    noMatch: {
        result: UpdateResult;
        affectedRows: number;
        expectedAffectedRows: number;
    };
}

interface RepositoryIncrementDecrementResponse {
    increment: {
        result: UpdateResult;
        before: number;
        after: number;
        expected: number;
    };
    decrement: {
        result: UpdateResult;
        before: number;
        after: number;
        expected: number;
    };
    filterIncrement: {
        result: UpdateResult;
        before: number;
        after: number;
        expected: number;
    };
}

describe.each(['default', 'd1'])('OrmDatabase Integration Tests (%s)', (db) => {
    describe('Setup', () => {
        test('should setup test data', async () => {
            const response =
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );
            const result: SetupResponse = await response.json();

            expect(response.status).toBe(200);
            expect(result.message).toBe('Test data created');
            expect(result.count).toBe(10);
            // Durable SQLite may not provide affectedRows
            if (result.result.affectedRows !== undefined) {
                expect(result.result.affectedRows).toBeGreaterThan(0);
            }
        });
    });

    describe('Raw Execution', () => {
        test('executeRows returns a plain row array on every dialect', async () => {
            const response =
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/execute-rows`,
                );
            const result: {
                rowsIsArray: boolean;
                rows: { name: string; age: number }[];
                rawIsArray: boolean;
            } = await response.json();

            expect(response.status).toBe(200);
            expect(result.rowsIsArray).toBe(true);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0]!.name).toMatch(/^execute-rows-/);
            expect(Number(result.rows[0]!.age)).toBe(42);
            // The raw driver shape differs per dialect — the asymmetry
            // executeRows exists to hide: MySQL resolves to { rows },
            // SQLite to the array itself.
            expect(result.rawIsArray).toBe(db === 'd1');
        });
    });

    describe('Update Operations', () => {
        describe('update() with OrmFindOptionsWhere', () => {
            test('should update entities using gt filter', async () => {
                // Setup fresh data
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/update-where`,
                    );
                const result: UpdateResponse = await response.json();

                expect(response.status).toBe(200);
                // Check affectedRows if available (not all adapters provide it)
                if (result.updateResult.affectedRows !== undefined) {
                    expect(result.updateResult.affectedRows).toBeGreaterThan(0);
                }
                expect(result.updatedCount).toBeGreaterThan(0);

                // All updated entities should have age > 35 and status 'senior'
                result.updatedEntities.forEach((entity) => {
                    expect(entity.age).toBeGreaterThan(35);
                    expect(entity.status).toBe('senior');
                });
            });

            test('should update with complex conditions', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/update-complex`,
                    );
                const result: UpdateResponse = await response.json();

                expect(response.status).toBe(200);
                // Check affectedRows if available (not all adapters provide it)
                if (result.updateResult.affectedRows !== undefined) {
                    expect(result.updateResult.affectedRows).toBeGreaterThan(0);
                }

                // All updated entities should have age >= 30 and status 'veteran'
                result.updatedEntities.forEach((entity) => {
                    expect(entity.age).toBeGreaterThanOrEqual(30);
                    expect(entity.status).toBe('veteran');
                });
            });

            test('should update using like filter', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/update-like`,
                    );
                const result: UpdateResponse = await response.json();

                expect(response.status).toBe(200);

                // All updated entities should have names starting with 'J'
                result.updatedEntities.forEach((entity) => {
                    expect(entity.name).toMatch(/^J/);
                    expect(entity.status).toBe('j-team');
                });
            });

            test('should update using inArray filter', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/update-in-array`,
                    );
                const result: UpdateResponse = await response.json();

                expect(response.status).toBe(200);
                // Check affectedRows if available (not all adapters provide it)
                if (result.updateResult.affectedRows !== undefined) {
                    expect(result.updateResult.affectedRows).toBeGreaterThan(0);
                }

                // All updated entities should have ages in [25, 30, 35]
                result.updatedEntities.forEach((entity) => {
                    expect([25, 30, 35]).toContain(entity.age);
                    expect(entity.status).toBe('selected-age');
                });
            });

            test('should handle update with no matches', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/update-no-match`,
                    );
                const result: { updateResult: UpdateResult; message: string } =
                    await response.json();

                expect(response.status).toBe(200);
                // Check affectedRows if available
                if (result.updateResult.affectedRows !== undefined) {
                    expect(result.updateResult.affectedRows).toBe(0);
                }
            });
        });

        describe('updateBatch() for specific entities', () => {
            test('should update specific entities by ID', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/update-batch`,
                    );
                const result: BatchResponse = await response.json();

                expect(response.status).toBe(200);
                // Check affectedRows if available
                if (result.updateResult?.affectedRows !== undefined) {
                    expect(result.updateResult.affectedRows).toBe(3);
                }
                expect(result.updatedCount || 0).toBe(3);

                // Check that entities were updated correctly
                result.updatedEntities?.forEach((entity, _index) => {
                    expect(entity.status).toMatch(/^batch-updated-\d$/);
                    expect(entity.age).toBeGreaterThan(100); // Original age + 100
                });
            });
        });
    });

    describe('Delete Operations', () => {
        describe('delete() with OrmFindOptionsWhere', () => {
            test('should delete entities using lt filter', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/delete-where`,
                    );
                const result: DeleteResponse = await response.json();

                expect(response.status).toBe(200);
                // Check affectedRows if available
                if (result.deleteResult.affectedRows !== undefined) {
                    expect(result.deleteResult.affectedRows).toBeGreaterThan(0);
                }
                // Check consistency between deletedCount and affectedRows if available
                if (result.deleteResult.affectedRows !== undefined) {
                    expect(result.deletedCount).toBe(
                        result.deleteResult.affectedRows,
                    );
                }
                expect(result.countAfter).toBeLessThan(result.countBefore);
            });

            test('should delete with complex conditions', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/delete-complex`,
                    );
                const result: DeleteResponse = await response.json();

                expect(response.status).toBe(200);
                expect(result.countAfter).toBeLessThan(result.countBefore);
                // Check consistency between deletedCount and affectedRows if available
                if (result.deleteResult.affectedRows !== undefined) {
                    expect(result.deletedCount).toBe(
                        result.deleteResult.affectedRows,
                    );
                }
            });

            test('should handle delete with no matches', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/delete-no-match`,
                    );
                const result: { deleteResult: DeleteResult; message: string } =
                    await response.json();

                expect(response.status).toBe(200);
                // Check affectedRows if available
                if (result.deleteResult.affectedRows !== undefined) {
                    expect(result.deleteResult.affectedRows).toBe(0);
                }
            });
        });

        describe('deleteBatch() for specific entities', () => {
            test('should delete specific entities by ID', async () => {
                // Setup and create some entities with 'updated' status
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/update-batch`,
                ); // Creates entities with 'batch-updated' status

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/delete-batch`,
                    );
                const result: BatchResponse = await response.json();

                expect(response.status).toBe(200);

                if (result.deletedCount && result.deletedCount > 0) {
                    // Check consistency if affectedRows is available
                    if (result.deleteResult?.affectedRows !== undefined) {
                        expect(result.deleteResult.affectedRows).toBe(
                            result.deletedCount,
                        );
                    }
                    expect(result.deletedIds).toHaveLength(result.deletedCount);
                } else {
                    expect(result.message).toBeDefined();
                }
            });
        });
    });

    describe('Upsert Operations', () => {
        describe('upsert() with OrmFindOptionsWhere', () => {
            test('should insert when no match exists', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/upsert-where`,
                    );
                const result: UpsertResponse = await response.json();

                expect(response.status).toBe(200);
                // Check affectedRows if available
                if (result.upsertResult.affectedRows !== undefined) {
                    expect(result.upsertResult.affectedRows).toBeGreaterThan(0);
                }
                expect(result.entity).toBeDefined();
                expect(result.entity?.name).toBe('UniqueTest');
                expect(result.entity?.status).toBe('upserted');
            });

            test('should update when match exists', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                // First upsert creates
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/upsert-where`,
                );

                // Second upsert should update
                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/upsert-where`,
                    );
                const result: UpsertResponse = await response.json();

                expect(response.status).toBe(200);
                expect(result.entity).toBeDefined();
                expect(result.entity?.name).toBe('UniqueTest');
            });
        });

        describe('upsertBatch() for specific entities', () => {
            test('should handle mixed insert and update operations', async () => {
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/setup`,
                );

                const response =
                    await IntegrationTestEnvironment.get().client.sendRequest(
                        baseUrl + `/test/orm/database/${db}/upsert-batch`,
                    );
                const result: UpsertResponse = await response.json();

                expect(response.status).toBe(200);
                // Check affectedRows if available
                if (result.upsertResult.affectedRows !== undefined) {
                    expect(result.upsertResult.affectedRows).toBeGreaterThan(0);
                }
                expect(result.upsertedCount || 0).toBeGreaterThan(0);

                // Check that entities have correct status
                result.entities?.forEach((entity) => {
                    expect(entity.status).toMatch(/^upsert-batch/);
                });
            });
        });
    });

    // D1 has no interactive transactions — see writeBatch tests instead.
    (db === 'd1' ? describe.skip : describe)('Transaction Support', () => {
        test('should handle multiple operations in a transaction', async () => {
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + `/test/orm/database/${db}/setup`,
            );

            const response =
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/transaction`,
                );
            const result: TransactionResponse = await response.json();

            expect(response.status).toBe(200);

            // Verify transaction operations completed - check if affectedRows is available
            if (result.transactionResult.update1.affectedRows !== undefined) {
                expect(
                    result.transactionResult.update1.affectedRows,
                ).toBeGreaterThanOrEqual(0);
            }
            if (result.transactionResult.update2.affectedRows !== undefined) {
                expect(
                    result.transactionResult.update2.affectedRows,
                ).toBeGreaterThanOrEqual(0);
            }
            if (result.transactionResult.insert.affectedRows !== undefined) {
                expect(result.transactionResult.insert.affectedRows).toBe(1);
            }

            // Verify final state
            expect(result.finalCounts.txNew).toBe(1);
            expect(result.finalCounts.pending).toBe(0); // Should be deleted
        });
    });

    describe('Related Entity Updates', () => {
        test('should setup related data', async () => {
            const response =
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/update-related-setup`,
                );
            const result: RelatedDataResponse = await response.json();

            expect(response.status).toBe(200);
            // Check creation counts if available (durable SQLite may not provide them)
            if (result.usersCreated !== undefined) {
                expect(result.usersCreated).toBe(3);
            }
            if (result.postsCreated !== undefined) {
                expect(result.postsCreated).toBe(5);
            }
        });

        test('should update related entities with complex conditions', async () => {
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + `/test/orm/database/${db}/update-related-setup`,
            );

            const response =
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/update-related`,
                );
            const result: RelatedUpdateResponse = await response.json();

            expect(response.status).toBe(200);

            // Check affectedRows if available - should be at least 1 (Post 2 has 'Draft')
            if (result.updateResult?.affectedRows !== undefined) {
                expect(result.updateResult.affectedRows).toBeGreaterThan(0);
            }

            // All updated posts should have updated content
            result.updatedPosts.forEach((post) => {
                expect(post.content).toBe('Updated content');
            });

            // We expect at least one post to be updated (Post 2 with 'Draft' content)
            expect(result.updatedPosts.length).toBeGreaterThan(0);
        });
    });

    describe('Performance Comparison', () => {
        test('should compare batch vs where update performance', async () => {
            const response =
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl +
                        `/test/orm/database/${db}/performance-batch-vs-where`,
                );
            const result: PerformanceResponse = await response.json();

            expect(response.status).toBe(200);

            // Both methods should update the same number of rows if counts are available
            if (
                result.whereUpdate?.affectedRows !== undefined &&
                result.batchUpdate?.affectedRows !== undefined
            ) {
                expect(result.whereUpdate.affectedRows).toBe(
                    result.batchUpdate.affectedRows,
                );
            }

            // Performance results
            expect(result.analysis.faster).toBeDefined();
            expect(result.analysis.timeDifference).toBeGreaterThanOrEqual(0);
            expect(result.analysis.recommendation).toBeDefined();

            console.log('Performance analysis:', result.analysis);
        });
    });

    describe('Increment and Decrement Operations', () => {
        it('should increment and decrement values atomically', async () => {
            const response = await fetch(
                baseUrl + `/test/orm/database/${db}/increment-decrement`,
            );
            expect(response.status).toBe(200);

            const data: IncrementDecrementResponse = await response.json();

            // Test basic increment
            expect(data.increment1.after).toBe(data.increment1.expected);
            if (data.increment1.result.affectedRows !== undefined) {
                expect(data.increment1.result.affectedRows).toBe(1);
            }

            // Test increment with default value
            expect(data.increment2.after).toBe(data.increment2.expected);
            if (data.increment2.result.affectedRows !== undefined) {
                expect(data.increment2.result.affectedRows).toBe(1);
            }

            // Test basic decrement
            expect(data.decrement1.after).toBe(data.decrement1.expected);
            if (data.decrement1.result.affectedRows !== undefined) {
                expect(data.decrement1.result.affectedRows).toBe(1);
            }

            // Test decrement with default value
            expect(data.decrement2.after).toBe(data.decrement2.expected);
            if (data.decrement2.result.affectedRows !== undefined) {
                expect(data.decrement2.result.affectedRows).toBe(1);
            }

            // Test multi-row increment
            if (data.multiIncrement.result.affectedRows !== undefined) {
                expect(data.multiIncrement.affectedRows).toBe(
                    data.multiIncrement.expectedAffectedRows,
                );
            }

            // Verify the incremented values
            const multiTest1 = data.multiIncrement.entities.find(
                (e) => e.name === 'MultiTest1',
            );
            const multiTest2 = data.multiIncrement.entities.find(
                (e) => e.name === 'MultiTest2',
            );
            const multiTest3 = data.multiIncrement.entities.find(
                (e) => e.name === 'MultiTest3',
            );

            expect(multiTest1?.age).toBe(30); // Was 20, incremented by 10
            expect(multiTest2?.age).toBe(30); // Was 20, incremented by 10
            expect(multiTest3?.age).toBe(30); // Was 30, not incremented (inactive)

            // Test no match case
            if (data.noMatch.result.affectedRows !== undefined) {
                expect(data.noMatch.affectedRows).toBe(
                    data.noMatch.expectedAffectedRows,
                );
            }
        });

        it('should increment and decrement via repository', async () => {
            const response = await fetch(
                baseUrl +
                    `/test/orm/database/${db}/repository-increment-decrement`,
            );
            expect(response.status).toBe(200);

            const data: RepositoryIncrementDecrementResponse =
                await response.json();

            // Test repository increment
            expect(data.increment.after).toBe(data.increment.expected);
            if (data.increment.result.affectedRows !== undefined) {
                expect(data.increment.result.affectedRows).toBe(1);
            }

            // Test repository decrement
            expect(data.decrement.after).toBe(data.decrement.expected);
            if (data.decrement.result.affectedRows !== undefined) {
                expect(data.decrement.result.affectedRows).toBe(1);
            }

            // Test with filter conditions
            expect(data.filterIncrement.after).toBe(
                data.filterIncrement.expected,
            );
            if (data.filterIncrement.result.affectedRows !== undefined) {
                expect(data.filterIncrement.result.affectedRows).toBe(1);
            }
        });
    });

    describe('WriteBatch Operations', () => {
        beforeAll(async () => {
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + `/test/orm/database/${db}/write-batch/setup`,
            );
        });

        afterEach(async () => {
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + `/test/orm/database/${db}/write-batch/cleanup`,
            );
        });

        it('inserts entities of different types in one batch', async () => {
            const response = await fetch(
                baseUrl + `/test/orm/database/${db}/write-batch/multi-entity`,
            );
            expect(response.status).toBe(200);
            const data: {
                result: { affectedRows: number; results: unknown[] };
                persistedUser: { id: string } | null;
                persistedPost: { id: string } | null;
            } = await response.json();

            // One insert op per entity type — two ops total.
            expect(data.result.results.length).toBeGreaterThanOrEqual(2);
            expect(data.persistedUser).not.toBeNull();
            expect(data.persistedPost).not.toBeNull();
        });

        it('mixed-type array is split by constructor with call order preserved', async () => {
            const response = await fetch(
                baseUrl + `/test/orm/database/${db}/write-batch/mixed-array`,
            );
            expect(response.status).toBe(200);
            const data: {
                result: { affectedRows: number; results: unknown[] };
                userCount: number;
                postCount: number;
            } = await response.json();

            // [user, post, user] → 3 ops in call order (run-length grouping).
            expect(data.result.results.length).toBe(3);
            expect(data.userCount).toBe(2);
            expect(data.postCount).toBe(1);
        });

        it('preserves call order across entity types', async () => {
            const response = await fetch(
                baseUrl + `/test/orm/database/${db}/write-batch/call-order`,
            );
            expect(response.status).toBe(200);
            const data: {
                userFirst: boolean;
                postRefMatches: boolean;
            } = await response.json();

            expect(data.userFirst).toBe(true);
            expect(data.postRefMatches).toBe(true);
        });

        it('mixes update and delete across entity types in one batch', async () => {
            const response = await fetch(
                baseUrl + `/test/orm/database/${db}/write-batch/multi-method`,
            );
            expect(response.status).toBe(200);
            const data: {
                userRenamed: boolean;
                postDeleted: boolean;
            } = await response.json();

            expect(data.userRenamed).toBe(true);
            expect(data.postDeleted).toBe(true);
        });

        it('rolls back the whole multi-entity batch when one op fails', async () => {
            const response = await fetch(
                baseUrl +
                    `/test/orm/database/${db}/write-batch/atomicity-multi`,
            );
            expect(response.status).toBe(200);
            const data: {
                errorMessage?: string;
                persistedUser: { id: string } | null;
                atomic: boolean;
            } = await response.json();

            expect(data.errorMessage).toBeDefined();
            // The user insert in the batch should NOT have committed.
            expect(data.persistedUser).toBeNull();
            expect(data.atomic).toBe(true);
        });

        it('runs a raw parameterized execute in the batch', async () => {
            // Regression: drizzle's D1 session batch crashed on any
            // parameterized raw statement (SQLiteRaw has no `stmt`) with
            // "Cannot read properties of undefined (reading 'bind')".
            const response = await fetch(
                baseUrl + `/test/orm/database/${db}/write-batch/raw-execute`,
            );
            expect(response.status).toBe(200);
            const data: {
                errorMessage?: string;
                result?: { affectedRows: number; results: unknown[] };
                rawApplied: boolean;
            } = await response.json();

            expect(data.errorMessage).toBeUndefined();
            // Two ops: entity insert + raw UPDATE, both in the one batch.
            expect(data.result?.results.length).toBe(2);
            expect(data.rawApplied).toBe(true);
        });

        it('preserves intra-batch order across entity types (run-length grouping)', async () => {
            const response = await fetch(
                baseUrl +
                    `/test/orm/database/${db}/write-batch/interleaved-order`,
            );
            expect(response.status).toBe(200);
            const data: {
                errorMessage?: string;
                finalContent?: string;
            } = await response.json();

            expect(data.errorMessage).toBeUndefined();
            expect(data.finalContent).toBe('v2');
        });
    });

    describe('Cleanup', () => {
        test('should clean up all test data', async () => {
            const response =
                await IntegrationTestEnvironment.get().client.sendRequest(
                    baseUrl + `/test/orm/database/${db}/cleanup`,
                );
            const result: CleanupResponse = await response.json();

            expect(response.status).toBe(200);
            expect(result.message).toBe('All test data cleaned up');
            expect(result.deleted).toBeDefined();
        });
    });
});

describe.each(['default', 'd1'])('OrmDatabase Edge Cases (%s)', (db) => {
    test('should handle concurrent updates', async () => {
        await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + `/test/orm/database/${db}/setup`,
        );

        // Launch multiple updates concurrently
        const updates = await Promise.all([
            IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + `/test/orm/database/${db}/update-where`,
            ),
            IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + `/test/orm/database/${db}/update-complex`,
            ),
            IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + `/test/orm/database/${db}/update-like`,
            ),
        ]);

        // All should complete successfully
        updates.forEach((response) => {
            expect(response.status).toBe(200);
        });
    });
});
