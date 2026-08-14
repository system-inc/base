// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ObjectType } from '@system-inc/type-graphql/decorators/ObjectType';

/**
 * An object that can be returned from a GraphQL resolver. Creates the type in
 * the GraphQL schema; its `@GqlField` properties become the type's fields.
 *
 * @example
 * ```ts
 * @GqlObjectType()
 * export class Book {
 *     @GqlField(() => String)
 *     title: string;
 * }
 * ```
 */
export const GqlObjectType = ObjectType;
