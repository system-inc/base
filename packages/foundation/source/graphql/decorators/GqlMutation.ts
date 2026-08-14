// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Mutation } from '@system-inc/type-graphql/decorators/Mutation';

/**
 * Marks a method as a mutation operation and exposes
 * it in the GraphQL schema.
 *
 * @example
 * ```ts
 * @GqlMutation(() => Book)
 * async bookCreate(
 *     @GqlArgument('input', () => BookCreateInput) input: BookCreateInput,
 * ): Promise<Book> { ... }
 * ```
 */
export const GqlMutation = Mutation;
