// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';
import { HttpResponses } from '@system-inc/base-foundation/http/HttpResponses';
import { WithMiddleware } from '@system-inc/base-foundation/middleware/decorators/WithMiddleware';
import { InjectRequestContext } from '@system-inc/base-foundation/request/decorators/RequestContextDecorator';
import { RequestContext } from '@system-inc/base-foundation/request/RequestContext';
import { RequestContextKey } from '@system-inc/base-foundation/request/RequestContextKey';
import { HttpBody } from '@system-inc/base-foundation/router/decorators/HttpBody';
import { HttpCookie } from '@system-inc/base-foundation/router/decorators/HttpCookie';
import { HttpHeader } from '@system-inc/base-foundation/router/decorators/HttpHeader';
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';
import { HttpQuery } from '@system-inc/base-foundation/router/decorators/HttpQuery';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';
import { SerializableField } from '@system-inc/base-foundation/serialization/decorators/SerializableField';
import { SerializableObject } from '@system-inc/base-foundation/serialization/decorators/SerializableObject';
import { VerifyIsEmail } from '@system-inc/base-foundation/validation/decorators/VerifyIsEmail';
import { CrossDispatcherTokenKey } from './CrossDispatcherInjection';

const myMiddleware1Key = new RequestContextKey<string>('myMiddleware1Key');
const myMiddleware1 = (requestContext: RequestContext) => {
    requestContext.set(myMiddleware1Key, 'hello from myMiddleware1');
};

const myMiddleware2Key = new RequestContextKey<string>('myMiddleware2Key');
const myMiddleware2 = (requestContext: RequestContext) => {
    requestContext.set(myMiddleware2Key, 'hello from myMiddleware2');
};

const myMiddleware3Key = new RequestContextKey<string>('myMiddleware3Key');
const myMiddleware3 = (requestContext: RequestContext) => {
    requestContext.set(myMiddleware3Key, 'hello from myMiddleware3');
};

const testBagKey = new RequestContextKey<string>('testBagKey');
const testBagMiddleware = (requestContext: RequestContext) => {
    const headerValue = requestContext.headers.get('x-test-bag-value');
    if (headerValue) {
        requestContext.set(testBagKey, headerValue);
    }
};

@SerializableObject()
export class CookieTest {
    @SerializableField(() => String)
    test1: string;

    @SerializableField(() => String)
    test2: string;
}

@SerializableObject()
export class Test {
    @SerializableField(() => String)
    name: string;

    @SerializableField(() => Number)
    age: number;
}

@SerializableObject()
export class ValidationTest {
    @VerifyIsEmail()
    @SerializableField(() => String)
    email: string;

    @SerializableField(() => Number)
    age: number;
}

@HttpService()
export class RouterTestService {
    @HttpRoute('GET', '/')
    helloWorld(): Response {
        return new Response('Hello from test-worker');
    }

    @HttpRoute('GET', '/test/router/param/:id')
    testParamSingle(@HttpPath('id') id: string): Response {
        return new Response(id);
    }

    @HttpRoute('GET', '/test/router/param/:param1/:param2/:param3')
    testParamMulitple(
        @HttpPath('param1') param1: string,
        @HttpPath('param2') param2: string,
        @HttpPath('param3') param3: string,
    ): Response {
        return new Response(param1 + param2 + param3);
    }

    @HttpRoute('GET', '/test/router/query/basic')
    testQueryBasic(
        @HttpQuery('name') name: string,
        @HttpQuery('age', () => Number) age: number,
    ): Response {
        console.log('name: ', name);
        console.log('age: ', age + 1);
        return Response.json({
            name: name,
            age: age,
        });
    }

    @HttpRoute('GET', '/test/router/query/object')
    testQueryObject(@HttpQuery(() => Test) test: Test): Response {
        console.log('test2: ', JSON.stringify(test));
        return Response.json({
            name: test.name,
            age: test.age,
        });
    }

    @HttpRoute('POST', '/test/router/body')
    testBody(@HttpBody(() => Test) test: Test): Response {
        console.log('test: ', JSON.stringify(test));
        return Response.json(test);
    }

    /**
     * `@HttpBody({ mode: 'json' })` with no typeFunc must hand back the
     * parsed JSON body verbatim — no deserialize, no class-validate.
     * Symmetric with the other body modes (text, formData, stream, etc.)
     * which already pass the raw value through.
     */
    @HttpRoute('POST', '/test/router/body/json-raw')
    testBodyJsonRaw(@HttpBody({ mode: 'json' }) body: unknown): Response {
        return Response.json({
            received: body,
            isUndefined: body === undefined,
        });
    }

    @HttpRoute('POST', '/test/router/validation')
    testValidation(
        @HttpBody(() => ValidationTest) test: ValidationTest,
    ): Response {
        console.log('test: ', JSON.stringify(test));
        return Response.json(test);
    }

    @HttpRoute('GET', '/test/router/headers')
    testHeaders(@HttpHeader('test') test: string): Response {
        console.log('test: ', test);
        return new Response(test);
    }

    @HttpRoute(['GET'], '/test/router/cookies/basic')
    testCookiesBasic(
        @HttpCookie('test1', () => String) test1: string,
        @HttpCookie('test2') test2: string,
        @InjectRequestContext() context: RequestContext,
    ): Response {
        console.log('cookies: ', context.cookies);
        console.log('test1: ', test1);
        console.log('test2: ', test2);
        return new Response('Cookies:' + test1 + ':' + test2);
    }

    @HttpRoute(['GET'], '/test/router/cookies/object')
    testCookiesObject(
        @HttpCookie(() => CookieTest) test3: CookieTest,
        @InjectRequestContext() context: RequestContext,
    ): Response {
        console.log('cookies: ', context.cookies);
        console.log('test3: ', test3.test1, test3['test2']);
        return new Response('Cookies:' + test3.test1 + ':' + test3.test2);
    }

    @HttpRoute('GET', '/test/router/context')
    testContext(@InjectRequestContext() rc: RequestContext): Response {
        console.log('container: ', JSON.stringify(rc.container));
        console.log('configuration: ', JSON.stringify(rc.configuration));
        return new Response(rc.configuration.name);
    }

    /**
     * Self-contained coverage for key-based `@InjectRequestContext(KEY)`.
     * A route-scoped middleware reads the `x-test-bag-value` header and
     * writes it into the typed-key bag; the handler echoes whatever it
     * extracts. No module dependency — the entire bag round-trip is
     * framework-owned.
     */
    @WithMiddleware(testBagMiddleware)
    @HttpRoute('GET', '/test/router/context/bag')
    testContextBag(
        @InjectRequestContext(testBagKey) value: string | undefined,
    ): Response {
        return new Response(value ?? '');
    }

    /**
     * Half of the cross-dispatcher injection regression: this route
     * echoes whatever a worker-level global middleware wrote into the
     * RC bag under `crossDispatcherTokenKey`. A matching GraphQL
     * query (`crossDispatcherToken`) echoes the same key. The
     * integration test sends the same header through both paths and
     * asserts the extracted value matches — proving that
     * `@InjectRequestContext(KEY)` resolves consistently across
     * dispatchers.
     */
    @HttpRoute('GET', '/test/router/cross-dispatcher')
    testCrossDispatcher(
        @InjectRequestContext(CrossDispatcherTokenKey)
        value: string | undefined,
    ): Response {
        return new Response(value ?? '');
    }

    /**
     * Regression coverage for the router's positional-alignment bug.
     * `@InjectRequestContext` sits between `@HttpPath` and `@HttpBody` —
     * a correct router places each arg at its declared slot, so both
     * the path param and the body are echoed back alongside a real RC.
     * The old `push`-based construction would collapse positions and
     * the trailing arg would be lost.
     */
    @HttpRoute('POST', '/test/router/rc-middle/:before')
    testRcMiddle(
        @HttpPath('before') before: string,
        @InjectRequestContext() rc: RequestContext,
        @HttpBody(() => Test) body: Test,
    ): Response {
        return Response.json({
            before,
            rcRequestId: rc.requestId,
            bodyName: body.name,
            bodyAge: body.age,
        });
    }

    @HttpRoute(['GET', 'POST'], '/test/router/methods/get-post')
    testMethods(@InjectRequestContext() context: RequestContext): Response {
        return new Response('Method:' + context.method);
    }

    @HttpRoute('ALL', '/test/router/methods/all')
    testAllMethods(@InjectRequestContext() context: RequestContext): Response {
        return new Response('test-all-methods:' + context.method);
    }

    @HttpRoute('GET', '/test/router/throw')
    testThrow(): Response {
        throw HttpErrors.forbidden({
            message: 'The error was thrown!',
        });
    }

    @HttpRoute('GET', '/test/router/error/throw')
    testThrowError(): Response {
        throw HttpErrors.forbidden({
            message: 'The error was thrown!',
        });
    }

    @HttpRoute('GET', '/test/router/error/response')
    testResponseError(): Response {
        return HttpResponses.fromError(
            HttpErrors.forbidden({
                message: 'The error response was returned!',
            }),
        );
    }

    @HttpRoute('GET', '/test/router/request-context')
    testRequestContext(@InjectRequestContext() rc: RequestContext): Response {
        console.log('request context: ', rc);
        return Response.json({
            requestId: rc.requestId,
            url: rc.url,
            method: rc.method,
            userAgent: rc.userAgent,
        });
    }

    @HttpRoute('GET', '/test/router/request-context/with-params/:id')
    testRequestContextWithParams(
        @HttpPath('id') id: string,
        @InjectRequestContext() rc: RequestContext,
    ): Response {
        return Response.json({
            id: id,
            requestId: rc.requestId,
            method: rc.method,
        });
    }

    @HttpRoute('GET', '/test/router/request-context/with-optional')
    testRequestContextWithOptional(
        @HttpQuery('name') name: string,
        optionalParam?: string,
        @InjectRequestContext() rc?: RequestContext,
    ): Response {
        console.log('request context: ', rc);
        return Response.json({
            name: name,
            optionalParam: optionalParam ?? 'was-undefined',
            hasContext: !!rc,
            requestId: rc?.requestId,
        });
    }

    @WithMiddleware(myMiddleware1)
    @HttpRoute('GET', '/test/router/middleware/single')
    testMiddlewareSingle(
        @InjectRequestContext() context: RequestContext,
    ): Response {
        return new Response(context.get(myMiddleware1Key));
    }

    @WithMiddleware([myMiddleware1, myMiddleware2, myMiddleware3])
    @HttpRoute('GET', '/test/router/middleware/multiple')
    testMiddlewareMultiple(
        @InjectRequestContext() context: RequestContext,
    ): Response {
        const output =
            (context.get(myMiddleware1Key) ?? '') +
            (context.get(myMiddleware2Key) ?? '') +
            (context.get(myMiddleware3Key) ?? '');
        return new Response(output);
    }
}
