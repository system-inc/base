// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Field } from '@system-inc/type-graphql/decorators/Field';

/**
 * A field in a `@GqlObjectType` or `@GqlInputType`, exposed in the GraphQL
 * schema.
 *
 * @example
 * ```ts
 * @GqlObjectType()
 * export class Book {
 *     @GqlField(() => String)
 *     title: string;
 *
 *     @GqlField(() => Number, { nullable: true })
 *     year: number | null;
 * }
 * ```
 */
export const GqlField = Field;
