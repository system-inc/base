// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SQLWrapper } from 'drizzle-orm';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { OrmFindOptionsWhere } from '../interfaces/find/OrmFindOptionsWhere';
import { OrmBatchResult } from '../interfaces/result/OrmBatchResult';
import { OrmDatabase } from './OrmDatabase';
import { OrmDatabaseBatch } from './repository/OrmRepositoryBatch';

/**
 * A write batch that can be built up across async code before it is
 * executed.
 *
 * `OrmDatabase.writeBatch` takes a synchronous builder callback, which
 * works when all the decisions are made up front. Flows that interleave
 * reads with queued writes (read an entity, decide, queue an update,
 * read some more) can't build inside that callback. This class is the
 * bridge: it implements `OrmDatabaseBatch`, so it can be threaded
 * through service methods exactly like a batch, queueing operations
 * with no I/O. `commit(db)` then replays the queued operations into one
 * atomic `writeBatch` and runs any registered `onSuccess` callbacks.
 *
 * Because nothing executes until `commit`, all reads naturally happen
 * before the batch — the reads-first pattern that keeps modules
 * portable to batch-only backends like D1. Note that auto-generated ids
 * are assigned when the batch executes, not when an insert is queued;
 * assign ids explicitly before queueing if they are needed earlier.
 *
 * `onSuccess` callbacks run sequentially after the batch commits — use
 * them for side effects that must not happen if the writes fail
 * (sending emails, setting cookies).
 */
export class OrmDeferredWriteBatch implements OrmDatabaseBatch {
    private readonly operations: Array<(batch: OrmDatabaseBatch) => void> = [];
    private readonly successCallbacks: Array<() => Promise<void> | void> = [];
    private committed = false;

    insert<EntityType extends OrmTrackingEntity>(
        entity: EntityType | ReadonlyArray<EntityType>,
    ): void {
        this.queue((batch) => batch.insert(entity));
    }

    update<EntityType extends OrmTrackingEntity>(
        entity: EntityType | ReadonlyArray<EntityType>,
    ): void {
        this.queue((batch) => batch.update(entity));
    }

    upsert<EntityType extends OrmTrackingEntity>(
        entity: EntityType | ReadonlyArray<EntityType>,
    ): void {
        this.queue((batch) => batch.upsert(entity));
    }

    delete<EntityType extends OrmTrackingEntity>(
        entity: EntityType | ReadonlyArray<EntityType>,
    ): void {
        this.queue((batch) => batch.delete(entity));
    }

    deleteWhere<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
    ): void {
        this.queue((batch) => batch.deleteWhere(target, conditions));
    }

    execute(query: SQLWrapper | string): void {
        this.queue((batch) => batch.execute(query));
    }

    /**
     * Registers a callback to run after the batch commits successfully.
     */
    onSuccess(callback: () => Promise<void> | void): void {
        this.assertNotCommitted();
        this.successCallbacks.push(callback);
    }

    /**
     * Whether any write operations have been queued.
     */
    get hasOperations(): boolean {
        return this.operations.length > 0;
    }

    /**
     * Executes the queued operations as one atomic `writeBatch` against
     * the provided database, then runs the `onSuccess` callbacks in
     * registration order. A batch can only be committed once.
     */
    async commit(database: OrmDatabase): Promise<OrmBatchResult> {
        this.assertNotCommitted();
        this.committed = true;
        // A flow can turn out to have nothing to write (e.g. it returned
        // early) — skip the round trip but still honor the callbacks.
        const result: OrmBatchResult =
            this.operations.length > 0
                ? await database.writeBatch((batch) => {
                      for (const operation of this.operations) {
                          operation(batch);
                      }
                  })
                : { affectedRows: 0, results: [] };
        for (const callback of this.successCallbacks) {
            await callback();
        }
        return result;
    }

    private queue(operation: (batch: OrmDatabaseBatch) => void): void {
        this.assertNotCommitted();
        this.operations.push(operation);
    }

    private assertNotCommitted(): void {
        if (this.committed) {
            throw new Error(
                'OrmDeferredWriteBatch has already been committed.',
            );
        }
    }
}
