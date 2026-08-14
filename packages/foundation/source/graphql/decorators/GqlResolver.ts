// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Resolver } from '@system-inc/type-graphql/decorators/Resolver';
import type { ClassTypeResolver } from '@system-inc/type-graphql/decorators/types';
import type { ClassType } from '@system-inc/type-graphql/typings/index';

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';

export const GqlResolverDecoratorName = 'GqlResolver';

/**
 * A decorator that can be used to define a GraphQL Resolver.
 * This is a service that exposes operations to the GraphQL schema.
 *
 * Wraps type-graphql's `Resolver` so the class is recorded in the
 * {@link DecoratorRegistry} for boot-time settings validation.
 *
 * @example
 * ```ts
 * @Injectable()
 * @GqlResolver(() => Book)
 * export class BookResolver {
 *     @GqlQuery(() => Book)
 *     async book(@GqlArgument('id', () => String) id: string): Promise<Book> { ... }
 * }
 * ```
 */
export function GqlResolver(): ClassDecorator;
export function GqlResolver(typeFunc: ClassTypeResolver): ClassDecorator;
export function GqlResolver(objectType: ClassType): ClassDecorator;
export function GqlResolver(
    arg?: ClassTypeResolver | ClassType,
): ClassDecorator {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inner = arg ? Resolver(arg as any) : Resolver();
    return (target) => {
        DecoratorRegistry.get().mark(
            target as unknown as Constructor<object>,
            GqlResolverDecoratorName,
        );
        return inner(target);
    };
}
