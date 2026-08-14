// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SQLWrapper } from 'drizzle-orm';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmTrackingEntity } from '../../entity/OrmTrackingEntity';
import { OrmEntityHydrator } from '../../hydration/OrmEntityHydrator';
import { OrmFindOptionsWhere } from '../../interfaces/find/OrmFindOptionsWhere';
import { OrmBatchOperation } from '../../interfaces/OrmBatchOperation';
import { OrmPartialEntity } from '../../interfaces/OrmPartialEntity';
import { OrmTableMetadata } from '../../metadata/OrmTableMetadata';
import {
    entityAfterDelete,
    entityAfterInsert,
    entityAfterUpdate,
    entityBeforeDelete,
    entityBeforeInsert,
    entityBeforeUpdate,
    getInsertValues,
    getPrimaryKeyConditions,
} from './OrmRepository';

/**
 * Callback-passed batch builder, mirroring the repository API. Each method
 * queues an operation (no I/O) and runs the appropriate `before*` hooks
 * synchronously. The repository's `writeBatch` submits the queued
 * operations atomically and then runs the matching `after*` hooks.
 */
export interface OrmRepositoryBatch<EntityType extends OrmTrackingEntity> {
    insert(entity: EntityType | ReadonlyArray<EntityType>): void;
    update(entity: EntityType | ReadonlyArray<EntityType>): void;
    upsert(entity: EntityType | ReadonlyArray<EntityType>): void;
    delete(entity: EntityType | ReadonlyArray<EntityType>): void;
}

/**
 * Implementation of `OrmRepositoryBatch`. Public-ish — both
 * `OrmRepository.writeBatch` and `OrmDatabase.writeBatch` instantiate
 * this. Holds a reference to a shared operations queue (so multi-entity
 * batches preserve call order across entity types) and tracks the
 * affected entities so after-hooks can fire once the batch resolves.
 */
export class OrmRepositoryBatchBuilder<
    EntityType extends OrmTrackingEntity,
> implements OrmRepositoryBatch<EntityType> {
    private readonly inserted: EntityType[] = [];
    private readonly updated: EntityType[] = [];
    private readonly deleted: EntityType[] = [];

    constructor(
        private readonly metadata: OrmTableMetadata,
        readonly operations: OrmBatchOperation[],
    ) {}

    insert(entity: EntityType | ReadonlyArray<EntityType>): void {
        const entities = toArray(entity);
        if (entities.length === 0) return;
        entityBeforeInsert(entities, this.metadata);
        this.inserted.push(...entities);
        this.operations.push({
            kind: 'insert',
            metadata: this.metadata,
            values: entities.map((e) =>
                OrmEntityHydrator.applyTransformersToDatabase(
                    getInsertValues(e, this.metadata),
                    this.metadata,
                ),
            ),
        });
    }

    update(entity: EntityType | ReadonlyArray<EntityType>): void {
        const entities = toArray(entity);
        if (entities.length === 0) return;
        entityBeforeUpdate(entities, this.metadata);
        this.updated.push(...entities);
        for (const e of entities) {
            this.operations.push({
                kind: 'update',
                metadata: this.metadata,
                conditions: getPrimaryKeyConditions(
                    e,
                    this.metadata,
                ) as OrmFindOptionsWhere<object>,
                values: OrmEntityHydrator.applyTransformersToDatabase(
                    e.getChangedFields(),
                    this.metadata,
                ),
            });
        }
    }

    upsert(entity: EntityType | ReadonlyArray<EntityType>): void {
        const entities = toArray(entity);
        if (entities.length === 0) return;
        entityBeforeInsert(entities, this.metadata);
        entityBeforeUpdate(entities, this.metadata);
        this.inserted.push(...entities);
        this.updated.push(...entities);
        for (const e of entities) {
            this.operations.push({
                kind: 'upsert',
                metadata: this.metadata,
                conditions: getPrimaryKeyConditions(
                    e,
                    this.metadata,
                ) as OrmPartialEntity<object>,
                values: OrmEntityHydrator.applyTransformersToDatabase(
                    getInsertValues(e, this.metadata),
                    this.metadata,
                ),
            });
        }
    }

    delete(entity: EntityType | ReadonlyArray<EntityType>): void {
        const entities = toArray(entity);
        if (entities.length === 0) return;
        entityBeforeDelete(entities, this.metadata);
        this.deleted.push(...entities);
        for (const e of entities) {
            this.operations.push({
                kind: 'delete',
                metadata: this.metadata,
                conditions: getPrimaryKeyConditions(
                    e,
                    this.metadata,
                ) as OrmFindOptionsWhere<object>,
            });
        }
    }

    runAfterHooks(): void {
        if (this.inserted.length > 0) {
            entityAfterInsert(this.inserted, this.metadata);
        }
        if (this.updated.length > 0) {
            entityAfterUpdate(this.updated, this.metadata);
        }
        if (this.deleted.length > 0) {
            entityAfterDelete(this.deleted, this.metadata);
        }
    }
}

function toArray<T>(item: T | ReadonlyArray<T>): ReadonlyArray<T> {
    return Array.isArray(item) ? (item as ReadonlyArray<T>) : [item as T];
}

/**
 * Multi-entity batch builder used by `OrmDatabase.writeBatch`. The
 * entity class is inferred from each value's constructor — no need to
 * pre-declare which repository each call targets. Mixed-type arrays in
 * a single call are split into run-length-encoded groups so call order
 * is preserved (matters for FK-dependent writes that span entity types).
 */
export interface OrmDatabaseBatch {
    insert<EntityType extends OrmTrackingEntity>(
        entity: EntityType | ReadonlyArray<EntityType>,
    ): void;
    update<EntityType extends OrmTrackingEntity>(
        entity: EntityType | ReadonlyArray<EntityType>,
    ): void;
    upsert<EntityType extends OrmTrackingEntity>(
        entity: EntityType | ReadonlyArray<EntityType>,
    ): void;
    delete<EntityType extends OrmTrackingEntity>(
        entity: EntityType | ReadonlyArray<EntityType>,
    ): void;
    /**
     * Queue a delete by arbitrary conditions (the batch counterpart of
     * `OrmDatabase.delete(target, conditions)`). No entity lifecycle
     * hooks run because no entity instances are involved.
     */
    deleteWhere<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
    ): void;

    /**
     * Queue a raw write statement (built with the drizzle `sql`
     * template) to run inside the same atomic batch — the escape hatch
     * for bulk updates the entity API can't express (computed SET
     * clauses, conditional shifts, increments). No entity lifecycle
     * hooks run for it.
     */
    execute(query: SQLWrapper | string): void;
}
