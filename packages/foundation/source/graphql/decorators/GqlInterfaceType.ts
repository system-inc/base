// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InterfaceType } from '@system-inc/type-graphql/decorators/InterfaceType';

/**
 * Defines an interface type in the GraphQL schema, implemented by object
 * types.
 *
 * @example
 * ```ts
 * @GqlInterfaceType()
 * export abstract class Node {
 *     @GqlField(() => String)
 *     id: string;
 * }
 *
 * @GqlObjectType({ implements: Node })
 * export class Book extends Node { ... }
 * ```
 */
export const GqlInterfaceType = InterfaceType;
