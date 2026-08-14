// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Query } from '@system-inc/type-graphql/decorators/Query';

/**
 * Marks a method as a query operation and
 * exposes it in the GraphQL schema.
 *
 * @example
 * ```ts
 * @GqlQuery(() => [Book])
 * async books(): Promise<Book[]> {
 *     return await this.bookRepository.find({});
 * }
 * ```
 */
export const GqlQuery = Query;
