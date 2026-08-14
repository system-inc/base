// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { IttyRouter } from 'itty-router';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { HttpErrors } from '../../error/HttpErrors';
import { UnhandledExceptionEventName } from '../../event/UnhandledExceptionEvent';
import { HttpBody } from '../../router/decorators/HttpBody';
import { HttpQuery } from '../../router/decorators/HttpQuery';
import { HttpRoute } from '../../router/decorators/HttpRoute';
import { HttpService } from '../../router/decorators/HttpService';
import { BaseRouter } from './BaseRouter';

// ---- Route-dispatch harness -------------------------------------------------
// Builds a real BaseRouter over IttyRouter, binds a set of decorated services,
// and dispatches a Request through the full handler pipeline (global
// middleware, handler resolution, parameter binding, response coercion).

function makeConfiguration(
    services: Constructor<object>[],
    globalMiddleware: unknown[] = [],
    handlerMiddleware: unknown[] = [],
): BaseConfiguration {
    return {
        router: { services: services, cors: undefined, rewrite: undefined },
        runtime: { environment: { type: 'Development' } },
        middleware: { global: globalMiddleware, handler: handlerMiddleware },
        accessControl: { provider: null },
        getVersionInfo: () => ({}),
    } as unknown as BaseConfiguration;
}

/**
 * Events the router deferred during the last dispatch. The bus is faked
 * down to `defer` — what's under test is WHICH exceptions reach it and
 * what they carry, not the bus's own delivery (covered by
 * `event/BaseEventBus.test.ts`).
 */
let deferredEvents: Array<Record<string, unknown>> = [];

function makeRequestContext(configuration: BaseConfiguration): unknown {
    return {
        container: {
            resolve: (ctor: new () => unknown) => new ctor(),
            resolveAll: () => [],
        },
        eventBus: {
            defer: (event: Record<string, unknown>) => {
                deferredEvents.push(event);
            },
        },
        requestId: 'request-1',
        ipAddress: '203.0.113.7',
        userAgent: 'jest-agent',
        stopWatch: {
            split: () => {},
            stop: () => {},
            getTotalElapsedTime: () => 0,
            toString: () => '',
        },
        handler: undefined,
        configuration: configuration,
        cookies: {},
        route: '',
        graphql: undefined,
        rpc: undefined,
        set: () => {},
        get: () => undefined,
    };
}

interface TestRouter {
    dispatch(
        method: string,
        url: string,
        init?: RequestInit,
    ): Promise<Response>;
}

function makeTestRouter(
    services: Constructor<object>[],
    globalMiddleware: unknown[] = [],
    handlerMiddleware: unknown[] = [],
): TestRouter {
    const configuration = makeConfiguration(
        services,
        globalMiddleware,
        handlerMiddleware,
    );
    const router = new BaseRouter(IttyRouter(), configuration);
    router.bindRoutes();
    return {
        async dispatch(method, url, init) {
            const request = new Request(url, {
                method: method,
                ...init,
            }) as unknown as {
                context: unknown;
            };
            request.context = makeRequestContext(configuration);
            return router.handleRequest(request as never);
        },
    };
}

// ---- Smoke test -------------------------------------------------------------

@HttpService()
class EchoService {
    @HttpRoute('GET', 'echo')
    echo(@HttpQuery('value') value: string): Response {
        return new Response(value);
    }
}

// A shared base class with a route, and a subclass registered as the service.
class InheritableRouteBase {
    @HttpRoute('GET', 'inherited')
    inherited(): Response {
        return new Response('from-base');
    }
}

@HttpService()
class DerivedRouteService extends InheritableRouteBase {
    @HttpRoute('GET', 'own')
    own(): Response {
        return new Response('from-derived');
    }
}

@HttpService()
class OrphanParamService {
    // parameter decorator but NO @HttpRoute — a mistake that must be caught
    orphan(@HttpQuery('x') x: string): Response {
        return new Response(x);
    }
}

// A non-primitive named-parameter type: takes the raw string value.
class WrappedId {
    constructor(readonly raw: string) {}
}

@HttpService()
class TypedQueryService {
    @HttpRoute('GET', 'typed')
    typed(@HttpQuery('id', () => WrappedId) id: WrappedId): Response {
        return new Response(`wrapped:${id.raw}`);
    }
}

// A POST service whose body is JSON-parsed during argument binding, and which
// records whether its handler body actually ran.
let bodyHandlerRan = false;

@HttpService()
class BodyService {
    @HttpRoute('POST', 'submit')
    submit(@HttpBody({ mode: 'json' }) body: unknown): Response {
        bodyHandlerRan = true;
        return Response.json({ received: body });
    }
}

describe('handler middleware runs before argument binding', () => {
    beforeEach(() => {
        bodyHandlerRan = false;
    });

    it('parses the body and reaches the handler when nothing short-circuits', async () => {
        const router = makeTestRouter([BodyService]);
        const response = await router.dispatch('POST', 'http://x/submit', {
            body: '{"a":1}',
            headers: { 'content-type': 'application/json' },
        });
        expect(response.status).toBe(200);
        expect(bodyHandlerRan).toBe(true);
    });

    it('400s on a malformed body once binding is reached (control)', async () => {
        const router = makeTestRouter([BodyService]);
        const response = await router.dispatch('POST', 'http://x/submit', {
            body: '{ not json',
            headers: { 'content-type': 'application/json' },
        });
        // proves parseJsonBody runs (and rejects) when no middleware blocks it
        expect(response.status).toBe(400);
        expect(bodyHandlerRan).toBe(false);
    });

    it('short-circuits before the body is parsed when handler middleware denies', async () => {
        const denyMiddleware = () => new Response(null, { status: 401 });
        const router = makeTestRouter([BodyService], [], [denyMiddleware]);
        // A malformed body that WOULD 400 if binding ran first.
        const response = await router.dispatch('POST', 'http://x/submit', {
            body: '{ not json',
            headers: { 'content-type': 'application/json' },
        });
        // Access-control / handler middleware now runs first, so the caller
        // gets the 401 — not a 400 that would have leaked that the body was
        // parsed and rejected before the auth check.
        expect(response.status).toBe(401);
        expect(bodyHandlerRan).toBe(false);
    });
});

@HttpService()
class ThrowingService {
    @HttpRoute('GET', 'unmodeled')
    unmodeled(): Response {
        throw new Error('unhandled http boom');
    }

    @HttpRoute('GET', 'modeled')
    modeled(): Response {
        throw HttpErrors.forbidden({ message: 'nope' });
    }
}

describe('unhandled exceptions defer Base.UnhandledException', () => {
    beforeEach(() => {
        deferredEvents = [];
    });

    it('fires for an error the app did not model, carrying the raw error', async () => {
        const router = makeTestRouter([ThrowingService]);
        const response = await router.dispatch('GET', 'http://x/unmodeled');

        // masked to a 500 for the client, but the listener gets the original
        expect(response.status).toBe(500);
        expect(deferredEvents).toHaveLength(1);
        const event = deferredEvents[0];
        expect(event.name).toBe(UnhandledExceptionEventName);
        expect(event.surface).toBe('http');
        expect((event.error as Error).message).toBe('unhandled http boom');
        expect(event.detail).toBe('GET /unmodeled');
        expect(event.requestId).toBe('request-1');
        expect(event.ipAddress).toBe('203.0.113.7');
        expect(event.userAgent).toBe('jest-agent');
    });

    it('does not fire for a modeled, client-facing HttpError', async () => {
        const router = makeTestRouter([ThrowingService]);
        const response = await router.dispatch('GET', 'http://x/modeled');

        expect(response.status).toBe(403);
        expect(deferredEvents).toEqual([]);
    });
});

describe('route dispatch harness', () => {
    it('dispatches a GET and binds a query parameter', async () => {
        const router = makeTestRouter([EchoService]);
        const response = await router.dispatch(
            'GET',
            'http://x/echo?value=hello',
        );
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('hello');
    });

    it('does not double-decode query parameters', async () => {
        const router = makeTestRouter([EchoService]);
        // The client sends value=a%252Bb; URLSearchParams decodes it once to
        // "a%2Bb". The router must not decode again (which would corrupt it
        // to "a+b").
        const response = await router.dispatch(
            'GET',
            'http://x/echo?value=a%252Bb',
        );
        expect(await response.text()).toBe('a%2Bb');
    });

    it('registers @HttpRoute methods inherited from a base class', async () => {
        const router = makeTestRouter([DerivedRouteService]);
        const own = await router.dispatch('GET', 'http://x/own');
        expect(await own.text()).toBe('from-derived');
        const inherited = await router.dispatch('GET', 'http://x/inherited');
        expect(inherited.status).toBe(200);
        expect(await inherited.text()).toBe('from-base');
    });

    it('rejects a param-decorated method that has no @HttpRoute', () => {
        expect(() => makeTestRouter([OrphanParamService])).toThrow(
            /no @HttpRoute/,
        );
    });

    it('constructs a named parameter with a non-primitive type', async () => {
        const router = makeTestRouter([TypedQueryService]);
        const response = await router.dispatch('GET', 'http://x/typed?id=abc');
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('wrapped:abc');
    });

    it('runs global middleware for unmatched (404) requests', async () => {
        let globalRan = false;
        const globalMiddleware = () => {
            globalRan = true;
        };
        const router = makeTestRouter([EchoService], [globalMiddleware]);
        const response = await router.dispatch('GET', 'http://x/no-such-route');
        expect(response.status).toBe(404);
        expect(globalRan).toBe(true);
    });
});
