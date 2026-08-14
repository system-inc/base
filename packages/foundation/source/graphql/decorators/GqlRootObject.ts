// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Root } from '@system-inc/type-graphql/decorators/Root';

/**
 * Injects the parent (root) object of the operation into a resolver method
 * parameter — typically used inside a `@GqlFieldResolver`.
 *
 * @example
 * ```ts
 * @GqlFieldResolver(() => String)
 * displayTitle(@GqlRootObject() book: Book): string {
 *     return `${book.title} (${book.year})`;
 * }
 * ```
 */
export const GqlRootObject = Root;
