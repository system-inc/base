// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { OrmBatchOperation } from '../../../../interfaces/OrmBatchOperation';
import { OrmTableMetadata } from '../../../../metadata/OrmTableMetadata';
import { D1Adapter } from './D1Adapter';

/**
 * Tests the D1-specific `writeBatch` override: how it prepares and
 * submits operations to `d1.batch([...])`, handles no-op operations,
 * works around drizzle's stmt-less raw queries, and reassembles per-op
 * results into input order.
 *
 * We don't exercise the real Drizzle query builders here — the base
 * `buildBatchQuery` and the `convertXxx` result helpers are tested via
 * the PlanetScale path in integration. This focuses on the wiring that
 * lives in `D1Adapter` itself, so the mock queries mimic the drizzle
 * prepared-query surface `writeBatch` consumes: builder queries carry a
 * pre-prepared `stmt`; raw queries (SQLiteRaw — the 'execute' kind)
 * carry none, which is the drizzle bug the adapter patches around.
 */
describe('D1Adapter.writeBatch', () => {
    /** A stand-in for a `D1PreparedStatement`. */
    const makeStatement = (sqlText: string): any => ({
        __sql: sqlText,
        bind: jest.fn((...params: unknown[]) => ({
            __bound: sqlText,
            params,
        })),
    });

    /**
     * A testable subclass that bypasses real query construction by
     * overriding `buildBatchQuery` and `convertBatchOpResult`. This
     * isolates the writeBatch dispatch logic from Drizzle internals.
     */
    class TestableD1Adapter extends D1Adapter {
        // Track every call so tests can assert dispatch behavior.
        public buildCalls: OrmBatchOperation[] = [];

        protected override buildBatchQuery(
            _dbOrTx: any,
            op: OrmBatchOperation,
        ): any {
            this.buildCalls.push(op);
            if (op.kind === 'execute') {
                // SQLiteRaw shape: `_prepare()` yields no `stmt`, and a
                // raw statement built with the `sql` template has params.
                return {
                    _prepare: () => ({
                        stmt: undefined,
                        getQuery: () => ({
                            sql: 'sql:execute',
                            params: ['raw-param'],
                        }),
                        mapResult: (result: any) => result,
                    }),
                };
            }
            // Treat empty insert values + empty where conditions as no-ops.
            if (op.kind === 'insert' && op.values.length === 0) return null;
            if (
                (op.kind === 'update' || op.kind === 'delete') &&
                Object.keys(op.conditions).length === 0
            ) {
                return null;
            }
            // Builder-query shape: a pre-prepared stmt, params only for
            // conditioned ops.
            const params =
                op.kind === 'update' || op.kind === 'delete'
                    ? Object.values(op.conditions)
                    : [];
            return {
                _prepare: () => ({
                    stmt: makeStatement(`stmt:${op.kind}`),
                    getQuery: () => ({ sql: `sql:${op.kind}`, params }),
                    mapResult: (result: any) => result,
                }),
            };
        }

        protected override convertBatchOpResult(
            op: OrmBatchOperation,
            driverResult: any,
        ): any {
            return {
                affectedRows: driverResult?.changes ?? 1,
                raw: driverResult,
                __opKind: op.kind,
            };
        }
    }

    const makeMetadata = (name: string): OrmTableMetadata =>
        ({
            name,
            columns: [],
        }) as unknown as OrmTableMetadata;

    interface MockD1 {
        prepare: jest.Mock;
        batch: jest.Mock<Promise<unknown[]>, [unknown[]]>;
    }

    const makeAdapter = (): {
        adapter: TestableD1Adapter;
        mockD1: MockD1;
    } => {
        const mockD1: MockD1 = {
            prepare: jest.fn((sqlText: string) => makeStatement(sqlText)),
            batch: jest.fn().mockResolvedValue([]),
        };
        const adapter = new TestableD1Adapter(
            mockD1 as never,
            { my_table: {} } as never,
            {} as never,
            {},
        );
        return { adapter, mockD1 };
    };

    test('empty operations array short-circuits without calling d1.batch', async () => {
        const { adapter, mockD1 } = makeAdapter();

        const result = await adapter.writeBatch([]);

        expect(mockD1.batch).not.toHaveBeenCalled();
        expect(result.affectedRows).toBe(0);
        expect(result.results).toHaveLength(0);
    });

    test('all-no-op operations skip d1.batch but still return per-op zero results', async () => {
        const { adapter, mockD1 } = makeAdapter();

        const ops: OrmBatchOperation[] = [
            {
                kind: 'insert',
                metadata: makeMetadata('my_table'),
                values: [], // no-op
            },
            {
                kind: 'update',
                metadata: makeMetadata('my_table'),
                conditions: {}, // no-op (empty where)
                values: { x: 1 },
            },
        ];

        const result = await adapter.writeBatch(ops);

        expect(mockD1.batch).not.toHaveBeenCalled();
        expect(result.affectedRows).toBe(0);
        expect(result.results).toHaveLength(2);
        expect(result.results[0]).toEqual({ affectedRows: 0, raw: null });
        expect(result.results[1]).toEqual({ affectedRows: 0, raw: null });
    });

    test('non-no-op ops are submitted to d1.batch in input order', async () => {
        const { adapter, mockD1 } = makeAdapter();
        mockD1.batch.mockResolvedValue([
            { changes: 1, last_row_id: 'a' },
            { changes: 2 },
        ]);

        const ops: OrmBatchOperation[] = [
            {
                kind: 'insert',
                metadata: makeMetadata('my_table'),
                values: [{ name: 'a' }],
            },
            {
                kind: 'update',
                metadata: makeMetadata('my_table'),
                conditions: { id: 'x' },
                values: { name: 'b' },
            },
        ];

        const result = await adapter.writeBatch(ops);

        expect(mockD1.batch).toHaveBeenCalledTimes(1);
        const statements = mockD1.batch.mock.calls[0][0] as any[];
        expect(statements).toHaveLength(2);
        // Param-less insert: the prepared stmt is submitted unbound.
        expect(statements[0].__sql).toBe('stmt:insert');
        // Conditioned update: the stmt is bound with its params.
        expect(statements[1]).toEqual({
            __bound: 'stmt:update',
            params: ['x'],
        });
        expect(result.results).toHaveLength(2);
        expect((result.results[0] as { __opKind: string }).__opKind).toBe(
            'insert',
        );
        expect((result.results[1] as { __opKind: string }).__opKind).toBe(
            'update',
        );
    });

    test('parameterized raw execute (stmt-less SQLiteRaw) is prepared via d1.prepare', async () => {
        // Regression: drizzle's own D1 session batch crashes here with
        // "Cannot read properties of undefined (reading 'bind')" because
        // SQLiteRaw._prepare() carries no stmt. The adapter must fall
        // back to preparing the statement from the built query text.
        const { adapter, mockD1 } = makeAdapter();
        mockD1.batch.mockResolvedValue([{ changes: 1 }, { changes: 1 }]);

        const ops: OrmBatchOperation[] = [
            {
                kind: 'insert',
                metadata: makeMetadata('my_table'),
                values: [{ name: 'a' }],
            },
            {
                kind: 'execute',
                query: 'UPDATE my_table SET counter = counter + 1 WHERE id = ?',
            },
        ];

        const result = await adapter.writeBatch(ops);

        expect(mockD1.prepare).toHaveBeenCalledTimes(1);
        expect(mockD1.prepare).toHaveBeenCalledWith('sql:execute');
        const statements = mockD1.batch.mock.calls[0][0] as any[];
        expect(statements).toHaveLength(2);
        expect(statements[1]).toEqual({
            __bound: 'sql:execute',
            params: ['raw-param'],
        });
        expect(result.results).toHaveLength(2);
        expect((result.results[1] as { __opKind: string }).__opKind).toBe(
            'execute',
        );
    });

    test('mixed no-op + real ops: results reassemble in input order with zero slots for no-ops', async () => {
        const { adapter, mockD1 } = makeAdapter();
        // Only two real queries — the no-op in the middle is skipped.
        mockD1.batch.mockResolvedValue([{ changes: 1 }, { changes: 1 }]);

        const ops: OrmBatchOperation[] = [
            {
                kind: 'insert',
                metadata: makeMetadata('my_table'),
                values: [{ name: 'a' }],
            },
            {
                // No-op — empty where
                kind: 'delete',
                metadata: makeMetadata('my_table'),
                conditions: {},
            },
            {
                kind: 'insert',
                metadata: makeMetadata('my_table'),
                values: [{ name: 'c' }],
            },
        ];

        const result = await adapter.writeBatch(ops);

        expect(mockD1.batch).toHaveBeenCalledTimes(1);
        // No-op should not have occupied a batch slot.
        expect(mockD1.batch.mock.calls[0][0]).toHaveLength(2);
        // Results array preserves input length and order.
        expect(result.results).toHaveLength(3);
        expect((result.results[0] as { __opKind: string }).__opKind).toBe(
            'insert',
        );
        expect(result.results[1]).toEqual({ affectedRows: 0, raw: null });
        expect((result.results[2] as { __opKind: string }).__opKind).toBe(
            'insert',
        );
    });

    test('total affectedRows is summed across all op slots', async () => {
        const { adapter, mockD1 } = makeAdapter();
        mockD1.batch.mockResolvedValue([{ changes: 3 }, { changes: 7 }]);

        const ops: OrmBatchOperation[] = [
            {
                kind: 'insert',
                metadata: makeMetadata('my_table'),
                values: [{ name: 'a' }],
            },
            {
                kind: 'update',
                metadata: makeMetadata('my_table'),
                conditions: { status: 'pending' },
                values: { status: 'done' },
            },
        ];

        const result = await adapter.writeBatch(ops);

        expect(result.affectedRows).toBe(10);
    });

    test('reports supportsInteractiveTransactions = false', () => {
        const { adapter } = makeAdapter();
        expect(adapter.supportsInteractiveTransactions).toBe(false);
    });
});
