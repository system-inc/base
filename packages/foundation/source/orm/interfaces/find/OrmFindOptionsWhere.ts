// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmFilter } from '../../filters/OrmFilter';

/**
 * Where conditions for ORM find operations.
 *
 * Supports both direct values (implicitly treated as equals) and explicit filter operators.
 * This maintains backward compatibility while adding advanced filtering capabilities.
 *
 * @example
 * ```typescript
 * // Direct value (implicit equals) - backward compatible
 * { age: 25, status: 'active' }
 *
 * // Using explicit filter operators
 * { age: { type: 'gt', value: 18 } }
 *
 * // Mixed usage
 * {
 *   status: 'active',  // implicit equals
 *   age: { type: 'between', min: 18, max: 65 },
 *   name: { type: 'like', pattern: 'John%' }
 * }
 *
 * // Filter by a related entity's column (compiles to an EXISTS subquery)
 * { profileEntitlement: { profileId: '...' } }
 * ```
 */
type OrmWhereFieldValue<V> =
    | V
    | OrmFilter<V>
    | null
    | (NonNullable<V> extends ReadonlyArray<infer E>
          ? E extends object
              ? OrmFindOptionsWhere<E>
              : never
          : NonNullable<V> extends object
            ? OrmFindOptionsWhere<NonNullable<V>>
            : never);

export type OrmFindOptionsWhere<T> = {
    [K in keyof T]?: OrmWhereFieldValue<T[K]>;
};
