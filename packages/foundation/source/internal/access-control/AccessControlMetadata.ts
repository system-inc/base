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
     * The effective options for a handler: the most specific declaration
     * wins, field by field — the same precedence RPC visibility uses.
     *
     * Declarations rank method-level first, then class-level; within each
     * kind the handler's own class beats its base classes, nearest first.
     * Each field (`skipAuthorization`, `roles`, `entitlements`) comes from
     * the highest-ranked declaration that states it, so:
     *
     * - a method `@RequireSessionAccess` on a `@WithSessionAccess` class
     *   requires a session, and a method `@WithSessionAccess` opens one
     *   method on a guarded class;
     * - a method's `roles` replace the class's instead of widening them
     *   (role matching is any-of, so a union would let either list in);
     * - a method that doesn't state `roles` keeps the class's, so restating
     *   `@RequireSessionAccess()` never silently drops a requirement.
     *
     * Walking the prototype chain is what makes a guard declared on a base
     * class protect a registered subclass; without it an inherited
     * `@RequireSessionAccess` is silently dropped and the handler fails
     * open. `undefined` means the handler carries no access-control
     * decorators anywhere in its chain, so session access does not run
     * for it.
     */
    getSessionAccessOptionsForHandler(handler: {
        readonly target: Constructor<object>;
        readonly methodName: string;
    }): SessionAccessOptions | undefined {
        // Metadata is keyed by class, so each ancestor is looked up by its
        // own constructor.
        const methodDeclarations: SessionAccessOptions[] = [];
        const classDeclarations: SessionAccessOptions[] = [];
        let constructor: Constructor<object> | undefined = handler.target;
        while (constructor && constructor.name) {
            const methodOptions = this.methodOptions
                .get(constructor)
                ?.get(handler.methodName);
            if (methodOptions) {
                methodDeclarations.push(methodOptions);
            }
            const classOptions = this.classOptions.get(constructor);
            if (classOptions) {
                classDeclarations.push(classOptions);
            }
            constructor = Object.getPrototypeOf(constructor);
        }

        const ranked = [...methodDeclarations, ...classDeclarations];
        if (ranked.length === 0) {
            return undefined;
        }
        // Preserve the exact single-source record (a lone method or class
        // decorator) rather than normalizing it — callers and tests read
        // its precise shape.
        if (ranked.length === 1) {
            return ranked[0];
        }
        const resolved: SessionAccessOptions = {
            skipAuthorization: ranked.find(
                (options) => options.skipAuthorization !== undefined,
            )?.skipAuthorization,
        };
        const roles = ranked.find((options) => options.roles !== undefined);
        if (roles) {
            resolved.roles = roles.roles;
        }
        const entitlements = ranked.find(
            (options) => options.entitlements !== undefined,
        );
        if (entitlements) {
            resolved.entitlements = entitlements.entitlements;
        }
        return resolved;
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
