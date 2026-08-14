// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/**
 * Options for loading relations.
 * Can be a boolean to load the relation, or nested options for loading nested relations.
 *
 * @example
 * ```typescript
 * // Load user relation
 * { user: true }
 *
 * // Load user and their posts
 * { user: { posts: true } }
 *
 * // Load user, their posts, and comments on those posts
 * { user: { posts: { comments: true } } }
 * ```
 */
export type OrmFindOptionsRelations<T> = {
    [K in keyof T as T[K] extends Function ? never : K]?: T[K] extends
        | ReadonlyArray<infer U>
        | undefined
        ? boolean | OrmFindOptionsRelations<U>
        : T[K] extends object | null | undefined
          ? boolean | OrmFindOptionsRelations<NonNullable<T[K]>>
          : never;
};
