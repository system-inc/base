// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { FieldResolver } from '@system-inc/type-graphql/decorators/FieldResolver';

/**
 * Defines a computed field on the resolver's object type, resolved per
 * request. Inject the parent object with `@GqlRootObject()`.
 *
 * @example
 * ```ts
 * @GqlResolver(() => Book)
 * export class BookResolver {
 *     @GqlFieldResolver(() => String)
 *     displayTitle(@GqlRootObject() book: Book): string {
 *         return `${book.title} (${book.year})`;
 *     }
 * }
 * ```
 */
export const GqlFieldResolver = FieldResolver;
