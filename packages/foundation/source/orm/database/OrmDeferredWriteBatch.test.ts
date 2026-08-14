// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../decorators/OrmTable';
import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { OrmBatchResult } from '../interfaces/result/OrmBatchResult';
import { OrmDatabase } from './OrmDatabase';
import { OrmDeferredWriteBatch } from './OrmDeferredWriteBatch';
import { OrmDatabaseBatch } from './repository/OrmRepositoryBatch';

@OrmTable('OrmDeferredWriteBatchTestEntity')
class TestEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'integer' })
    declare value: number;
}

function createDatabaseStub(log: string[]): OrmDatabase {
    const batch: OrmDatabaseBatch = {
        insert: () => log.push('insert'),
        update: () => log.push('update'),
        upsert: () => log.push('upsert'),
        delete: () => log.push('delete'),
        deleteWhere: () => log.push('deleteWhere'),
        execute: () => log.push('execute'),
    };
    return {
        writeBatch: async (
            build: (batch: OrmDatabaseBatch) => void,
        ): Promise<OrmBatchResult> => {
            log.push('writeBatch:start');
            build(batch);
            log.push('writeBatch:end');
            return { affectedRows: 0 } as unknown as OrmBatchResult;
        },
    } as unknown as OrmDatabase;
}

describe('OrmDeferredWriteBatch', () => {
    it('replays queued operations in order inside one writeBatch', async () => {
        const log: string[] = [];
        const deferred = new OrmDeferredWriteBatch();
        const entity = new TestEntity();

        deferred.insert(entity);
        deferred.update(entity);
        deferred.deleteWhere(TestEntity, { value: 1 });
        deferred.execute('UPDATE T SET value = value + 1');
        expect(log).toEqual([]); // nothing executes before commit
        expect(deferred.hasOperations).toBe(true);

        await deferred.commit(createDatabaseStub(log));

        expect(log).toEqual([
            'writeBatch:start',
            'insert',
            'update',
            'deleteWhere',
            'execute',
            'writeBatch:end',
        ]);
    });

    it('runs onSuccess callbacks after the batch commits, in order', async () => {
        const log: string[] = [];
        const deferred = new OrmDeferredWriteBatch();

        deferred.insert(new TestEntity());
        deferred.onSuccess(() => {
            log.push('success:1');
        });
        deferred.onSuccess(async () => {
            log.push('success:2');
        });

        await deferred.commit(createDatabaseStub(log));

        expect(log).toEqual([
            'writeBatch:start',
            'insert',
            'writeBatch:end',
            'success:1',
            'success:2',
        ]);
    });

    it('does not run onSuccess callbacks when the batch fails', async () => {
        const log: string[] = [];
        const deferred = new OrmDeferredWriteBatch();
        deferred.insert(new TestEntity());
        deferred.onSuccess(() => {
            log.push('success');
        });

        const failingDatabase = {
            writeBatch: async () => {
                throw new Error('batch failed');
            },
        } as unknown as OrmDatabase;

        await expect(deferred.commit(failingDatabase)).rejects.toThrow(
            'batch failed',
        );
        expect(log).toEqual([]);
    });

    it('rejects queueing and committing after commit', async () => {
        const deferred = new OrmDeferredWriteBatch();
        deferred.insert(new TestEntity());
        await deferred.commit(createDatabaseStub([]));

        expect(() => deferred.insert(new TestEntity())).toThrow(
            'already been committed',
        );
        expect(() => deferred.onSuccess(() => {})).toThrow(
            'already been committed',
        );
        await expect(deferred.commit(createDatabaseStub([]))).rejects.toThrow(
            'already been committed',
        );
    });
});
