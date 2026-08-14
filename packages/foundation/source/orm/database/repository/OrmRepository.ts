// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { OrmTrackingEntity } from '../../entity/OrmTrackingEntity';
import { OrmEntityHydrator } from '../../hydration/OrmEntityHydrator';
import { OrmFindOptions } from '../../interfaces/find/OrmFindOptions';
import { OrmFindOptionsMany } from '../../interfaces/find/OrmFindOptionsMany';
import { OrmFindOptionsWhere } from '../../interfaces/find/OrmFindOptionsWhere';
import { OrmTimeSeriesOptions } from '../../interfaces/find/OrmTimeSeriesOptions';
import { OrmBatchOperation } from '../../interfaces/OrmBatchOperation';
import { OrmListenerEventType } from '../../interfaces/OrmListenerEventType';
import {
    OrmEntityKey,
    OrmPartialEntity,
} from '../../interfaces/OrmPartialEntity';
import { OrmBatchResult } from '../../interfaces/result/OrmBatchResult';
import { OrmDeleteResult } from '../../interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '../../interfaces/result/OrmInsertResult';
import { OrmTimeSeriesResult } from '../../interfaces/result/OrmTimeSeriesResult';
import { OrmUpdateResult } from '../../interfaces/result/OrmUpdateResult';
import { getPrimaryKeyColumns } from '../../metadata/OrmPrimaryKeyInfo';
import { ormRequireTable } from '../../metadata/OrmSchemaRegistry';
import {
    OrmTableMetadata,
    requireTruncatable,
} from '../../metadata/OrmTableMetadata';
import { OrmSettings } from '../../settings/OrmSettings';
import { OrmAdapterType } from '../adapter/OrmAdapterType';
import { OrmDatabaseImpl } from '../internal/OrmDatabaseImpl';
import {
    OrmRepositoryBatch,
    OrmRepositoryBatchBuilder,
} from './OrmRepositoryBatch';

export class OrmRepository<EntityType extends OrmTrackingEntity> {
    get tableName(): string {
        return this.metadata.name;
    }

    constructor(
        readonly target: Constructor<EntityType>,
        private readonly metadata: OrmTableMetadata,
        readonly db: OrmDatabaseImpl<OrmSettings<OrmAdapterType>>,
    ) {}

    /**
     * Returns the largest chunk size that keeps a single statement's bound
     * parameters under the underlying adapter's safe limit. Use this when
     * chunking a large input array in caller code (e.g. for an `IN (...)`
     * filter or a batched read). Pass `1` for a list of scalar IDs.
     */
    safeBatchSize(columnCount: number): Promise<number> {
        return this.db.safeBatchSize(columnCount);
    }

    /**
     * Counts entities that match given options.
     * Useful for pagination.
     */
    count(options?: OrmFindOptionsMany<EntityType>): Promise<number> {
        return this.db.count<EntityType>(this.target, options);
    }

    /**
     * Finds entities that match given find options.
     */
    async find(
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<EntityType[]> {
        const rawResults = await this.db.find<EntityType>(this.target, options);
        return OrmEntityHydrator.hydrateMany(rawResults, this.target, {
            joins: options?.joins,
        });
    }

    /**
     * Finds first entity by a given find options.
     * If entity was not found in the database - returns null.
     */
    async findOne(
        options?: OrmFindOptions<EntityType>,
    ): Promise<EntityType | null> {
        const rawResult = await this.db.findOne<EntityType>(
            this.target,
            options,
        );
        return OrmEntityHydrator.hydrateOne(rawResult, this.target, {
            joins: options?.joins,
        });
    }

    /**
     * Finds entities that match given find options.
     * Also counts all entities that match given conditions,
     * but ignores pagination settings (from and take options).
     */
    async findAndCount(
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<[EntityType[], number]> {
        const [rawResults, count] = await this.db.findAndCount<EntityType>(
            this.target,
            options,
        );
        const hydratedResults = OrmEntityHydrator.hydrateMany(
            rawResults,
            this.target,
            { joins: options?.joins },
        );
        return [hydratedResults, count];
    }

    insert(entity: Readonly<EntityType>): Promise<OrmInsertResult<EntityType>>;
    insert(
        entity: ReadonlyArray<EntityType>,
    ): Promise<OrmInsertResult<EntityType>>;
    async insert(
        entity: Readonly<EntityType> | ReadonlyArray<EntityType>,
    ): Promise<OrmInsertResult<EntityType>> {
        const entities: ReadonlyArray<EntityType> = Array.isArray(entity)
            ? entity
            : [entity];

        if (entities.length === 0) {
            return { affectedRows: 0 };
        }

        const metadata = ormRequireTable(this.target);

        entityBeforeInsert(entities, metadata);

        // Apply transformers to prepare data for database. Insert persists
        // every SET column, not the dirty set (see getInsertValues).
        const transformedData = entities.map((entity) =>
            OrmEntityHydrator.applyTransformersToDatabase(
                getInsertValues(entity, metadata),
                metadata,
            ),
        );

        const adapter = await this.db.getAdapter();
        const result = await adapter.insert<EntityType>(
            metadata,
            transformedData,
        );

        // Back-populate a DB-generated serial primary key onto the entity.
        // Unlike a client-assigned uuid PK (set in entityBeforeInsert), a serial
        // id is produced by the database and returned by the driver as
        // `result.insertedId`. Without this, `entity.id` stays undefined after
        // insert, so callers can't reference it (e.g. as a foreign key) without a
        // re-query. Single-row inserts only — a multi-row insert returns one id
        // we can't map per row. Assigned before entityAfterInsert so the
        // @OrmAfterInsert dirty reset leaves the entity clean with its id set.
        const pk = metadata.primaryKey;
        if (
            pk?.type === 'auto-serial' &&
            entities.length === 1 &&
            result.insertedId !== undefined &&
            result.insertedId !== null
        ) {
            const target = entities[0] as unknown as Dictionary<unknown>;
            if (target[pk.column] === undefined || target[pk.column] === null) {
                target[pk.column] =
                    pk.size === 'int64'
                        ? BigInt(result.insertedId)
                        : Number(result.insertedId);
            }
        }

        entityAfterInsert(entities, metadata);

        return result;
    }

    update(entity: Readonly<EntityType>): Promise<OrmUpdateResult<EntityType>>;
    update(
        entity: ReadonlyArray<EntityType>,
    ): Promise<OrmUpdateResult<EntityType>>;
    async update(
        entity: Readonly<EntityType> | ReadonlyArray<EntityType>,
    ): Promise<OrmUpdateResult<EntityType>> {
        const entities: ReadonlyArray<EntityType> = Array.isArray(entity)
            ? entity
            : [entity];

        if (entities.length === 0) {
            return { affectedRows: 0 };
        }

        const metadata = ormRequireTable(
            entities[0].constructor as Constructor<EntityType>,
        );

        entityBeforeUpdate(entities, metadata);

        const adapter = await this.db.getAdapter();
        const result = await adapter.updateBatch<EntityType>(
            metadata,
            entities.map((entity) => ({
                conditions: getPrimaryKeyConditions(entity, metadata),
                values: OrmEntityHydrator.applyTransformersToDatabase(
                    entity.getChangedFields(),
                    metadata,
                ),
            })),
        );

        entityAfterUpdate(entities, metadata);

        return result;
    }

    async upsert(
        entity: Readonly<EntityType>,
    ): Promise<OrmInsertResult<EntityType>>;
    async upsert(
        entity: ReadonlyArray<EntityType>,
    ): Promise<OrmInsertResult<EntityType>>;
    async upsert(
        entity: Readonly<EntityType> | ReadonlyArray<EntityType>,
    ): Promise<OrmInsertResult<EntityType>> {
        const entities: ReadonlyArray<EntityType> = Array.isArray(entity)
            ? entity
            : [entity];

        if (entities.length === 0) {
            return { affectedRows: 0 };
        }

        const metadata = ormRequireTable(this.target);

        entityBeforeInsert(entities, metadata);
        entityBeforeUpdate(entities, metadata);

        const adapter = await this.db.getAdapter();
        const result = await adapter.upsertBatch<EntityType>(
            metadata,
            entities.map((entity) => ({
                conditions: getPrimaryKeyConditions(entity, metadata),
                values: OrmEntityHydrator.applyTransformersToDatabase(
                    getInsertValues(entity, metadata),
                    metadata,
                ),
            })),
        );

        entityAfterInsert(entities, metadata);
        entityAfterUpdate(entities, metadata);

        return result;
    }

    async delete(
        entity: Readonly<EntityType>,
    ): Promise<OrmDeleteResult<EntityType>>;
    async delete(
        entity: ReadonlyArray<EntityType>,
    ): Promise<OrmDeleteResult<EntityType>>;
    async delete(
        entity: Readonly<EntityType> | ReadonlyArray<EntityType>,
    ): Promise<OrmDeleteResult<EntityType>> {
        const entities: ReadonlyArray<EntityType> = Array.isArray(entity)
            ? entity
            : [entity];

        if (entities.length === 0) {
            return { affectedRows: 0 };
        }

        const metadata = ormRequireTable(this.target);

        entityBeforeDelete(entities, metadata);

        const adapter = await this.db.getAdapter();
        const result = await adapter.deleteBatch<EntityType>(
            metadata,
            entities.map(
                (entity) =>
                    getPrimaryKeyConditions(
                        entity,
                        metadata,
                    ) as OrmPartialEntity<EntityType>,
            ),
        );

        entityAfterDelete(entities, metadata);

        return result;
    }

    /**
     * Atomically execute a batch of writes against this repository's
     * entity. The `build` callback receives a builder that mirrors the
     * repo's `insert`/`update`/`upsert`/`delete` methods but queues
     * operations instead of executing them. Submitted as one atomic
     * batch — D1 maps it to `db.batch([...])`, other adapters use a
     * native transaction.
     *
     * Portable across all adapters. The recommended primitive for
     * atomic writes that need to work the same regardless of which
     * database backs the deployment.
     */
    async writeBatch(
        build: (batch: OrmRepositoryBatch<EntityType>) => void,
    ): Promise<OrmBatchResult> {
        const operations: OrmBatchOperation[] = [];
        const builder = new OrmRepositoryBatchBuilder<EntityType>(
            this.metadata,
            operations,
        );
        build(builder);
        if (operations.length === 0) {
            return { affectedRows: 0, results: [] };
        }
        const adapter = await this.db.getAdapter();
        const result = await adapter.writeBatch(operations);
        builder.runAfterHooks();
        return result;
    }

    /**
     * Deletes every row in the table.
     *
     * Requires the target entity to be marked `truncatable: true` via
     * `@OrmTable({ truncatable: true })`. Tables that are not explicitly
     * marked as truncatable will throw at runtime.
     *
     * The `confirm: true` flag must be passed at every call site to make
     * the intent visible in code review — this method cannot be called
     * without spelling out that a full-table wipe is intended.
     */
    async truncate(_options: {
        confirm: true;
    }): Promise<OrmDeleteResult<EntityType>> {
        const metadata = ormRequireTable(this.target);
        requireTruncatable(metadata);
        const adapter = await this.db.getAdapter();
        return adapter.truncate<EntityType>(metadata);
    }

    /**
     * Atomically increments a numeric column value.
     * @param conditions - The conditions to match entities
     * @param column - The column to increment
     * @param value - The amount to increment by (default: 1)
     */
    async increment(
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value: number = 1,
    ): Promise<OrmUpdateResult<EntityType>> {
        const metadata = ormRequireTable(this.target);
        const adapter = await this.db.getAdapter();
        return adapter.increment<EntityType>(
            metadata,
            conditions,
            column,
            value,
        );
    }

    /**
     * Atomically decrements a numeric column value.
     * @param conditions - The conditions to match entities
     * @param column - The column to decrement
     * @param value - The amount to decrement by (default: 1)
     */
    async decrement(
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value: number = 1,
    ): Promise<OrmUpdateResult<EntityType>> {
        const metadata = ormRequireTable(this.target);
        const adapter = await this.db.getAdapter();
        return adapter.decrement<EntityType>(
            metadata,
            conditions,
            column,
            value,
        );
    }

    timeSeries(
        column: OrmEntityKey<EntityType>,
        options: OrmTimeSeriesOptions<EntityType>,
    ): Promise<OrmTimeSeriesResult[]> {
        return this.db.timeSeries<EntityType>(this.target, column, options);
    }
}

export function entityBeforeInsert(
    entities: ReadonlyArray<OrmTrackingEntity>,
    metadata: OrmTableMetadata,
): void {
    for (const entity of entities) {
        const mutable: Dictionary<unknown> =
            entity as unknown as Dictionary<unknown>;

        // Assign auto-generated values if necessary
        if (metadata.primaryKey?.type === 'auto-uuid') {
            if (mutable[metadata.primaryKey.column] === undefined) {
                mutable[metadata.primaryKey.column] = crypto.randomUUID();
            }
        }

        // Apply column defaults
        for (const column of metadata.columns) {
            // Skip if value is already set
            if (mutable[column.propertyKey] !== undefined) {
                continue;
            }

            // Apply default if defined (function or static value)
            if (column.options?.default !== undefined) {
                mutable[column.propertyKey] =
                    typeof column.options.default === 'function'
                        ? column.options.default()
                        : column.options.default;
            }
        }

        // Fulfill create AND update date columns on insert from a single
        // `now`, so createdAt and updatedAt are the identical instant on a
        // fresh row (`createdAt === updatedAt` => never updated). Update
        // columns are then bumped on each subsequent update (entityBeforeUpdate).
        //
        // A NULLABLE update-date column is the exception: it's left null on
        // insert (the opt-in "null until first update" sentinel). Nullability
        // thus cleanly selects the semantics — non-null = equality-based,
        // nullable = null-until-updated.
        const createDateColumns = metadata.dateColumns['create'];
        const updateDateColumns = metadata.dateColumns['update'];
        if (createDateColumns?.length || updateDateColumns?.length) {
            const now = new Date();
            for (const column of createDateColumns ?? []) {
                if (mutable[column] === undefined) {
                    mutable[column] = now;
                }
            }
            for (const column of updateDateColumns ?? []) {
                const isNullable = metadata.columns.find(
                    (candidate) => candidate.propertyKey === column,
                )?.options?.nullable;
                if (!isNullable && mutable[column] === undefined) {
                    mutable[column] = now;
                }
            }
        }

        runEntityListeners(mutable, metadata, 'beforeInsert');
    }
}

export function entityAfterInsert(
    entities: ReadonlyArray<OrmTrackingEntity>,
    metadata: OrmTableMetadata,
): void {
    for (const entity of entities) {
        const mutable: Dictionary<unknown> =
            entity as unknown as Dictionary<unknown>;
        runEntityListeners(mutable, metadata, 'afterInsert');
    }
}

export function entityBeforeUpdate(
    entities: ReadonlyArray<OrmTrackingEntity>,
    metadata: OrmTableMetadata,
): void {
    for (const entity of entities) {
        const mutable: Dictionary<unknown> =
            entity as unknown as Dictionary<unknown>;

        // check if we have any update events we need to fulfill
        if (metadata.dateColumns['update']) {
            const now = new Date();
            for (const column of metadata.dateColumns['update']) {
                mutable[column] = now;
            }
        }

        runEntityListeners(mutable, metadata, 'beforeUpdate');
    }
}

export function entityAfterUpdate(
    entities: ReadonlyArray<OrmTrackingEntity>,
    metadata: OrmTableMetadata,
): void {
    for (const entity of entities) {
        const mutable: Dictionary<unknown> =
            entity as unknown as Dictionary<unknown>;
        runEntityListeners(mutable, metadata, 'afterUpdate');
    }
}

export function entityBeforeDelete(
    entities: ReadonlyArray<OrmTrackingEntity>,
    metadata: OrmTableMetadata,
): void {
    for (const entity of entities) {
        const mutable: Dictionary<unknown> =
            entity as unknown as Dictionary<unknown>;
        runEntityListeners(mutable, metadata, 'beforeDelete');
    }
}

export function entityAfterDelete(
    entities: ReadonlyArray<OrmTrackingEntity>,
    metadata: OrmTableMetadata,
): void {
    for (const entity of entities) {
        const mutable: Dictionary<unknown> =
            entity as unknown as Dictionary<unknown>;
        runEntityListeners(mutable, metadata, 'afterDelete');
    }
}

function runEntityListeners(
    entity: Dictionary<unknown>,
    metadata: OrmTableMetadata,
    event: OrmListenerEventType,
): void {
    if (metadata.listeners[event] === undefined) {
        return;
    }
    for (const listener of metadata.listeners[event]) {
        if (typeof entity[listener] === 'function') {
            entity[listener]();
        }
    }
}

/**
 * Every SET column value on the entity — the field set insert/upsert
 * persist. Dirty tracking (`getChangedFields`) is an UPDATE
 * optimization: driving insert with it silently dropped the values of
 * clean entities (a `clone()`d or hydrated entity carries its data in
 * the value slots with an empty dirty set), storing NULL rows.
 */
export function getInsertValues<EntityType extends OrmTrackingEntity>(
    entity: EntityType,
    metadata: OrmTableMetadata,
): OrmPartialEntity<EntityType> {
    const values: Dictionary<unknown> = {};
    const entityAsDict = entity as unknown as Dictionary<unknown>;
    for (const column of metadata.columns) {
        const value = entityAsDict[column.propertyKey];
        if (value !== undefined) {
            values[column.propertyKey] = value;
        }
    }
    return values as OrmPartialEntity<EntityType>;
}

export function getPrimaryKeyConditions<EntityType extends OrmTrackingEntity>(
    entity: EntityType,
    metadata: OrmTableMetadata,
): OrmPartialEntity<EntityType> {
    const conditions: Dictionary<unknown> = {};
    const entityAsDict = entity as unknown as Dictionary<unknown>;

    // Every declared primary-key component must be present. A PARTIAL
    // composite key would silently widen the WHERE to every row matching
    // the components that happen to be set — an update/delete meant for
    // one row mutating its siblings. Fail loud instead, naming exactly
    // what's missing.
    const missing: string[] = [];
    if (metadata.primaryKey) {
        const pkColumns = getPrimaryKeyColumns(metadata.primaryKey);
        for (const column of pkColumns) {
            const value = entityAsDict[column];
            if (value !== undefined) {
                conditions[column] = value;
            } else {
                missing.push(column);
            }
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Cannot identify entity of type ${metadata.name}: primary key ` +
                `column(s) ${missing.join(', ')} are not set. A write scoped by ` +
                `a partial key would affect sibling rows; set every primary ` +
                `key column before update/delete/upsert.`,
        );
    }

    // If no primary key is found, this is a design error
    if (Object.keys(conditions).length === 0) {
        throw new Error(
            `Cannot identify entity of type ${metadata.name}: No primary key defined. ` +
                `All tables must have a primary key for proper data integrity.`,
        );
    }

    return conditions as OrmPartialEntity<EntityType>;
}
