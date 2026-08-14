// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { container, type DependencyContainer } from 'tsyringe';

import { Mutable } from '@system-inc/base-common/type/UtilityTypes';
import {
    BaseInjectionContainer,
    BaseInjectionContainerScope,
} from '../../dependency-injection/BaseInjectionContainer';

/**
 * Gets the global scoped base container.
 *
 * @returns
 */
export function getGlobalContainer(): BaseInjectionContainer {
    const hasScope = 'scope' in container;
    if (!hasScope) {
        setupBaseContainer(container, '@global');
    }
    return container as BaseInjectionContainer;
}

/**
 * Creates a new worker-scoped base container as a child of the global
 * container. Always returns a fresh container — caching was removed
 * because multiple Durable Object instances share a Worker isolate and
 * each needs an isolated container. Sharing by worker name caused
 * `@WorkerScoped` singletons (like DO-side RPC services) to leak state
 * across sibling DO instances and trigger cross-DO I/O errors.
 *
 * Each caller that wants a persistent container (e.g. `BaseWorker`)
 * should cache the result itself.
 */
export function createWorkerContainer(): BaseInjectionContainer {
    return setupBaseContainer(
        getGlobalContainer().createChildContainer(),
        '@worker',
    );
}

/**
 * Creates a child container with the specified scope.
 * The child container will inherit the parent container's registrations.
 *
 * @param scope
 * @returns
 */
export function createWorkerChildContainer(
    parentContainer: BaseInjectionContainer,
    scope: Exclude<BaseInjectionContainerScope, '@global' | '@worker'>,
): BaseInjectionContainer {
    if (parentContainer.scope !== '@worker') {
        throw new Error(
            `Cannot create a child on ${parentContainer.scope} container with scope: ${scope}`,
        );
    }
    return setupBaseContainer(parentContainer.createChildContainer(), scope);
}

/**
 * Sets up the base container with the specified scope.
 *
 * @param container
 * @param scope
 * @returns
 */
function setupBaseContainer(
    container: DependencyContainer,
    scope: BaseInjectionContainerScope,
): BaseInjectionContainer {
    const mutableContainer = container as Mutable<BaseInjectionContainer>;
    mutableContainer.scope = scope;
    return mutableContainer;
}
