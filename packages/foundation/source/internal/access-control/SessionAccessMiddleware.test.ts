// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { RequireSessionAccess } from '../../access-control/decorators/RequireSessionAccess';
import { WithSessionAccess } from '../../access-control/decorators/WithSessionAccess';
import { SessionAccessOptions } from '../../access-control/SessionAccessOptions';
import { SessionContext } from '../../access-control/SessionContext';
import { SessionContextProvider } from '../../access-control/SessionContextProvider';
import { SessionContextRequestKey } from '../../access-control/SessionContextRequestKey';
import { BaseSettings } from '../../base/BaseSettings';
import { BaseAppManifest } from '../../configuration/BaseAppManifest';
import { BaseError } from '../../error/BaseError';
import {
    ERROR_CODE_AUTHENTICATION_REQUIRED,
    ERROR_CODE_INSUFFICIENT_ENTITLEMENTS,
    ERROR_CODE_PERMISSION_DENIED,
} from '../../error/ErrorCode';
import { HandlerRequestContext } from '../../request/HandlerRequestContext';
import { RequestContextKey } from '../../request/RequestContextKey';
import { HttpService } from '../../router/decorators/HttpService';
import { runSessionAccessMiddleware } from './SessionAccessMiddleware';

// Decorated fixtures — registered in the metadata registry at import time,
// exactly as application handlers are.

class OpenService {
    open() {}
}

class ProtectedService {
    @RequireSessionAccess()
    authenticated() {}

    @RequireSessionAccess({ roles: ['Administrator', 'Support'] })
    roleGated() {}

    @RequireSessionAccess({ entitlements: ['premium', 'trial'] })
    entitlementGated() {}

    @RequireSessionAccess({
        roles: ['Administrator'],
        entitlements: ['premium'],
    })
    fullyGated() {}

    @WithSessionAccess()
    optional() {}
}

@RequireSessionAccess({ roles: ['ClassRole'] })
class ClassGatedService {
    plain() {}

    @RequireSessionAccess({ roles: ['MethodRole'] })
    merged() {}
}

@WithSessionAccess()
class ClassOptionalService {
    @RequireSessionAccess()
    stricterMethod() {}
}

// Inheritance fixtures — the guard sits on a base class, the subclass is
// what a worker registers and dispatches. The decorators are keyed by the
// base class's name, so enforcement must walk the prototype chain.
@RequireSessionAccess({ roles: ['BaseRole'] })
class InheritedBaseService {
    inheritedMethod() {}
}

class DerivedService extends InheritedBaseService {
    ownMethod() {}
}

@RequireSessionAccess({ roles: ['GrandparentRole'] })
class GrandparentService {
    @RequireSessionAccess({ roles: ['GrandparentMethodRole'] })
    gatedMethod() {}
}

class MiddleService extends GrandparentService {}

class GrandchildService extends MiddleService {}

function makeSessionContext(options?: {
    roles?: string[];
    entitlements?: string[];
}): SessionContext {
    const accessRoles = options?.roles ?? [];
    const entitlements = options?.entitlements ?? [];
    return {
        sessionId: 'session-1',
        accountId: 'account-1',
        actorId: 'actor-1',
        accessRoles: accessRoles,
        entitlements: entitlements,
        hasAccessRole: (role) =>
            (Array.isArray(role) ? role : [role]).some((value) =>
                accessRoles.includes(value),
            ),
        hasEntitlement: (entitlement) =>
            (Array.isArray(entitlement) ? entitlement : [entitlement]).some(
                (value) => entitlements.includes(value),
            ),
        getActor: () => ({}),
    };
}

interface TestContext {
    requestContext: HandlerRequestContext;
    /** The options each provider.resolve call received, in order. */
    resolveOptions: Readonly<SessionAccessOptions>[];
    setHandler(handler: BaseHandler): void;
}

function makeRequestContext(
    handler: BaseHandler,
    options?: {
        sessionContext?: SessionContext | null;
        providerRegistered?: boolean;
    },
): TestContext {
    const store = new Map<string, unknown>();
    const resolveOptions: Readonly<SessionAccessOptions>[] = [];

    // a fresh provider class per test context, resolved from the fake
    // container exactly like the middleware resolves the registered class
    const ProviderClass = class implements SessionContextProvider {
        resolve(
            _requestContext: HandlerRequestContext,
            accessOptions: Readonly<SessionAccessOptions>,
        ): Promise<SessionContext | null> {
            resolveOptions.push(accessOptions);
            return Promise.resolve(options?.sessionContext ?? null);
        }
    };

    const requestContext = {
        handler: handler,
        get: <T>(key: RequestContextKey<T>) =>
            store.get(key.name) as T | undefined,
        set: <T>(key: RequestContextKey<T>, value: T) => {
            store.set(key.name, value);
        },
        configuration: {
            accessControl: {
                provider:
                    (options?.providerRegistered ?? true)
                        ? ProviderClass
                        : null,
                providerSource: 'test',
            },
        },
        container: {
            resolve: (target: Constructor<SessionContextProvider>) =>
                new target(),
        },
    } as unknown as HandlerRequestContext;

    return {
        requestContext: requestContext,
        resolveOptions: resolveOptions,
        setHandler(newHandler: BaseHandler) {
            (requestContext as { handler: BaseHandler }).handler = newHandler;
        },
    };
}

function handlerFor(target: new () => object, methodName: string): BaseHandler {
    return new BaseHandler(target, methodName);
}

async function expectBaseError(
    action: () => Promise<void>,
    statusCode: number,
    errorCode: string,
    message: string,
): Promise<void> {
    let caught: unknown;
    try {
        await action();
    } catch (error) {
        caught = error;
    }
    expect(caught).toBeInstanceOf(BaseError);
    const baseError = caught as BaseError;
    expect(baseError.statusCode).toBe(statusCode);
    expect(baseError.errorCode).toBe(errorCode);
    expect(baseError.message).toBe(message);
}

describe('runSessionAccessMiddleware', () => {
    it('passes a handler with no access-control metadata without resolving the provider', async () => {
        const context = makeRequestContext(handlerFor(OpenService, 'open'));
        await runSessionAccessMiddleware(context.requestContext);
        expect(context.resolveOptions).toHaveLength(0);
        expect(
            context.requestContext.get(SessionContextRequestKey),
        ).toBeUndefined();
    });

    it('throws 401 AUTHENTICATION_REQUIRED when authorization is required and no session resolves', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'authenticated'),
            { sessionContext: null },
        );
        await expectBaseError(
            () => runSessionAccessMiddleware(context.requestContext),
            401,
            ERROR_CODE_AUTHENTICATION_REQUIRED,
            'User is not authenticated.',
        );
    });

    it('passes an authenticated session when no roles or entitlements are required', async () => {
        const sessionContext = makeSessionContext();
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'authenticated'),
            { sessionContext },
        );
        await runSessionAccessMiddleware(context.requestContext);
        expect(context.requestContext.get(SessionContextRequestKey)).toBe(
            sessionContext,
        );
    });

    it('passes the handler’s merged options to the provider', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'roleGated'),
            { sessionContext: makeSessionContext({ roles: ['Support'] }) },
        );
        await runSessionAccessMiddleware(context.requestContext);
        expect(context.resolveOptions).toHaveLength(1);
        expect(context.resolveOptions[0]).toEqual({
            roles: ['Administrator', 'Support'],
            skipAuthorization: false,
        });
    });

    it('matches roles any-of', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'roleGated'),
            { sessionContext: makeSessionContext({ roles: ['Support'] }) },
        );
        await runSessionAccessMiddleware(context.requestContext);
    });

    it('throws 403 PERMISSION_DENIED when no required role is present', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'roleGated'),
            { sessionContext: makeSessionContext({ roles: ['User'] }) },
        );
        await expectBaseError(
            () => runSessionAccessMiddleware(context.requestContext),
            403,
            ERROR_CODE_PERMISSION_DENIED,
            'Required access roles not present.',
        );
    });

    it('matches entitlements any-of', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'entitlementGated'),
            { sessionContext: makeSessionContext({ entitlements: ['trial'] }) },
        );
        await runSessionAccessMiddleware(context.requestContext);
    });

    it('throws 403 INSUFFICIENT_ENTITLEMENTS when no required entitlement is present', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'entitlementGated'),
            { sessionContext: makeSessionContext({ entitlements: ['free'] }) },
        );
        await expectBaseError(
            () => runSessionAccessMiddleware(context.requestContext),
            403,
            ERROR_CODE_INSUFFICIENT_ENTITLEMENTS,
            'Required entitlement not present.',
        );
    });

    it('checks roles before entitlements when both are required and unmatched', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'fullyGated'),
            { sessionContext: makeSessionContext() },
        );
        await expectBaseError(
            () => runSessionAccessMiddleware(context.requestContext),
            403,
            ERROR_CODE_PERMISSION_DENIED,
            'Required access roles not present.',
        );
    });

    it('requires both role and entitlement requirements to match when both are present', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'fullyGated'),
            {
                sessionContext: makeSessionContext({
                    roles: ['Administrator'],
                    entitlements: ['premium'],
                }),
            },
        );
        await runSessionAccessMiddleware(context.requestContext);
    });

    it('lets an anonymous request through @WithSessionAccess without storing a session', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'optional'),
            { sessionContext: null },
        );
        await runSessionAccessMiddleware(context.requestContext);
        expect(context.resolveOptions).toHaveLength(1);
        expect(context.resolveOptions[0]!.skipAuthorization).toBe(true);
        expect(
            context.requestContext.get(SessionContextRequestKey),
        ).toBeUndefined();
    });

    it('stores the session for @WithSessionAccess when one resolves', async () => {
        const sessionContext = makeSessionContext();
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'optional'),
            { sessionContext },
        );
        await runSessionAccessMiddleware(context.requestContext);
        expect(context.requestContext.get(SessionContextRequestKey)).toBe(
            sessionContext,
        );
    });

    it('applies class-level options to undecorated methods', async () => {
        const context = makeRequestContext(
            handlerFor(ClassGatedService, 'plain'),
            { sessionContext: makeSessionContext({ roles: ['User'] }) },
        );
        await expectBaseError(
            () => runSessionAccessMiddleware(context.requestContext),
            403,
            ERROR_CODE_PERMISSION_DENIED,
            'Required access roles not present.',
        );
    });

    it('merges class and method roles any-of and passes the merged options to the provider', async () => {
        const context = makeRequestContext(
            handlerFor(ClassGatedService, 'merged'),
            { sessionContext: makeSessionContext({ roles: ['MethodRole'] }) },
        );
        await runSessionAccessMiddleware(context.requestContext);
        expect(context.resolveOptions[0]!.roles).toEqual([
            'ClassRole',
            'MethodRole',
        ]);
    });

    it('skips authorization when either the class or the method skips it', async () => {
        // class @WithSessionAccess + method @RequireSessionAccess:
        // skipAuthorization merges with OR, so the anonymous request passes
        const context = makeRequestContext(
            handlerFor(ClassOptionalService, 'stricterMethod'),
            { sessionContext: null },
        );
        await runSessionAccessMiddleware(context.requestContext);
    });

    it('enforces a base class’s @RequireSessionAccess on a subclass method', async () => {
        // DerivedService carries no metadata of its own; the guard is on
        // InheritedBaseService. A session lacking the base role must be
        // rejected — otherwise the inherited guard fails open.
        const context = makeRequestContext(
            handlerFor(DerivedService, 'ownMethod'),
            { sessionContext: makeSessionContext({ roles: ['User'] }) },
        );
        await expectBaseError(
            () => runSessionAccessMiddleware(context.requestContext),
            403,
            ERROR_CODE_PERMISSION_DENIED,
            'Required access roles not present.',
        );
    });

    it('passes a subclass method when the inherited base role is present', async () => {
        const context = makeRequestContext(
            handlerFor(DerivedService, 'ownMethod'),
            { sessionContext: makeSessionContext({ roles: ['BaseRole'] }) },
        );
        await runSessionAccessMiddleware(context.requestContext);
        expect(context.resolveOptions[0]!.roles).toEqual(['BaseRole']);
    });

    it('merges class and method options across multiple levels of inheritance', async () => {
        // GrandchildService -> MiddleService -> GrandparentService, with a
        // class guard and a method guard both declared on the grandparent.
        const context = makeRequestContext(
            handlerFor(GrandchildService, 'gatedMethod'),
            {
                sessionContext: makeSessionContext({
                    roles: ['GrandparentMethodRole'],
                }),
            },
        );
        await runSessionAccessMiddleware(context.requestContext);
        expect(context.resolveOptions[0]!.roles).toEqual([
            'GrandparentRole',
            'GrandparentMethodRole',
        ]);
    });

    it('resolves the provider for each decorated handler with that handler’s options', async () => {
        // a skip handler resolving first must not exempt a later strict
        // handler from provider policy — the provider is called again with
        // the strict handler's options (skipAuthorization false)
        const sessionContext = makeSessionContext({
            roles: ['Administrator'],
        });
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'optional'),
            { sessionContext },
        );
        await runSessionAccessMiddleware(context.requestContext);

        context.setHandler(handlerFor(ProtectedService, 'roleGated'));
        await runSessionAccessMiddleware(context.requestContext);

        expect(context.resolveOptions).toHaveLength(2);
        expect(context.resolveOptions[0]!.skipAuthorization).toBe(true);
        expect(context.resolveOptions[1]!.skipAuthorization).toBe(false);
        expect(context.requestContext.get(SessionContextRequestKey)).toBe(
            sessionContext,
        );
    });

    it('enforces the explicitly-passed handler, not a clobbered rc.handler slot', async () => {
        // Simulate a concurrent GraphQL sibling field having overwritten the
        // shared slot with an unprotected handler, while THIS field's handler
        // is protected. The explicit handler must win, so enforcement runs.
        const context = makeRequestContext(handlerFor(OpenService, 'open'), {
            sessionContext: null,
        });
        await expectBaseError(
            () =>
                runSessionAccessMiddleware(
                    context.requestContext,
                    handlerFor(ProtectedService, 'authenticated'),
                ),
            401,
            ERROR_CODE_AUTHENTICATION_REQUIRED,
            'User is not authenticated.',
        );
    });

    it('does not enforce when the explicit handler is unprotected even if the slot is protected', async () => {
        // The inverse: the slot holds a protected handler, but the field being
        // evaluated (explicit) is unprotected — it must pass straight through.
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'authenticated'),
            { sessionContext: null },
        );
        await runSessionAccessMiddleware(
            context.requestContext,
            handlerFor(OpenService, 'open'),
        );
        expect(context.resolveOptions).toHaveLength(0);
    });

    it('throws a pointed error when a decorated handler runs with no provider registered', async () => {
        const context = makeRequestContext(
            handlerFor(ProtectedService, 'authenticated'),
            { providerRegistered: false },
        );
        await expect(
            runSessionAccessMiddleware(context.requestContext),
        ).rejects.toThrow(/no SessionContextProvider is registered/);
    });
});

describe('BaseAppManifest access-control validation', () => {
    // The decorated fixtures above registered metadata at import time, so
    // access control is "in use" for this jest module registry — mirroring
    // a worker whose services carry the decorators.

    class SomeProvider implements SessionContextProvider {
        resolve(): Promise<SessionContext | null> {
            return Promise.resolve(null);
        }
    }

    class OtherProvider implements SessionContextProvider {
        resolve(): Promise<SessionContext | null> {
            return Promise.resolve(null);
        }
    }

    @HttpService()
    class GatedHttpService {
        @RequireSessionAccess()
        gated() {}
    }

    @RequireSessionAccess()
    class GatedServiceBase {}

    @HttpService()
    class DerivedGatedHttpService extends GatedServiceBase {
        handler() {}
    }

    const baseSettings = {
        name: 'access-control-validation-test',
        title: 'Access Control Validation Test',
        version: '1.0.0',
        modules: [],
    } as unknown as BaseSettings;

    it('ignores decorated classes the worker imports but does not register', () => {
        // the fixtures above put access-control metadata in the registry at
        // import time — but this worker registers none of them, so no
        // provider is demanded (a worker must not fail boot because a
        // transitively imported module contains decorated handlers)
        expect(() => BaseAppManifest.fromSettings(baseSettings)).not.toThrow();
    });

    it('rejects a registered handler with access-control metadata and no provider', () => {
        expect(() =>
            BaseAppManifest.fromSettings({
                ...baseSettings,
                services: [GatedHttpService],
            } as BaseSettings),
        ).toThrow(/GatedHttpService.*no SessionContextProvider is registered/s);
    });

    it('rejects a registered subclass whose access-control guard is inherited from a base class', () => {
        // The subclass carries no metadata of its own — the decorator is on
        // GatedServiceBase. Boot must still demand a provider, or the route
        // would serve unenforced.
        expect(() =>
            BaseAppManifest.fromSettings({
                ...baseSettings,
                services: [DerivedGatedHttpService],
            } as BaseSettings),
        ).toThrow(
            /DerivedGatedHttpService.*no SessionContextProvider is registered/s,
        );
    });

    it('accepts a registered handler when a provider is registered', () => {
        const manifest = BaseAppManifest.fromSettings({
            ...baseSettings,
            services: [GatedHttpService],
            accessControl: { provider: SomeProvider },
        } as BaseSettings);
        expect(manifest.accessControl.provider).toBe(SomeProvider);
        expect(manifest.accessControl.providerSource).toBe('worker settings');
    });

    it('rejects two different provider registrations', () => {
        const manifest = new BaseAppManifest();
        manifest.registerAccessControlProvider(SomeProvider, 'worker settings');
        expect(() =>
            manifest.registerAccessControlProvider(
                OtherProvider,
                'module "account"',
            ),
        ).toThrow(/Two different SessionContextProviders/);
    });

    it('is idempotent for the same provider registered twice', () => {
        const manifest = new BaseAppManifest();
        manifest.registerAccessControlProvider(SomeProvider, 'worker settings');
        manifest.registerAccessControlProvider(SomeProvider, 'module "a"');
        expect(manifest.accessControl.provider).toBe(SomeProvider);
    });
});
