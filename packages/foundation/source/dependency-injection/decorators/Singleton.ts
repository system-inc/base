// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { singleton } from 'tsyringe';

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import type { BaseModuleKey } from '../../configuration/BaseModuleKey';
import { declareModuleMembership } from '../ModuleMembership';
import { InjectableDecoratorName } from './Injectable';

/**
 * Class decorator factory that registers the class as a singleton within
 * the global container.
 *
 * Each resolve will return the same instance (including resolves from child containers),
 * from the global scope.
 *
 * Accepts an optional `BaseModuleKey` declaring module membership —
 * see {@link Injectable}.
 *
 * You probably want to use `@ContainerScoped` or `@WorkerScoped()` instead.
 */
export function Singleton(moduleKey?: BaseModuleKey<unknown>) {
    return function <T extends Constructor<any>>(constructor: T): void {
        DecoratorRegistry.get().mark(constructor, InjectableDecoratorName);
        if (moduleKey) {
            declareModuleMembership(constructor, moduleKey);
        }
        singleton()(constructor);
    };
}
