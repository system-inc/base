// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Interface for transforming values between entity and database representations.
 *
 * @template EntityType - The type used in the entity (e.g., Date, object)
 * @template DatabaseType - The type stored in the database (e.g., string, number)
 */
export interface OrmValueTransformer<
    EntityType = unknown,
    DatabaseType = unknown,
> {
    /**
     * Transforms the value from the database to the entity property.
     * Called during entity hydration.
     */
    from(value: DatabaseType): EntityType;

    /**
     * Transforms the value from the entity property to the database.
     * Called during insert/update operations.
     */
    to(value: EntityType): DatabaseType;
}
