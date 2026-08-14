// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InputType } from '@system-inc/type-graphql/decorators/InputType';

/**
 * An object that can be created from the input to a GraphQL operation.
 * This will also create the input in the GraphQL schema.
 *
 * @example
 * ```ts
 * @GqlInputType()
 * export class BookCreateInput {
 *     @GqlField(() => String)
 *     title: string;
 * }
 * ```
 */
export const GqlInputType = InputType;
