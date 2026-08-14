// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { OrmFindOptionsRelations } from './OrmRelationsFindOptions';

/**
 * A reference to a column on the parent entity of a mapped join. Used as
 * a value inside {@link OrmMappedJoin.where} to express the join
 * predicate, e.g. `{ accountId: parentColumn('accountId') }`.
 *
 * `column` is the property key on the parent entity (database column
 * names are resolved from the parent's metadata).
 */
export interface OrmParentColumnReference {
    readonly type: 'parentColumn';
    readonly column: string;
}

/**
 * Creates a {@link OrmParentColumnReference} for use in a mapped join's
 * `where`.
 */
export function parentColumn(column: string): OrmParentColumnReference {
    return { type: 'parentColumn', column };
}

export function isParentColumnReference(
    value: unknown,
): value is OrmParentColumnReference {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as OrmParentColumnReference).type === 'parentColumn'
    );
}

/**
 * An ad-hoc join mapped onto a property of the found entity — the
 * escape hatch for loading related rows that are not declared relations
 * (composite predicates, filtered loads, cross-cutting lookups) without
 * paying an extra database round trip.
 *
 * Each mapped join compiles into a correlated JSON-aggregation subquery
 * inside the same SQL statement as the main find, so a find with any
 * number of mapped joins is still a single round trip. The JSON result
 * is hydrated into entity instances and assigned to `property` on the
 * parent.
 *
 * ```ts
 * sessionRepository.findOne({
 *     where: { id: sessionId },
 *     relations: { account: { emails: true } },
 *     joins: [
 *         {
 *             property: 'accessRoles',
 *             entity: AccessRoleAssignment,
 *             type: 'many',
 *             where: {
 *                 accountId: parentColumn('accountId'),
 *                 profileId: parentColumn('profileId'),
 *                 status: AccessRoleStatus.Active,
 *             },
 *             relations: { accessRole: true },
 *         },
 *     ],
 * });
 * ```
 *
 * Limitations: `where` values may be plain values, scalar Orm filters
 * (equals/notEquals/in/notIn/gt/gte/lt/lte/between/notBetween/like/
 * notLike/isNull/isNotNull), or `parentColumn()` references — composite
 * `and`/`or`/`not` filters are not supported. Result ordering inside a
 * `many` join is not guaranteed; sort in memory if it matters.
 */
export interface OrmMappedJoin<JoinedType extends object = object> {
    /**
     * The property on the parent entity the result is assigned to.
     */
    property: string;

    /**
     * The entity to join. Must be a registered @OrmTable.
     */
    entity: Constructor<JoinedType>;

    /**
     * Whether the property receives a single entity (or null) or an
     * array of entities.
     */
    type: 'one' | 'many';

    /**
     * Conditions on the joined entity, keyed by property key. All
     * conditions are ANDed. Use {@link parentColumn} to reference
     * columns of the parent entity (the join predicate); other values
     * are constants or scalar Orm filters.
     */
    where: Dictionary<unknown>;

    /**
     * Declared relations of the joined entity to load along with it,
     * nested into the same subquery.
     */
    relations?: OrmFindOptionsRelations<JoinedType>;

    /**
     * Nested mapped joins, with this join's entity as their parent.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    joins?: ReadonlyArray<OrmMappedJoin<any>>;
}
