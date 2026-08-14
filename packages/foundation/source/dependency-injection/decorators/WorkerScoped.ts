// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { DependencyContainer, injectable } from 'tsyringe';

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import type { BaseModuleKey } from '../../configuration/BaseModuleKey';
import { getGlobalContainer } from '../../internal/dependency-injection/InjectionContainers';
import { BaseInjectionContainer } from '../BaseInjectionContainer';
import { declareModuleMembership } from '../ModuleMembership';
import { InjectableDecoratorName } from './Injectable';

/**
 * Class decorator factory that registers the class with the `@worker` scoped container.
 *
 * Each resolve will return the same instance (including resolves from child containers),
 * from the `@worker` scope.
 *
 * Accepts an optional `BaseModuleKey` declaring module membership —
 * see {@link Injectable}.
 *
 * Very similar to @Singleton, but scoped to the worker instead of globally.
 */
export function WorkerScoped(moduleKey?: BaseModuleKey<unknown>) {
    return function <T extends Constructor<any>>(constructor: T) {
        DecoratorRegistry.get().mark(constructor, InjectableDecoratorName);
        if (moduleKey) {
            declareModuleMembership(constructor, moduleKey);
        }
        injectable()(constructor);
        const factory = (dependencyContainer: DependencyContainer) => {
            const workerContainer = getWorkerContainer(
                dependencyContainer as InternalBaseDependencyContainer,
            );
            if (workerContainer) {
                if (!workerContainer.isRegistered(constructor)) {
                    workerContainer.register(constructor, {
                        useClass: constructor,
                    });
                }
                const instance = workerContainer.resolve(constructor);
                workerContainer.registerInstance(constructor, instance);
                return instance;
            } else {
                throw new Error(
                    `Unable to resolve WorkerScoped dependency: ${constructor.name}. No worker container found.`,
                );
            }
        };
        getGlobalContainer().register(constructor, {
            useFactory: factory,
        });
    };
}

interface InternalBaseDependencyContainer extends BaseInjectionContainer {
    readonly parent: InternalBaseDependencyContainer | undefined;
}

function getWorkerContainer(
    container: InternalBaseDependencyContainer,
): InternalBaseDependencyContainer | undefined {
    if (container.scope === '@worker') {
        return container;
    }
    if (container.parent) {
        return getWorkerContainer(container.parent);
    }
}
