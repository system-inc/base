// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { AnyClass } from '@system-inc/base-common/type/Constructor';
import type { BaseModuleKey } from '../configuration/BaseModuleKey';

/**
 * Declared module membership.
 *
 * A class declares which module it belongs to by passing a `BaseModuleKey`
 * to its injectable-family decorator — `@Injectable(SomeModuleKey)`,
 * `@WorkerScoped(SomeModuleKey)`, `@ContainerScoped(SomeModuleKey)`, etc.
 * Membership drives module-aware database resolution: a token-less
 * `@InjectRepository`/`@InjectDatabase` in a member class resolves to the
 * database its module resolves to in the running worker (the module's
 * `orm.databaseName`, as overridden by the worker's `database` registration
 * modifier). Because every class participating in constructor injection
 * already carries one of these decorators, membership is declared where the
 * injection capability is declared — never inferred from registration lists.
 */
const MEMBERSHIPS = new WeakMap<AnyClass, BaseModuleKey<unknown>>();

/**
 * Records that `ctor` is a member of the module named by `moduleKey`.
 * A class belongs to exactly one module — declaring a second, different
 * module throws.
 *
 * @internal called by the injectable-family class decorators
 */
export function declareModuleMembership(
    ctor: AnyClass,
    moduleKey: BaseModuleKey<unknown>,
): void {
    const existing = MEMBERSHIPS.get(ctor);
    if (existing && existing.name !== moduleKey.name) {
        throw new Error(
            `Class "${ctor.name}" declares membership in module "${moduleKey.name}" but is already declared a member of module "${existing.name}". A class belongs to exactly one module.`,
        );
    }
    MEMBERSHIPS.set(ctor, moduleKey);
}

/**
 * The module key `ctor` declared membership in, or `undefined` if it never
 * declared one. Walks the prototype chain, so a subclass inherits its base
 * class's membership unless it declares its own.
 */
export function getModuleMembership(
    ctor: AnyClass,
): BaseModuleKey<unknown> | undefined {
    let current: AnyClass | null = ctor;
    while (typeof current === 'function' && current.name) {
        const membership = MEMBERSHIPS.get(current);
        if (membership) {
            return membership;
        }
        current = Object.getPrototypeOf(current) as AnyClass | null;
    }
    return undefined;
}
