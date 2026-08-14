// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { SessionAccessOptions } from '../../access-control/SessionAccessOptions';

/**
 * Metadata registry for access control requirements.
 *
 * Populated by the `@RequireSessionAccess` and `@WithSessionAccess`
 * decorators at class definition time and read by the session-access
 * middleware at request time.
 *
 * Keyed by **constructor identity**, not class name: two unrelated
 * classes that happen to share a name (common across modules) must not
 * collide. Name-string keying let one class's `@WithSessionAccess`
 * (`skipAuthorization`) bleed into a same-named `@RequireSessionAccess`
 * handler — silently disabling authorization — and threw at boot for
 * legitimate same-named classes.
 */
export class AccessControlMetadata {
    private readonly classOptions = new Map<
        Constructor<object>,
        SessionAccessOptions
    >();
    private readonly methodOptions = new Map<
        Constructor<object>,
        Map<string, SessionAccessOptions>
    >();

    addClassSessionAccessOptions(
        target: Constructor<object>,
        options: SessionAccessOptions,
    ) {
        if (this.classOptions.has(target)) {
            throw new Error(
                `Session access control options for class ${target.name} already exist.`,
            );
        }
        this.classOptions.set(target, options);
    }

    addMethodSessionAccessOptions(
        target: Constructor<object>,
        methodName: string,
        options: SessionAccessOptions,
    ) {
        let methods = this.methodOptions.get(target);
        if (!methods) {
            methods = new Map();
            this.methodOptions.set(target, methods);
        }
        if (methods.has(methodName)) {
            throw new Error(
                `Session access control options for ${target.name}.${methodName} already exist.`,
            );
        }
        methods.set(methodName, options);
    }

    /**
     * Whether the class carries access-control options — on the class
     * itself, any of its methods, or anything it inherits from a base
     * class. Used by boot validation to require a provider for
     * *registered* handlers only: decorators run at import time, so the
     * registry also holds classes a worker merely imports transitively
     * without registering, and those must not demand a provider. Walks
     * the prototype chain so a subclass registered on its own — with the
     * decorators sitting on a shared base class — is still recognized
     * (otherwise boot would pass and the route would serve unenforced).
     */
    hasSessionAccessOptionsForClass(target: Constructor<object>): boolean {
        let constructor: Constructor<object> | undefined = target;
        while (constructor && constructor.name) {
            if (this.classOptions.has(constructor)) {
                return true;
            }
            const methods = this.methodOptions.get(constructor);
            if (methods && methods.size > 0) {
                return true;
            }
            constructor = Object.getPrototypeOf(constructor);
        }
        return false;
    }

    /**
     * The effective options for a handler — the class options and method
     * options from the handler's own class and every base class it
     * inherits from, merged (role/entitlement lists concatenate,
     * `skipAuthorization` ORs). Walking the prototype chain is what makes
     * a guard declared on a base class protect a registered subclass;
     * without it an inherited `@RequireSessionAccess` is silently dropped
     * and the handler fails open. `undefined` means the handler carries
     * no access-control decorators anywhere in its chain, so session
     * access does not run for it.
     */
    getSessionAccessOptionsForHandler(handler: {
        readonly target: Constructor<object>;
        readonly methodName: string;
    }): SessionAccessOptions | undefined {
        // Collect class-then-method options at each level from the concrete
        // class up through its base classes. Metadata is keyed by class
        // name, so each ancestor is looked up by its own name.
        const collected: SessionAccessOptions[] = [];
        let constructor: Constructor<object> | undefined = handler.target;
        while (constructor && constructor.name) {
            const classOptions = this.classOptions.get(constructor);
            if (classOptions) {
                collected.push(classOptions);
            }
            const methodOptions = this.methodOptions
                .get(constructor)
                ?.get(handler.methodName);
            if (methodOptions) {
                collected.push(methodOptions);
            }
            constructor = Object.getPrototypeOf(constructor);
        }

        if (collected.length === 0) {
            return undefined;
        }
        // Preserve the exact single-source record (a lone method or class
        // decorator) rather than normalizing it — callers and tests read
        // its precise shape.
        if (collected.length === 1) {
            return collected[0];
        }
        return {
            skipAuthorization: collected.some(
                (options) => options.skipAuthorization === true,
            ),
            roles: collected.flatMap((options) => options.roles ?? []),
            entitlements: collected.flatMap(
                (options) => options.entitlements ?? [],
            ),
        };
    }
}

// Module-scope singleton — import-time state this subsystem owns, the same
// pattern as DecoratorRegistry and OrmSchemaRegistry. Deliberately NOT on
// globalThis: that would outlive jest's per-file module registry and
// dev-server reloads that reset decorator state.
const accessControlMetadata = new AccessControlMetadata();

export function getAccessControlMetadata(): AccessControlMetadata {
    return accessControlMetadata;
}
