// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ArgsType } from '@system-inc/type-graphql/decorators/ArgsType';

/**
 * An object that can be created from the input to a GraphQL operation.
 * This is a virtual object and will not be created in the GraphQL schema —
 * its fields become individual arguments of the operation. Inject it with
 * `@GqlArguments()`.
 *
 * @example
 * ```ts
 * @GqlArgumentsType()
 * export class ListBooksArguments {
 *     @GqlField(() => Number)
 *     limit: number;
 *
 *     @GqlField(() => String, { nullable: true })
 *     genre: string | null;
 * }
 * ```
 */
export const GqlArgumentsType = ArgsType;
