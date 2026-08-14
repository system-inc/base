// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/**
 * Type helper that represents the raw data form of an entity.
 * Strips out methods, tracking fields, and other non-data properties,
 * leaving only the plain data that would be stored in the database.
 *
 * @remarks
 * This type is used by OrmDatabase methods to accurately represent
 * that they return plain JavaScript objects from the database, not
 * entity instances with methods and tracking capabilities.
 *
 * @example
 * ```typescript
 * class UserEntity extends OrmTrackingEntity {
 *     id: string;
 *     name: string;
 *     email: string;
 *
 *     getName(): string { return this.name; }
 * }
 *
 * // OrmRawData<UserEntity> would be:
 * // {
 * //     id: string;
 * //     name: string;
 * //     email: string;
 * // }
 * ```
 */
export type OrmRawData<T> = {
    [K in keyof T as T[K] extends Function
        ? never // Exclude methods
        : K extends '_originalData' | '_changedFields'
          ? never // Exclude tracking fields
          : K extends symbol
            ? never // Exclude symbols
            : K]: T[K];
};
