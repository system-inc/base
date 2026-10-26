// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { AccessControlMetadata } from './AccessControlMetadata';

// Builds a distinct class that reports a chosen `.name`, so we can model two
// unrelated classes that happen to share a name across modules.
function namedClass(name: string): Constructor<object> {
    const constructor = class {};
    Object.defineProperty(constructor, 'name', { value: name });
    return constructor;
}

describe('AccessControlMetadata (constructor-identity keyed)', () => {
    it('does not let a same-named class bleed its skipAuthorization into another', () => {
        const metadata = new AccessControlMetadata();

        // Two unrelated classes both named "Service".
        const protectedService = namedClass('Service');
        const openService = namedClass('Service');

        // The protected one requires roles on a method; the open one opts a
        // (different) class out of authorization entirely.
        metadata.addMethodSessionAccessOptions(protectedService, 'handle', {
            roles: ['Administrator'],
        });
        metadata.addClassSessionAccessOptions(openService, {
            skipAuthorization: true,
        });

        const options = metadata.getSessionAccessOptionsForHandler(
            new BaseHandler(protectedService, 'handle'),
        );

        // Before the fix both keyed under "Service", so the open class's
        // skipAuthorization ORed into the protected handler.
        expect(options).toEqual({ roles: ['Administrator'] });
        expect(options?.skipAuthorization).not.toBe(true);
    });

    it('keeps class options separate for two same-named classes', () => {
        const metadata = new AccessControlMetadata();
        const a = namedClass('Dup');
        const b = namedClass('Dup');

        metadata.addClassSessionAccessOptions(a, { roles: ['A'] });
        // Before the fix this threw "options for identifier Dup already exist".
        expect(() =>
            metadata.addClassSessionAccessOptions(b, { roles: ['B'] }),
        ).not.toThrow();

        expect(
            metadata.getSessionAccessOptionsForHandler(new BaseHandler(a, 'x')),
        ).toEqual({ roles: ['A'] });
        expect(
            metadata.getSessionAccessOptionsForHandler(new BaseHandler(b, 'x')),
        ).toEqual({ roles: ['B'] });
    });

    it('still rejects decorating the same class twice at the class level', () => {
        const metadata = new AccessControlMetadata();
        const service = namedClass('Service');
        metadata.addClassSessionAccessOptions(service, { roles: ['A'] });
        expect(() =>
            metadata.addClassSessionAccessOptions(service, { roles: ['B'] }),
        ).toThrow(/already exist/);
    });

    it('still rejects decorating the same method twice', () => {
        const metadata = new AccessControlMetadata();
        const service = namedClass('Service');
        metadata.addMethodSessionAccessOptions(service, 'handle', {
            roles: ['A'],
        });
        expect(() =>
            metadata.addMethodSessionAccessOptions(service, 'handle', {
                roles: ['B'],
            }),
        ).toThrow(/already exist/);
    });

    it('resolves a subclass method guard over a base class guard by identity', () => {
        const metadata = new AccessControlMetadata();
        class Base {}
        class Derived extends Base {}
        metadata.addClassSessionAccessOptions(Base, {
            skipAuthorization: false,
            roles: ['BaseRole'],
            entitlements: ['base-entitlement'],
        });
        metadata.addMethodSessionAccessOptions(Derived, 'act', {
            skipAuthorization: false,
            roles: ['MethodRole'],
        });

        const options = metadata.getSessionAccessOptionsForHandler(
            new BaseHandler(Derived, 'act'),
        );

        // the method's roles win; the entitlements it doesn't state come
        // from the base class guard
        expect(options).toEqual({
            skipAuthorization: false,
            roles: ['MethodRole'],
            entitlements: ['base-entitlement'],
        });
    });

    it('reports class coverage by identity, walking the prototype chain', () => {
        const metadata = new AccessControlMetadata();
        class Base {}
        class Derived extends Base {}
        const unrelated = namedClass('Derived');

        metadata.addClassSessionAccessOptions(Base, { roles: ['BaseRole'] });

        expect(metadata.hasSessionAccessOptionsForClass(Derived)).toBe(true);
        // a same-named but unrelated class is not covered by Base's options
        expect(metadata.hasSessionAccessOptionsForClass(unrelated)).toBe(false);
    });
});
