// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { injectable } from 'tsyringe';

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import type { BaseModuleKey } from '../../configuration/BaseModuleKey';
import { declareModuleMembership } from '../ModuleMembership';

/**
 * The shared `DecoratorRegistry` mark for the injectable-family class
 * decorators (`@Injectable`, `@Singleton`, `@WorkerScoped`,
 * `@ContainerScoped`, `@ResolutionScoped`). Lets the manifest recognize a
 * DI-participating class listed in a `services` array.
 */
export const InjectableDecoratorName = 'Injectable';

/**
 * Class decorator factory that allows the class'
 * dependencies to be injected at runtime.
 *
 * Uses the default registration scope: Transient.
 * A new instance will be created with each resolve
 *
 * Pass a `BaseModuleKey` to declare the class a member of that module.
 * Membership drives module-aware database resolution: token-less
 * `@InjectRepository`/`@InjectDatabase` parameters in the class resolve to
 * the database the module resolves to in the running worker (the module's
 * `orm.databaseName`, as overridden by the worker's `database` registration
 * modifier). All the injectable-family decorators (`@Singleton`,
 * `@WorkerScoped`, `@ContainerScoped`, `@ResolutionScoped`) accept the same
 * optional key.
 */
export function Injectable(moduleKey?: BaseModuleKey<unknown>) {
    return function <T extends Constructor<any>>(constructor: T): void {
        DecoratorRegistry.get().mark(constructor, InjectableDecoratorName);
        if (moduleKey) {
            declareModuleMembership(constructor, moduleKey);
        }
        injectable()(constructor);
    };
}
