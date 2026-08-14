// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '../type/Constructor';

/**
 * Tracks which classes have been marked by which decorators, so settings
 * validation can confirm that classes registered into decorator-driven
 * slots (e.g. `rpc.procedures`, `router.services`) actually carry the
 * required decorator.
 *
 * Decorators call {@link mark} when applied; {@link assertAll} is used at
 * boot from {@link BaseAppManifest} to enforce the contract.
 *
 * Membership is held in per-name `WeakSet`s so decorated classes remain
 * eligible for garbage collection in test/HMR scenarios.
 */
export class DecoratorRegistry {
    private static instance: DecoratorRegistry | undefined;

    static get(): DecoratorRegistry {
        return (DecoratorRegistry.instance ??= new DecoratorRegistry());
    }

    constructor() {}

    private readonly markers = new Map<string, WeakSet<Constructor<object>>>();

    mark(target: Constructor<object>, decoratorName: string): void {
        let set = this.markers.get(decoratorName);
        if (!set) {
            set = new WeakSet();
            this.markers.set(decoratorName, set);
        }
        set.add(target);
    }

    has(target: Constructor<object>, decoratorName: string): boolean {
        return this.markers.get(decoratorName)?.has(target) ?? false;
    }

    /**
     * Throws if any class in `targets` was not marked with `@<decoratorName>`.
     * `slot` names the settings field for the error message.
     */
    assertAll(
        targets: readonly Constructor<object>[],
        decoratorName: string,
        slot: string,
    ): void {
        const missing = targets.filter((t) => !this.has(t, decoratorName));
        if (missing.length === 0) {
            return;
        }
        const names = missing.map((t) => t.name || '<anonymous>').join(', ');
        throw new Error(
            `${slot} contains class(es) missing @${decoratorName}: ${names}`,
        );
    }
}
