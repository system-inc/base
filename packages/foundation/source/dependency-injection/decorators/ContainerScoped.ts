// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Lifecycle, scoped } from 'tsyringe';

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import type { BaseModuleKey } from '../../configuration/BaseModuleKey';
import { declareModuleMembership } from '../ModuleMembership';
import { InjectableDecoratorName } from './Injectable';

/**
 * Class decorator factory that will cause the dependency container to
 * return the same instance each time a resolution
 * for this dependency is requested. This is similar to being a singleton,
 * however if a child container is made, that child container will resolve
 * an instance unique to it.
 *
 * Accepts an optional `BaseModuleKey` declaring module membership —
 * see {@link Injectable}.
 */
export function ContainerScoped(
    moduleKey?: BaseModuleKey<unknown>,
): <T extends new (...args: any[]) => any>(target: T) => void {
    return (target) => {
        DecoratorRegistry.get().mark(target, InjectableDecoratorName);
        if (moduleKey) {
            declareModuleMembership(target, moduleKey);
        }
        scoped(Lifecycle.ContainerScoped)(target);
    };
}
