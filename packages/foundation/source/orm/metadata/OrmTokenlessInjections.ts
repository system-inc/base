// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { AnyClass } from '@system-inc/base-common/type/Constructor';

/**
 * Classes with at least one token-less `@InjectRepository`/`@InjectDatabase`
 * parameter, marked at class-definition time by those decorators.
 *
 * Token-less injections resolve through the class's declared module
 * membership (or the default database) — never through registration. This
 * registry lets `BaseAppManifest.validate()` catch, at boot, a class
 * registered by a non-default-database module that forgot to declare its
 * membership and would otherwise silently resolve to the default database.
 */
const TOKENLESS = new WeakSet<AnyClass>();

/** @internal called by the token-less ORM inject decorators */
export function ormMarkTokenlessInjection(ctor: AnyClass): void {
    TOKENLESS.add(ctor);
}

/**
 * Whether `ctor` (or a base class — reflect-metadata inherits constructor
 * injection metadata through the prototype chain, so the subclass injects
 * too) has a token-less ORM injection.
 */
export function ormHasTokenlessInjection(ctor: AnyClass): boolean {
    let current: AnyClass | null = ctor;
    while (typeof current === 'function' && current.name) {
        if (TOKENLESS.has(current)) {
            return true;
        }
        current = Object.getPrototypeOf(current) as AnyClass | null;
    }
    return false;
}
