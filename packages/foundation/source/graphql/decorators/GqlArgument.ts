// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Arg } from '@system-inc/type-graphql/decorators/Arg';

/**
 * Defines a named argument to a GraphQL operation, injected into the resolver
 * method's parameter.
 *
 * @example
 * ```ts
 * @GqlQuery(() => Book)
 * async book(@GqlArgument('id', () => String) id: string): Promise<Book> { ... }
 * ```
 */
export const GqlArgument = Arg;
