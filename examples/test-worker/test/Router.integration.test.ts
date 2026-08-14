// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseErrorData } from '@system-inc/base-common/error/interfaces/BaseErrorData';
import { VersionInfo } from '@system-inc/base-foundation/configuration/BaseConfiguration';
import { IntegrationTestEnvironment } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';

const baseUrl = IntegrationTestEnvironment.get().client.getServerBaseUrl();

describe('Router Test', () => {
    test('GET /', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(baseUrl);
        const resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('Hello from test-worker');
    });

    test('@HttpPath decorator with single param works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/param/hello-world',
            );
        const resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('hello-world');
    });

    test('@HttpPath decorator with multiple params works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/param/hello/world/1',
            );
        const resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('helloworld1');
    });

    test('@HttpQuery to basic param works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/query/basic?name=chaz&age=101',
            );
        const resultObject = await result.json<{ name: string; age: number }>();
        expect(result.status).toBe(200);
        expect(resultObject.name).toBe('chaz');
        expect(resultObject.age).toBe(101);
    });

    test('@HttpQuery to object param works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/query/object?name=franke&age=92',
            );
        const resultObject = await result.json<{ name: string; age: number }>();
        expect(result.status).toBe(200);
        expect(resultObject.name).toBe('franke');
        expect(resultObject.age).toBe(92);
    });

    test('@HttpBody decorator works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/body',
                {
                    method: 'POST',
                    body: JSON.stringify({ name: 'ricko', age: 88 }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );
        const resultObject = await result.json<{ name: string; age: number }>();
        expect(result.status).toBe(200);
        expect(resultObject.name).toBe('ricko');
        expect(resultObject.age).toBe(88);
    });

    test("@HttpBody({ mode: 'json' }) without typeFunc passes raw parsed JSON through", async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/body/json-raw',
                {
                    method: 'POST',
                    body: JSON.stringify({ hello: 'world', n: 42 }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );
        const resultObject = await result.json<{
            received: { hello: string; n: number };
            isUndefined: boolean;
        }>();
        expect(result.status).toBe(200);
        expect(resultObject.isUndefined).toBe(false);
        expect(resultObject.received).toEqual({ hello: 'world', n: 42 });
    });

    test('Validation decorator fails validation', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/validation',
                {
                    method: 'POST',
                    body: JSON.stringify({ email: 'ricko', age: 88 }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );
        const jsonError = await result.json<BaseErrorData>();
        expect(result.status).toBe(422);
        expect(jsonError.message).toBe('Argument Validation Error');
        expect(jsonError.statusCode).toBe(422);
    });

    test('Validation decorator passes validation', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/validation',
                {
                    method: 'POST',
                    body: JSON.stringify({ email: 'ricko@ricky.net', age: 88 }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );
        const resultObject = await result.json<{
            email: string;
            age: number;
        }>();
        expect(result.status).toBe(200);
        expect(resultObject.email).toBe('ricko@ricky.net');
        expect(resultObject.age).toBe(88);
    });

    test('@HttpHeader decorator works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/headers',
                {
                    headers: {
                        test: 'a-little-test',
                    },
                },
            );
        const resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('a-little-test');
    });

    test('@HttpCookie decorator works using basic params', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/cookies/basic',
                {
                    headers: {
                        cookie: 'test1=a-little-test; test2=another-little-test',
                    },
                },
            );
        const resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('Cookies:a-little-test:another-little-test');
    });

    test('@HttpCookie decorator works using object params', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/cookies/object',
                {
                    headers: {
                        cookie: 'test1=a-little-test; test2=another-little-test',
                    },
                },
            );
        const resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('Cookies:a-little-test:another-little-test');
    });

    test('@InjectRequestContext on whole RC works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/context',
                {
                    method: 'GET',
                },
            );
        const resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('test-worker');
    });

    test('@InjectRequestContext between decorated params preserves positional alignment', async () => {
        // Regression: the router used to build `routeArguments` via
        // `push(...)`, which dropped positional info when an
        // `@InjectRequestContext` slot sat between HTTP-decorated ones.
        // With indexed assignment, `before` (path), the RC, and the body
        // all land in the right method slots.
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/rc-middle/alpha',
                {
                    method: 'POST',
                    body: JSON.stringify({ name: 'ricko', age: 88 }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );

        const body = await result.json<{
            before: string;
            rcRequestId: string;
            bodyName: string;
            bodyAge: number;
        }>();
        expect(result.status).toBe(200);
        expect(body.before).toBe('alpha');
        expect(body.bodyName).toBe('ricko');
        expect(body.bodyAge).toBe(88);
        expect(typeof body.rcRequestId).toBe('string');
        expect(body.rcRequestId.length).toBeGreaterThan(0);
    });

    test('@InjectRequestContext(KEY) extracts a typed bag value', async () => {
        // Route-scoped middleware on `/test/router/context/bag` reads the
        // `x-test-bag-value` header and writes it into the RC bag under a
        // test-owned typed key. The handler extracts that key via
        // `@InjectRequestContext(testBagKey)` and echoes the value — so an
        // identical body proves the key-based injection round-trip works
        // without depending on the access-log module.
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/context/bag',
                {
                    method: 'GET',
                    headers: { 'x-test-bag-value': 'hello-bag' },
                },
            );
        const value = await result.text();
        expect(result.status).toBe(200);
        expect(value).toBe('hello-bag');
    });

    test('Only allowed methods work', async () => {
        let result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/get-post',
        );
        let resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('Method:GET');

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/get-post',
            {
                method: 'POST',
            },
        );
        resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('Method:POST');

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/get-post',
            {
                method: 'HEAD',
            },
        );
        resultString = await result.text();
        expect(result.status).toBe(404);
        expect(resultString).toBe('');

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/get-post',
            {
                method: 'PUT',
            },
        );
        let jsonError = await result.json<BaseErrorData>();
        expect(result.status).toBe(404);
        expect(jsonError.message).toBe('Not Found');
        expect(jsonError.statusCode).toBe(404);

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/get-post',
            {
                method: 'DELETE',
            },
        );
        jsonError = await result.json<BaseErrorData>();
        expect(result.status).toBe(404);
        expect(jsonError.message).toBe('Not Found');
        expect(jsonError.statusCode).toBe(404);

        // preflight request — `Access-Control-Request-Method` is what
        // distinguishes a real browser preflight from a plain OPTIONS
        // call, so the CORS handler only responds when it is set.
        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/get-post',
            {
                method: 'OPTIONS',
                headers: {
                    'access-control-request-method': 'GET',
                },
            },
        );
        resultString = await result.text();
        expect(result.status).toBe(204);
        expect(resultString).toBe('');
        expect(result.headers.get('access-control-allow-credentials')).toBe(
            'true',
        );

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/get-post',
            {
                method: 'PATCH',
            },
        );
        jsonError = await result.json<BaseErrorData>();
        expect(result.status).toBe(404);
        expect(jsonError.message).toBe('Not Found');
        expect(jsonError.statusCode).toBe(404);
    });

    test('All allowed methods work', async () => {
        let result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/all',
        );
        let resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('test-all-methods:GET');

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/all',
            {
                method: 'HEAD',
            },
        );
        resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('');

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/all',
            {
                method: 'POST',
            },
        );
        resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('test-all-methods:POST');

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/all',
            {
                method: 'PUT',
            },
        );
        resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('test-all-methods:PUT');

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/all',
            {
                method: 'DELETE',
            },
        );
        resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('test-all-methods:DELETE');

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/all',
            {
                method: 'OPTIONS',
            },
        );
        resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('test-all-methods:OPTIONS');

        result = await IntegrationTestEnvironment.get().client.sendRequest(
            baseUrl + '/test/router/methods/all',
            {
                method: 'PATCH',
            },
        );
        resultString = await result.text();
        expect(result.status).toBe(200);
        expect(resultString).toBe('test-all-methods:PATCH');
    });

    test('Can throw in route', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/throw',
            );
        const jsonError = await result.json<BaseErrorData>();
        expect(result.status).toBe(403);
        expect(jsonError.message).toBe('The error was thrown!');
    });

    test('Single middleware works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/middleware/single',
            );
        const resultObject = await result.text();
        expect(result.status).toBe(200);
        expect(resultObject).toBe('hello from myMiddleware1');
    });

    test('Mulitple middlwares works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/middleware/multiple',
            );
        const resultObject = await result.text();
        expect(result.status).toBe(200);
        expect(resultObject).toBe(
            'hello from myMiddleware1hello from myMiddleware2hello from myMiddleware3',
        );
    });

    test('@InjectRequestContext provides RequestContext', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/request-context',
            );
        const resultObject = await result.json<{
            requestId: string;
            url: string;
            method: string;
            userAgent: string;
        }>();
        expect(result.status).toBe(200);
        expect(resultObject.requestId).toBeDefined();
        expect(resultObject.url).toContain('/test/router/request-context');
        expect(resultObject.method).toBe('GET');
        expect(resultObject.userAgent).toBeDefined();
    });

    test('@InjectRequestContext works alongside @HttpPath', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/test/router/request-context/with-params/test-123',
            );
        const resultObject = await result.json<{
            id: string;
            requestId: string;
            method: string;
        }>();
        expect(result.status).toBe(200);
        expect(resultObject.id).toBe('test-123');
        expect(resultObject.requestId).toBeDefined();
        expect(resultObject.method).toBe('GET');
    });

    test('@InjectRequestContext with optional params pads correctly', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl +
                    '/test/router/request-context/with-optional?name=test',
            );
        const resultObject = await result.json<{
            name: string;
            optionalParam: string;
            hasContext: boolean;
            requestId: string;
        }>();
        expect(result.status).toBe(200);
        expect(resultObject.name).toBe('test');
        expect(resultObject.optionalParam).toBe('was-undefined');
        expect(resultObject.hasContext).toBe(true);
        expect(resultObject.requestId).toBeDefined();
    });

    test('__version endpoint works', async () => {
        const result =
            await IntegrationTestEnvironment.get().client.sendRequest(
                baseUrl + '/__version',
            );
        const resultObject = await result.json<VersionInfo>();
        expect(result.status).toBe(200);
        expect(resultObject.version).toBe('1.0.0');
        expect(resultObject.name).toBe('test-worker');
        expect(resultObject.environment).toBeDefined();
        expect(resultObject.commit).toBeDefined();
        expect(resultObject.builtAt).toBeDefined();
        expect(resultObject.id).toBeDefined();
    });
});
