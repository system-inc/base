// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { OrmMappedJoin } from '../interfaces/find/OrmMappedJoin';
import { OrmListenerEventType } from '../interfaces/OrmListenerEventType';
import { ormGetTable, ormRequireTable } from '../metadata/OrmSchemaRegistry';
import { OrmTableMetadata } from '../metadata/OrmTableMetadata';

export interface HydrationOptions {
    /**
     * If true, returns raw objects without hydration
     */
    raw?: boolean;
    /**
     * Maximum depth for hydrating nested relations
     */
    maxDepth?: number;
    /**
     * Mapped joins from the find options. Each arrives in the raw row
     * as a JSON-aggregated column and is hydrated onto its property.
     */
    joins?: ReadonlyArray<OrmMappedJoin<any>>;
}

export class OrmEntityHydrator {
    /**
     * Hydrates a single raw object into an entity instance
     */
    static hydrateOne<T extends OrmTrackingEntity>(
        raw: unknown,
        target: Constructor<T>,
        options: HydrationOptions = {},
    ): T | null {
        if (!raw) return null;
        if (options.raw) return raw as T;

        const metadata = ormGetTable(target);
        if (!metadata) {
            throw new Error(
                `No metadata found for entity ${target.name}. Ensure @OrmTable decorator is applied.`,
            );
        }

        return this.hydrateEntity(
            raw as Dictionary<unknown>,
            target,
            metadata,
            options,
            0,
        );
    }

    /**
     * Hydrates an array of raw objects into entity instances
     */
    static hydrateMany<T extends OrmTrackingEntity>(
        raw: unknown[],
        target: Constructor<T>,
        options: HydrationOptions = {},
    ): T[] {
        if (options.raw) return raw as T[];

        const metadata = ormGetTable(target);
        if (!metadata) {
            throw new Error(
                `No metadata found for entity ${target.name}. Ensure @OrmTable decorator is applied.`,
            );
        }

        return raw.map((item) =>
            this.hydrateEntity(
                item as Dictionary<unknown>,
                target,
                metadata,
                options,
                0,
            ),
        );
    }

    private static hydrateEntity<T extends OrmTrackingEntity>(
        raw: Dictionary<unknown>,
        target: Constructor<T>,
        metadata: OrmTableMetadata,
        options: HydrationOptions,
        currentDepth: number,
    ): T {
        // Construct via the entity's static `from`, which runs the constructor
        // (installing the change-tracking accessors) and assigns through the
        // setters. Every entity is an OrmTrackingEntity, so `from` is always
        // present — no `Object.assign` fallback, which would bypass tracking.
        const instance = (
            target as unknown as { from(data: Dictionary<unknown>): T }
        ).from(raw);

        // Apply column transformers
        this.applyTransformersFromDatabase(instance, metadata);

        // Handle nested relations
        this.hydrateRelations(instance, raw, metadata, options, currentDepth);

        // Handle mapped joins (top level only — nested joins are
        // hydrated recursively with their own join specs)
        if (options.joins && currentDepth === 0) {
            this.hydrateMappedJoins(instance, raw, options.joins);
        }

        // Trigger afterLoad lifecycle hook
        this.runEntityListeners(instance, metadata, 'afterLoad');

        // Clear change tracking after hydration — a freshly-loaded entity is
        // clean. `clearChangedFields` is protected, hence the cast.
        (
            instance as unknown as { clearChangedFields(): void }
        ).clearChangedFields();

        return instance;
    }

    /**
     * Hydrates mapped-join JSON columns onto their properties. The
     * adapter emits each join as a JSON-aggregated string column named
     * after the join's property; this parses it, coerces JSON-native
     * values back to the column types, and hydrates real entities.
     */
    private static hydrateMappedJoins(
        instance: object,
        raw: Dictionary<unknown>,
        joins: ReadonlyArray<OrmMappedJoin<any>>,
    ): void {
        for (const join of joins) {
            const rawValue = raw[join.property];
            const parsed =
                typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;

            const joinedMetadata = ormGetTable(join.entity);
            if (!joinedMetadata) {
                throw new Error(
                    `Mapped join entity ${join.entity.name} is not registered as an @OrmTable.`,
                );
            }

            if (join.type === 'many') {
                const rows = Array.isArray(parsed) ? parsed : [];
                (instance as any)[join.property] = rows.map((row) =>
                    this.hydrateJoinedRow(row, join, joinedMetadata),
                );
            } else {
                (instance as any)[join.property] =
                    parsed && typeof parsed === 'object'
                        ? this.hydrateJoinedRow(parsed, join, joinedMetadata)
                        : null;
            }
        }
    }

    private static hydrateJoinedRow(
        row: Dictionary<unknown>,
        join: OrmMappedJoin<any>,
        metadata: OrmTableMetadata,
    ): OrmTrackingEntity {
        this.coerceJsonEntityValues(
            row,
            metadata,
            join.relations as Record<string, unknown> | undefined,
        );
        const entity = this.hydrateEntity(
            row,
            join.entity as Constructor<OrmTrackingEntity>,
            metadata,
            {},
            0,
        );
        if (join.joins && join.joins.length > 0) {
            this.hydrateMappedJoins(entity, row, join.joins);
            // The nested joins mutated properties after change tracking
            // was cleared; reset again so a joined entity is never born dirty.
            (
                entity as unknown as { clearChangedFields(): void }
            ).clearChangedFields();
        }
        return entity;
    }

    /**
     * Converts JSON-native values produced by a mapped join's
     * json_object() back into the column types the hydrator and entity
     * code expect (Dates, booleans, parsed json columns), recursing
     * into any nested declared relations.
     */
    private static coerceJsonEntityValues(
        row: Dictionary<unknown>,
        metadata: OrmTableMetadata,
        relations: Record<string, unknown> | undefined,
    ): void {
        for (const column of metadata.columns) {
            const value = row[column.propertyKey];
            if (value === undefined || value === null) {
                continue;
            }
            // Columns with a transformer receive their raw database
            // value; the transformer applies during hydration.
            if (column.options?.transformer) {
                continue;
            }
            switch (column.type.kind) {
                case 'integer':
                case 'float':
                case 'double':
                    if (typeof value === 'string') {
                        row[column.propertyKey] = Number(value);
                    }
                    break;
                case 'boolean':
                    row[column.propertyKey] =
                        value === true || value === 1 || value === '1';
                    break;
                case 'datetime':
                    if ((column.type.mode ?? 'date') === 'date') {
                        row[column.propertyKey] = this.parseJsonDateTime(value);
                    }
                    break;
                case 'json':
                    if (typeof value === 'string') {
                        row[column.propertyKey] = JSON.parse(value);
                    }
                    break;
                case 'bigint':
                    // Projected as an exact digit string through the JSON
                    // (see buildJoinJsonRow); restore the declared mode.
                    row[column.propertyKey] =
                        column.type.mode === 'bigint'
                            ? BigInt(value as string | number)
                            : Number(value);
                    break;
                case 'decimal':
                    row[column.propertyKey] =
                        column.type.mode === 'bigint'
                            ? BigInt(value as string | number)
                            : column.type.mode === 'number'
                              ? Number(value)
                              : String(value);
                    break;
                case 'enum':
                case 'varchar':
                case 'char':
                case 'text':
                case 'bytes':
                case 'uuid':
                    // JSON-safe as-is; no coercion needed
                    break;
            }
        }

        if (relations) {
            for (const [propertyKey, spec] of Object.entries(relations)) {
                if (!spec) {
                    continue;
                }
                const relation = metadata.relations.find(
                    (candidate) => candidate.propertyKey === propertyKey,
                );
                if (!relation) {
                    throw new Error(
                        `Cannot hydrate join relation '${propertyKey}' on '${metadata.name}': it is not a declared relation.`,
                    );
                }
                const targetMetadata = ormRequireTable(relation.target());
                const nested =
                    typeof spec === 'object'
                        ? (spec as Record<string, unknown>)
                        : undefined;
                const value = row[propertyKey];
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (item && typeof item === 'object') {
                            this.coerceJsonEntityValues(
                                item as Dictionary<unknown>,
                                targetMetadata,
                                nested,
                            );
                        }
                    }
                } else if (value && typeof value === 'object') {
                    this.coerceJsonEntityValues(
                        value as Dictionary<unknown>,
                        targetMetadata,
                        nested,
                    );
                }
            }
        }
    }

    /**
     * Parses a datetime value as it appears inside JSON aggregation:
     * MySQL emits 'YYYY-MM-DD HH:MM:SS[.ffffff]' (UTC, no timezone
     * marker), SQLite stores ISO strings, and numeric values are epoch
     * milliseconds.
     */
    private static parseJsonDateTime(value: unknown): Date {
        if (value instanceof Date) {
            return value;
        }
        if (typeof value === 'number') {
            return new Date(value);
        }
        const text = String(value);
        if (text.includes('T')) {
            return new Date(text);
        }
        return new Date(text.replace(' ', 'T') + 'Z');
    }

    private static hydrateRelations<T extends OrmTrackingEntity>(
        instance: T,
        raw: Dictionary<unknown>,
        metadata: OrmTableMetadata,
        options: HydrationOptions,
        currentDepth: number,
    ): void {
        // Check if we've reached the maximum depth
        if (
            options.maxDepth !== undefined &&
            currentDepth >= options.maxDepth
        ) {
            return;
        }

        // Hydrate each relation that exists in the raw data
        for (const relation of metadata.relations) {
            const rawRelation = raw[relation.propertyKey];
            if (rawRelation === undefined || rawRelation === null) {
                continue;
            }

            const targetCtor = relation.target();
            const nextDepth = currentDepth + 1;

            // Handle different relation types
            switch (relation.type) {
                case 'many-to-one':
                case 'one-to-one':
                    // Single entity relation
                    (instance as any)[relation.propertyKey] =
                        this.hydrateEntity(
                            rawRelation as Dictionary<unknown>,
                            targetCtor as Constructor<OrmTrackingEntity>,
                            ormRequireTable(
                                targetCtor as Constructor<OrmTrackingEntity>,
                            ),
                            options,
                            nextDepth,
                        );
                    break;

                case 'one-to-many':
                    // Array of entities relation
                    if (Array.isArray(rawRelation)) {
                        const targetMetadata = ormRequireTable(
                            targetCtor as Constructor<OrmTrackingEntity>,
                        );
                        (instance as any)[relation.propertyKey] =
                            rawRelation.map((item) =>
                                this.hydrateEntity(
                                    item as Dictionary<unknown>,
                                    targetCtor as Constructor<OrmTrackingEntity>,
                                    targetMetadata,
                                    options,
                                    nextDepth,
                                ),
                            );
                    }
                    break;
            }
        }
    }

    private static runEntityListeners(
        entity: OrmTrackingEntity,
        metadata: OrmTableMetadata,
        event: OrmListenerEventType,
    ): void {
        const listeners = metadata.listeners[event];
        if (!listeners) return;

        for (const listener of listeners) {
            const method = (entity as any)[listener];
            if (typeof method === 'function') {
                method.call(entity);
            }
        }
    }

    /**
     * Applies value transformers when hydrating from database
     */
    private static applyTransformersFromDatabase<T extends OrmTrackingEntity>(
        instance: T,
        metadata: OrmTableMetadata,
    ): void {
        for (const column of metadata.columns) {
            const transformer = column.options?.transformer;
            if (transformer && column.propertyKey in instance) {
                const rawValue = (instance as any)[column.propertyKey];
                if (rawValue !== undefined && rawValue !== null) {
                    // A failing transformer must abort, not swallow: keeping the
                    // raw value would hand back an untransformed (e.g. still
                    // encrypted, or unparsed) value as if it were the real one.
                    try {
                        (instance as any)[column.propertyKey] =
                            transformer.from(rawValue);
                    } catch (error) {
                        throw new Error(
                            `Failed to transform column '${column.propertyKey}' of '${metadata.name}' from the database: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                }
            }
        }
    }

    /**
     * Applies value transformers when preparing data for database
     * This should be called before insert/update operations
     */
    static applyTransformersToDatabase<T extends object>(
        data: T,
        metadata: OrmTableMetadata,
    ): T {
        const transformed = { ...data } as any;

        for (const column of metadata.columns) {
            const transformer = column.options?.transformer;
            if (transformer && column.propertyKey in transformed) {
                const value = transformed[column.propertyKey];
                if (value !== undefined && value !== null) {
                    // Abort rather than persist the untransformed value — e.g.
                    // writing plaintext where an encryption transformer was
                    // expected to run.
                    try {
                        transformed[column.propertyKey] = transformer.to(value);
                    } catch (error) {
                        throw new Error(
                            `Failed to transform column '${column.propertyKey}' of '${metadata.name}' for the database: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                }
            }
        }

        return transformed as T;
    }
}
