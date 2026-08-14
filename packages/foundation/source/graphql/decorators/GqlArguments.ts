// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Args } from '@system-inc/type-graphql/decorators/Args';

/**
 * Injects all of a GraphQL operation's arguments as one object, typed by a
 * `@GqlArgumentsType` class.
 *
 * @example
 * ```ts
 * @GqlQuery(() => [Book])
 * async books(@GqlArguments() args: ListBooksArguments): Promise<Book[]> { ... }
 * ```
 */
export const GqlArguments = Args;
