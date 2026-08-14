// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type SQLWrapper } from 'drizzle-orm';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { OrmConfiguration } from '../../../configuration/BaseConfiguration';
import { OrmEntityClass } from '../../entity/OrmEntityClass';
import { OrmTrackingEntity } from '../../entity/OrmTrackingEntity';
import { OrmFindOptions } from '../../interfaces/find/OrmFindOptions';
import { OrmFindOptionsMany } from '../../interfaces/find/OrmFindOptionsMany';
import { OrmFindOptionsWhere } from '../../interfaces/find/OrmFindOptionsWhere';
import { OrmTimeSeriesOptions } from '../../interfaces/find/OrmTimeSeriesOptions';
import { OrmBatchOperation } from '../../interfaces/OrmBatchOperation';
import {
    OrmEntityKey,
    OrmPartialEntity,
} from '../../interfaces/OrmPartialEntity';
import { OrmRawData } from '../../interfaces/OrmRawData';
import { OrmBatchResult } from '../../interfaces/result/OrmBatchResult';
import { OrmDeleteResult } from '../../interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '../../interfaces/result/OrmInsertResult';
import { OrmTimeSeriesResult } from '../../interfaces/result/OrmTimeSeriesResult';
import { OrmUpdateResult } from '../../interfaces/result/OrmUpdateResult';
import { ormGetTable, ormRequireTable } from '../../metadata/OrmSchemaRegistry';
import {
    OrmTableMetadata,
    requireTruncatable,
} from '../../metadata/OrmTableMetadata';
import { OrmSettings } from '../../settings/OrmSettings';
import { OrmAdapter } from '../adapter/OrmAdapter';
import {
    isOrmAdapterProvider,
    OrmAdapterProvider,
} from '../adapter/OrmAdapterProvider';
import { OrmAdapterType } from '../adapter/OrmAdapterType';
import { isDurableAdapter } from '../adapter/OrmDurableAdapter';
import { OrmDatabase } from '../OrmDatabase';
import { OrmRepository } from '../repository/OrmRepository';
import {
    OrmDatabaseBatch,
    OrmRepositoryBatchBuilder,
} from '../repository/OrmRepositoryBatch';
import { OrmTransaction } from '../transaction/OrmTransaction';

/**
 * Guards condition-based mutations against accidentally addressing every
 * row. A conditions object that is empty — or whose every value is
 * `undefined` (e.g. `{ id: someVar }` where `someVar` slipped through as
 * undefined) — has no scope at all. For delete that would compile to a
 * no-WHERE delete-all; for update/increment/decrement the adapter used
 * to silently NO-OP with a success-shaped `{ affectedRows: 0 }` — a
 * migrated bulk mutation quietly doing nothing. Fail closed either way.
 * Clearing a whole table is the explicit, opt-in job of
 * `truncate({ confirm: true })`; an intentional all-rows update states
 * its scope explicitly (e.g. `{ id: notEquals(null) }`).
 */
function assertScopedConditions(conditions: object, verb: string): void {
    const entries = Object.entries(conditions);
    if (
        entries.length === 0 ||
        entries.every(([, value]) => value === undefined)
    ) {
        throw new Error(
            `Refusing to ${verb} with empty conditions — this would address ` +
                'every row. Pass at least one defined condition' +
                (verb === 'delete'
                    ? ', or use truncate({ confirm: true }) on a truncatable table to clear all rows.'
                    : '.'),
        );
    }
}

export class OrmDatabaseImpl<
    SettingsType extends OrmSettings<OrmAdapterType> =
        OrmSettings<OrmAdapterType>,
    Adapter extends OrmAdapter = OrmAdapter,
> implements OrmDatabase {
    readonly name: string = this.configuration.databaseName;

    private _adapter: Adapter | undefined;
    private readonly _adapterProvider:
        | OrmAdapterProvider<SettingsType, OrmAdapterType, Adapter>
        | undefined;
    private entityByTableName: Map<string, OrmEntityClass> | undefined;

    constructor(configuration: OrmConfiguration, adapter: Adapter);
    constructor(
        configuration: OrmConfiguration,
        adapterProvider: OrmAdapterProvider<
            SettingsType,
            OrmAdapterType,
            Adapter
        >,
    );
    constructor(
        readonly configuration: OrmConfiguration,
        adapterOrProvider:
            | Adapter
            | OrmAdapterProvider<SettingsType, OrmAdapterType, Adapter>,
    ) {
        if (isOrmAdapterProvider(adapterOrProvider)) {
            this._adapterProvider = adapterOrProvider;
        } else {
            this._adapter = adapterOrProvider;
        }
    }

    get adapterType(): OrmAdapterType {
        if (this._adapter) {
            return this._adapter.adapterType;
        } else if (this._adapterProvider) {
            return this._adapterProvider.adapterType;
        }
        throw new Error(
            `No data adapter or provider configured for data context "${this.name}".`,
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async execute(query: SQLWrapper | string): Promise<any> {
        const adapter = await this.getAdapter();
        return adapter.execute(query);
    }

    async executeRows<RowType = Record<string, unknown>>(
        query: SQLWrapper | string,
    ): Promise<RowType[]> {
        const adapter = await this.getAdapter();
        return adapter.executeRows<RowType>(query);
    }

    async transaction<T>(
        callback: (tx: OrmTransaction) => Promise<T>,
    ): Promise<T> {
        const adapter = await this.getAdapter();
        return adapter.transaction(this, callback);
    }

    async safeBatchSize(columnCount: number): Promise<number> {
        const adapter = await this.getAdapter();
        return adapter.safeBatchSize(columnCount);
    }

    getRepository<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
    ): OrmRepository<EntityType> {
        const metadata = this.requireOwnEntity(target);
        return new OrmRepository(target, metadata, this);
    }

    /**
     * Resolves an entity's metadata and asserts the entity is actually
     * registered for THIS database (owned or external). Catches a mismatched
     * data context early — e.g. an explicit `@InjectDatabase(binding)` /
     * `@InjectRepository(entity, binding)` pointing at the wrong database, or a
     * module routed (via `databaseName` / the `database` modifier) to a database
     * whose schema doesn't include the entity — with a clear message instead of
     * an opaque "no such table" further down in the driver.
     */
    private requireOwnEntity<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
    ): OrmTableMetadata {
        const metadata = ormRequireTable(target);
        if (!this.entitySet.has(target)) {
            throw new Error(
                `Entity "${target.name}" is not registered for database ` +
                    `"${this.name}", so it cannot be used here. Its schema is ` +
                    `owned/used by a different database. Likely causes: (1) a ` +
                    `mismatched explicit binding — pass the correct ` +
                    `@InjectDatabase(binding) / @InjectRepository(entity, binding); ` +
                    `(2) the module is routed to the wrong database — check its ` +
                    `databaseName or the 'database' registration modifier; or (3) ` +
                    `this is a shared helper injected across modules — a ` +
                    `context-neutral helper should take the OrmDatabase / ` +
                    `OrmRepository as a method/constructor argument (passed in by ` +
                    `the calling service, whose own injection is module-aware) ` +
                    `rather than injecting it with @InjectDatabase()/` +
                    `@InjectRepository(), which binds it to a single database.`,
            );
        }
        return metadata;
    }

    private get entitySet(): Set<OrmEntityClass> {
        if (!this._entitySet) {
            this._entitySet = new Set(this.allEntities);
        }
        return this._entitySet;
    }
    private _entitySet?: Set<OrmEntityClass>;

    /**
     * Checks if entity metadata exist for the given entity class, target name or table name.
     */
    hasMetadata(target: Constructor): boolean {
        return ormGetTable(target) !== undefined;
    }

    /**
     * Gets entity metadata for the given entity class or schema name.
     */
    getMetadata(target: Constructor): OrmTableMetadata | undefined {
        return ormGetTable(target);
    }

    getEntities(): OrmEntityClass[] {
        return this.allEntities;
    }

    /**
     * Owned entities plus external (query-only) ones. The runtime needs the
     * full set so the drizzle query schema and table-name lookups cover tables
     * this worker uses but doesn't migrate (externalSchema / inheritSchema).
     */
    private get allEntities(): OrmEntityClass[] {
        const external = this.configuration.externalEntities;
        // De-duplicate by class identity: the same table can legitimately be
        // registered more than once for a database — owned plus an external
        // reference, or declared external by several modules (a module's
        // orm.externalEntities, externalSchema registrations, inheritSchema).
        // The schema is keyed by table name so the build is idempotent anyway,
        // but deduping here avoids redundant table builds and keeps getEntities
        // honest.
        return external && external.length > 0
            ? [...new Set([...this.configuration.entities, ...external])]
            : this.configuration.entities;
    }

    getEntityByTableName(tableName: string): OrmEntityClass | undefined {
        if (!this.entityByTableName) {
            this.entityByTableName = new Map();
            for (const entity of this.allEntities) {
                const metadata = ormGetTable(entity);
                if (metadata) {
                    this.entityByTableName.set(metadata.name, entity);
                }
            }
        }
        return this.entityByTableName.get(tableName);
    }

    async count<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<number> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        return adapter.count(metadata, options);
    }

    async find<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<OrmRawData<EntityType>[]> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        return adapter.find(metadata, options);
    }

    async findOne<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptions<EntityType>,
    ): Promise<OrmRawData<EntityType> | null> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        return adapter.findOne(metadata, options);
    }

    async findAndCount<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<[OrmRawData<EntityType>[], number]> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        return adapter.findAndCount(metadata, options);
    }

    /**
     * Reject a write payload that references anything other than the entity's
     * own columns. Drizzle maps `values`/`set` by iterating the table's
     * columns, so a relation or mistyped key is silently never written — the
     * "I set X but it never persisted" bug. Entity-instance writes can't hit
     * this (they go through `getChangedFields()`, which only emits tracked
     * columns); this guards the raw `database.insert/update/upsert(...)` API
     * where the payload is an arbitrary object. `undefined` values are skipped
     * (they mean "don't write this field").
     */
    private assertWritableColumns(
        metadata: OrmTableMetadata,
        values: OrmPartialEntity<object>,
    ): void {
        const columnKeys = new Set(metadata.columns.map((c) => c.propertyKey));
        for (const [key, value] of Object.entries(values)) {
            if (value === undefined) {
                continue;
            }
            if (!columnKeys.has(key)) {
                throw new Error(
                    `Cannot write '${key}' on '${metadata.name}': it is not a column. ` +
                        `Only the entity's own columns are persisted — relations and unknown ` +
                        `fields are silently dropped by the driver, so this is rejected instead.`,
                );
            }
        }
    }

    insert<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmInsertResult<EntityType>> {
        return this.insertBatch(target, [values]);
    }

    async insertBatch<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        values: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmInsertResult<EntityType>> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        for (const row of values) {
            this.assertWritableColumns(metadata, row);
        }
        return adapter.insert(metadata, values);
    }

    /**
     * Stamps @OrmUpdateDateColumn columns into criteria-based write
     * values (unless the caller supplied them) — the same `new Date()`
     * the entity path's entityBeforeUpdate stamps. Without this, only
     * repository/entity writes maintained updatedAt; database-level
     * update/upsert/increment left it stale, silently breaking
     * updatedAt-keyed sync and the createdAt === updatedAt sentinel.
     */
    private withUpdateDates<EntityType>(
        metadata: OrmTableMetadata,
        values: OrmPartialEntity<EntityType>,
    ): OrmPartialEntity<EntityType> {
        const updateColumns = metadata.dateColumns['update'];
        if (!updateColumns || updateColumns.length === 0) {
            return values;
        }
        const stamped = { ...values } as Dictionary<unknown>;
        const now = new Date();
        for (const column of updateColumns) {
            if (stamped[column] === undefined) {
                stamped[column] = now;
            }
        }
        return stamped as OrmPartialEntity<EntityType>;
    }

    async update<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmUpdateResult<EntityType>> {
        assertScopedConditions(conditions, 'update');
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        this.assertWritableColumns(metadata, values);
        return adapter.update(
            metadata,
            conditions,
            this.withUpdateDates(metadata, values),
        );
    }

    async updateBatch<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmUpdateResult<EntityType>> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        for (const operation of operations) {
            assertScopedConditions(operation.conditions, 'update');
            this.assertWritableColumns(metadata, operation.values);
        }
        return adapter.updateBatch(
            metadata,
            operations.map((operation) => ({
                ...operation,
                values: this.withUpdateDates(metadata, operation.values),
            })),
        );
    }

    async upsert<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmPartialEntity<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmInsertResult<EntityType>> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        this.assertWritableColumns(metadata, values);
        return adapter.upsert(
            metadata,
            conditions,
            this.withUpdateDates(metadata, values),
        );
    }

    async upsertBatch<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmInsertResult<EntityType>> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        for (const operation of operations) {
            this.assertWritableColumns(metadata, operation.values);
        }
        return adapter.upsertBatch(
            metadata,
            operations.map((operation) => ({
                ...operation,
                values: this.withUpdateDates(metadata, operation.values),
            })),
        );
    }

    /**
     * Atomically execute a batch of writes spanning one or more entity
     * types. Entity class is inferred from each value's constructor —
     * just call `batch.insert(entity)` etc. The dispatcher routes each
     * call to the right per-entity builder under the hood.
     *
     * Portable across all adapters (D1 uses `db.batch`, others wrap in
     * a transaction). Operations execute in the order they're queued
     * across entity types, which matters when FKs span entities.
     */
    async writeBatch(
        build: (batch: OrmDatabaseBatch) => void,
    ): Promise<OrmBatchResult> {
        const operations: OrmBatchOperation[] = [];
        const builders = new Map<
            Constructor<OrmTrackingEntity>,
            OrmRepositoryBatchBuilder<OrmTrackingEntity>
        >();

        const builderFor = (
            ctor: Constructor<OrmTrackingEntity>,
        ): OrmRepositoryBatchBuilder<OrmTrackingEntity> => {
            const cached = builders.get(ctor);
            if (cached) return cached;
            const metadata = ormRequireTable(ctor);
            const created = new OrmRepositoryBatchBuilder<OrmTrackingEntity>(
                metadata,
                operations,
            );
            builders.set(ctor, created);
            return created;
        };

        // Group contiguous same-type entities into a single builder call.
        // For `insert`, this gathers same-type rows into one multi-row op.
        // Run-length (not full groupBy) preserves call order for FK deps.
        const dispatch = (
            method: 'insert' | 'update' | 'upsert' | 'delete',
            input: OrmTrackingEntity | ReadonlyArray<OrmTrackingEntity>,
        ): void => {
            const entities = Array.isArray(input) ? input : [input];
            if (entities.length === 0) return;

            let currentCtor: Constructor<OrmTrackingEntity> | null = null;
            let currentGroup: OrmTrackingEntity[] = [];

            const flush = () => {
                if (currentGroup.length === 0 || currentCtor === null) return;
                builderFor(currentCtor)[method](currentGroup);
                currentGroup = [];
            };

            for (const entity of entities) {
                const ctor =
                    entity.constructor as Constructor<OrmTrackingEntity>;
                if (ctor !== currentCtor) {
                    flush();
                    currentCtor = ctor;
                }
                currentGroup.push(entity);
            }
            flush();
        };

        const ctxBatch: OrmDatabaseBatch = {
            insert: (entity) => dispatch('insert', entity),
            update: (entity) => dispatch('update', entity),
            upsert: (entity) => dispatch('upsert', entity),
            delete: (entity) => dispatch('delete', entity),
            deleteWhere: (target, conditions) => {
                assertScopedConditions(conditions, 'delete');
                operations.push({
                    kind: 'delete',
                    metadata: this.requireOwnEntity(target),
                    conditions: conditions as OrmFindOptionsWhere<object>,
                });
            },
            execute: (query) => {
                operations.push({ kind: 'execute', query });
            },
        };

        build(ctxBatch);

        if (operations.length === 0) {
            return { affectedRows: 0, results: [] };
        }

        const adapter = await this.getAdapter();
        const result = await adapter.writeBatch(operations);

        for (const builder of builders.values()) {
            builder.runAfterHooks();
        }

        return result;
    }

    async delete<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
    ): Promise<OrmDeleteResult<EntityType>> {
        assertScopedConditions(conditions, 'delete');
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        return adapter.delete(metadata, conditions);
    }

    async deleteBatch<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmDeleteResult<EntityType>> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        return adapter.deleteBatch(metadata, conditions);
    }

    async truncate<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        _options: { confirm: true },
    ): Promise<OrmDeleteResult<EntityType>> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        requireTruncatable(metadata);
        return adapter.truncate(metadata);
    }

    async increment<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value: number = 1,
    ): Promise<OrmUpdateResult<EntityType>> {
        assertScopedConditions(conditions, 'increment');
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        return adapter.increment(
            metadata,
            conditions,
            column,
            value,
            this.withUpdateDates(metadata, {}),
        );
    }

    async decrement<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value: number = 1,
    ): Promise<OrmUpdateResult<EntityType>> {
        assertScopedConditions(conditions, 'decrement');
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        return adapter.decrement(
            metadata,
            conditions,
            column,
            value,
            this.withUpdateDates(metadata, {}),
        );
    }

    async timeSeries<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        column: OrmEntityKey<EntityType>,
        options: OrmTimeSeriesOptions<EntityType>,
    ): Promise<OrmTimeSeriesResult[]> {
        const adapter = await this.getAdapter();
        const metadata = this.requireOwnEntity(target);
        // The adapter resolves the column against the Drizzle table, which is
        // keyed by PROPERTY KEY (the Drizzle column object it gets back renders
        // to the right db name in SQL). So pass the property key through as-is —
        // converting it to the db `name:` here would break any column with a
        // custom name. Validate it exists so an unknown/mistyped key fails loud
        // instead of being forwarded and producing a confusing downstream error.
        const requireColumnKey = (key: string): string => {
            const exists = metadata.columns.some(
                (candidate) => candidate.propertyKey === key,
            );
            if (!exists) {
                throw new Error(
                    `Cannot compute a time series on '${key}' of '${metadata.name}': it is not a column.`,
                );
            }
            return key;
        };
        const columnName = requireColumnKey(column);
        const resolvedOptions = options.distinctColumn
            ? {
                  ...options,
                  distinctColumn: requireColumnKey(options.distinctColumn),
              }
            : options;
        return adapter.timeSeries(metadata.name, columnName, resolvedOptions);
    }

    async dispose(): Promise<void> {
        if (this._adapter) {
            await this._adapter.dispose();
            this._adapter = undefined;
        }
    }

    async getAdapter(): Promise<Adapter> {
        if (this._adapter) {
            return this._adapter;
        }

        if (!this._adapterProvider) {
            throw new Error(
                `No data adapter provider configured for data context "${this.configuration.databaseName}".`,
            );
        }

        // Include external entities so the drizzle schema can build/relate to
        // tables this worker queries but does not own/migrate.
        const dbMetadata: OrmTableMetadata[] = this.allEntities.map((entity) =>
            ormRequireTable(entity),
        );

        const adapter = await this._adapterProvider.getAdapter(
            this.name,
            this.configuration as unknown as SettingsType,
            dbMetadata,
        );

        if (isDurableAdapter(adapter)) {
            await adapter.migrate();
        }

        this._adapter = adapter;
        return this._adapter;
    }
}
