// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcError } from '@system-inc/base-client/rpc/client/error/RpcError';
import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import {
    RPC_ERROR_CODE_INTERNAL_ERROR,
    RPC_ERROR_CODE_NOT_FOUND,
    RPC_ERROR_CODE_VALIDATION_ERROR,
} from '@system-inc/base-common/rpc/protocol/RpcErrorCode';
import { IntegrationTestEnvironment } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';
import { ValidationRpcTest } from '../source/services/RpcTestService';
import {
    RpcTestServiceInterface,
    TestRpcJson,
    TestRpcJsons,
    TestStringEnum,
} from '../source/services/RpcTestServiceInterface';

const rpcClient: RpcClient<RpcTestServiceInterface> =
    IntegrationTestEnvironment.get().client.getRemoteProcedureClient();

describe('RPC Test', () => {
    test('RPC echo', async () => {
        // act
        const result = await rpcClient.call().echo('Hello', 'World');

        // assert
        expect(result).toBe('Hello World');
    });

    test('RPC echoRequired with both arguments succeeds', async () => {
        const result = await rpcClient.call().echoRequired('Hello', 'World');
        expect(result).toBe('Hello World');
    });

    test('RPC missing trailing required argument is rejected, not passed through', async () => {
        // Audit finding 3: this used to reach the handler as undefined and
        // return a SUCCESS response ("Hello undefined").
        await expect(
            (
                rpcClient.call() as unknown as {
                    echoRequired(greeting: string): Promise<string>;
                }
            ).echoRequired('Hello'),
        ).rejects.toThrow(/[Mm]issing required parameter/);
    });

    test('RPC null for a required argument is rejected', async () => {
        await expect(
            rpcClient.call().echoRequired('Hello', null as unknown as string),
        ).rejects.toThrow(/[Mm]issing required parameter/);
    });

    test('RPC testArrayResult', async () => {
        // act
        const result = await rpcClient.call().testArrayResult();

        // assert
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toBe('test1');
    });

    test('RPC testArrayResultWithArgs', async () => {
        // act
        const result = await rpcClient
            .call()
            .testArrayResultWithArgs('test1', 'test2');

        // assert
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        expect(result[0]).toBe('test1');
        expect(result[1]).toBe('test2');
    });

    test('RPC testNumber', async () => {
        // act
        const result = await rpcClient.call().testNumber(500);

        // assert
        expect(result).toBe(501);
    });

    test('RPC testArrayAccumulate', async () => {
        // act
        const result = await rpcClient
            .call()
            .testArrayAccumulate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        // assert
        expect(result).toBe(55);
    });

    test('RPC testProcedureWithObjectArgs', async () => {
        // arrange
        const date = new Date();
        const testRpcObject = createTestRpcJson(date);

        // act
        const result = await rpcClient
            .call()
            .testProcedureWithObjectArgs(testRpcObject);

        // assert

        expect(result.testString).toBe('hello');
        expect(result.testNumber).toBe(15);
        expect(result.testBoolean).toBe(true);
        expect(result.testDateString).toBe(date.toISOString());
        expect(Array.isArray(result.testArray)).toBe(true);
        expect(result.testArray.length).toBe(5);
        expect(result.testArray[0]).toBe(1);
        expect(result.testArray[1]).toBe(2);
        expect(result.testArray[2]).toBe(3);
        expect(result.testArray[3]).toBe(4);
        expect(result.testArray[4]).toBe(5);
        expect(result.testNestedObject!.testString).toBe('nested hello');
        expect(result.testNestedObject!.testNumber).toBe(150);
        expect(result.testNestedObject!.anotherNestedObject!.testString).toBe(
            'more nested hello',
        );
        expect(result.testNestedObject!.anotherNestedObject!.testBoolean).toBe(
            false,
        );
    });

    test('RPC testProcedureWithInterfaceArgs', async () => {
        // arrange
        const date = new Date();
        const testRpcObject = createTestRpcJson(date);

        // act
        const result = await rpcClient
            .call()
            .testProcedureWithInterfaceArgs(testRpcObject);

        // assert

        expect(result.testString).toBe('hello');
        expect(result.testNumber).toBe(15);
        expect(result.testBoolean).toBe(true);
        expect(result.testDateString).toBe(date.toISOString());
        expect(Array.isArray(result.testArray)).toBe(true);
        expect(result.testArray.length).toBe(5);
        expect(result.testArray[0]).toBe(1);
        expect(result.testArray[1]).toBe(2);
        expect(result.testArray[2]).toBe(3);
        expect(result.testArray[3]).toBe(4);
        expect(result.testArray[4]).toBe(5);
        expect(result.testNestedObject!.testString).toBe('nested hello');
        expect(result.testNestedObject!.testNumber).toBe(150);
        expect(result.testNestedObject!.anotherNestedObject!.testString).toBe(
            'more nested hello',
        );
        expect(result.testNestedObject!.anotherNestedObject!.testBoolean).toBe(
            false,
        );
    });

    test('RPC testProcedureWithObjectArrayArgs', async () => {
        // arrange
        const date = new Date();
        const testRpcJsons: TestRpcJsons = {
            tests: [],
        };
        testRpcJsons.tests = [
            createTestRpcJson(date),
            createTestRpcJson(date),
            createTestRpcJson(date),
        ];

        // act
        const result = await rpcClient
            .call()
            .testProcedureWithObjectArrayArgs(testRpcJsons);

        // assert
        expect(result.tests.length).toBe(3);

        // run the same assertions as above for each object in the array
        for (const testRpcJson of result.tests) {
            expect(testRpcJson.testString).toBe('hello');
            expect(testRpcJson.testNumber).toBe(15);
            expect(testRpcJson.testBoolean).toBe(true);
            expect(testRpcJson.testDateString).toBe(date.toISOString());
            expect(testRpcJson.testArray.length).toBe(5);
            expect(testRpcJson.testArray[0]).toBe(1);
            expect(testRpcJson.testArray[1]).toBe(2);
            expect(testRpcJson.testArray[2]).toBe(3);
            expect(testRpcJson.testArray[3]).toBe(4);
            expect(testRpcJson.testArray[4]).toBe(5);
            expect(testRpcJson.testNestedObject!.testString).toBe(
                'nested hello',
            );
            expect(testRpcJson.testNestedObject!.testNumber).toBe(150);
            expect(
                testRpcJson.testNestedObject!.anotherNestedObject!.testString,
            ).toBe('more nested hello');
            expect(
                testRpcJson.testNestedObject!.anotherNestedObject!.testBoolean,
            ).toBe(false);
        }
    });

    test('RPC testProcedureWithInterfaceArrayArgs', async () => {
        // arrange
        const date = new Date();
        const testRpcJsons: TestRpcJsons = {
            tests: [],
        };
        testRpcJsons.tests = [
            createTestRpcJson(date),
            createTestRpcJson(date),
            createTestRpcJson(date),
        ];

        // act
        const result = await rpcClient
            .call()
            .testProcedureWithInterfaceArrayArgs(testRpcJsons);

        // assert
        expect(result.tests.length).toBe(3);

        // run the same assertions as above for each object in the array
        for (const testRpcJson of result.tests) {
            expect(testRpcJson.testString).toBe('hello');
            expect(testRpcJson.testNumber).toBe(15);
            expect(testRpcJson.testBoolean).toBe(true);
            expect(testRpcJson.testDateString).toBe(date.toISOString());
            expect(testRpcJson.testArray.length).toBe(5);
            expect(testRpcJson.testArray[0]).toBe(1);
            expect(testRpcJson.testArray[1]).toBe(2);
            expect(testRpcJson.testArray[2]).toBe(3);
            expect(testRpcJson.testArray[3]).toBe(4);
            expect(testRpcJson.testArray[4]).toBe(5);
            expect(testRpcJson.testNestedObject!.testString).toBe(
                'nested hello',
            );
            expect(testRpcJson.testNestedObject!.testNumber).toBe(150);
            expect(
                testRpcJson.testNestedObject!.anotherNestedObject!.testString,
            ).toBe('more nested hello');
            expect(
                testRpcJson.testNestedObject!.anotherNestedObject!.testBoolean,
            ).toBe(false);
        }
    });

    test('RPC testJsonArgs', async () => {
        // act
        const result = await rpcClient.call().testJsonArgs({
            test: 'hello',
            test2: 15,
            test3: true,
            test4: new Date(),
            test5: [1, 2, 3, 4, 5],
            test6: {
                test: 'nested hello',
                test2: 150,
                test3: {
                    test: 'more nested hello',
                    test2: false,
                },
            },
        });

        // assert
        expect(typeof result).toBe('object');
        expect(result['test']).toBe('hello');
        expect(result['test2']).toBe(15);
        expect(result['test3']).toBe(true);
        expect(result['test5'].length).toBe(5);
        expect(result['test5'][0]).toBe(1);
        expect(result['test5'][1]).toBe(2);
        expect(result['test5'][2]).toBe(3);
        expect(result['test5'][3]).toBe(4);
        expect(result['test5'][4]).toBe(5);
        expect(typeof result['test6']).toBe('object');
        expect(result['test6']['test']).toBe('nested hello');
        expect(result['test6']['test2']).toBe(150);
        expect(typeof result['test6']['test3']).toBe('object');
        expect(result['test6']['test3']['test']).toBe('more nested hello');
        expect(result['test6']['test3']['test2']).toBe(false);
    });

    test('RPC testUndefined', async () => {
        // act
        const result = await rpcClient.call().testUndefined();

        // assert
        expect(result).toBe(undefined);
    });

    test('RPC testNull', async () => {
        // act
        const result = await rpcClient.call().testNull();

        // assert
        expect(result).toBe(null);
    });

    test('RPC testNestedFalsy', async () => {
        // act
        const result = await rpcClient.call().testNestedFalsy();

        // assert
        expect(result.name).toBe('test');
        expect(result.email).toBe(null);
        expect(result.age).toBe(undefined);
        expect(result.nested.name).toBe('test');
        expect(result.nested.email).toBe(null);
        expect(result.nested.age).toBe(undefined);
    });

    test('RPC testVoid', async () => {
        // act
        const result = await rpcClient.call().testVoid('hello', 'world');

        // assert
        expect(result).toBe(undefined);
    });

    test('RPC testThrow', async () => {
        let didThrow = false;
        // act
        try {
            await rpcClient.call().testThrow('hello', 'world');
        } catch (e: unknown) {
            didThrow = true;
            if (e instanceof RpcError) {
                expect(e.code).toBe(RPC_ERROR_CODE_INTERNAL_ERROR);
                expect(e.procedure).toBe('testThrow');
                expect(e.cause?.message).toBe('Internal server error');
            }
        }

        // assert
        expect(didThrow).toBe(true);
    });

    test('RPC testHeaders', async () => {
        // act
        const result = await rpcClient.callProcedure('testHeaders', [], {
            headers: {
                'x-test-header': 'hello-headers',
            },
        });

        // assert
        expect(result.status).toBe('success');
        expect(result.id).toBeDefined();
        expect(result.durationMs).toBeDefined();
        expect(result.http.status).toBe(200);
        expect(result.http.statusText).toBe('OK');
        expect(result.type).toBe('response');
        expect(result.status).toBe('success');
        expect(result.__protocol).toBe('BaseRPC');
        expect(result.__version).toBe('1.0');
        if (result.status === 'success') {
            expect(result.result).toBe('hello-headers');
        }
    });

    test('RPC testCookies', async () => {
        // act
        const result = await rpcClient
            .call({
                cookies: {
                    'my-cookie': 'hello-cookies!',
                },
            })
            .testCookies();

        // assert
        expect(result).toBe('hello-cookies!');
    });

    test('RPC testMiddlewareSingle', async () => {
        // act
        const result = await rpcClient.call().testMiddlewareSingle();

        // assert
        expect(result).toBe('hello from myMiddleware1');
    });

    test('RPC testMiddlewareMultiple', async () => {
        // act
        const result = await rpcClient.call().testMiddlewareMultiple();

        // assert
        expect(result).toBe(
            'hello from myMiddleware1hello from myMiddleware2hello from myMiddleware3',
        );
    });

    test('RPC testServiceMiddlwareSingle', async () => {
        // act
        const result = await rpcClient.call().testServiceMiddlwareSingle();

        // assert
        expect(result).toBe('hello from service middleware');
    });

    test('RPC test not existent RPC', async () => {
        let didThrow = false;
        // act
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (rpcClient.call() as any).pizzapizzapizza();
        } catch (e: unknown) {
            didThrow = true;
            if (e instanceof RpcError) {
                expect(e.code).toBe(RPC_ERROR_CODE_NOT_FOUND);
                expect(e.procedure).toBe('pizzapizzapizza');
                expect(e.message).toBe(
                    'Remote procedure pizzapizzapizza not found.',
                );
            }
        }

        // assert
        expect(didThrow).toBe(true);
    });

    test('RPC testValidation when validation fails', async () => {
        // arrange
        const validationTest = new ValidationRpcTest();
        validationTest.name = 'hello';
        validationTest.email = 'world';
        validationTest.numbers = [1, 2];

        // act
        let didThrow = false;
        try {
            await rpcClient.call().testValidation(validationTest);
        } catch (e: unknown) {
            didThrow = true;
            if (e instanceof RpcError) {
                expect(e.code).toBe(RPC_ERROR_CODE_VALIDATION_ERROR);
                expect(e.procedure).toBe('testValidation');
                expect(e.cause?.message).toBe('Argument Validation Error');
            }
        }

        // assert
        expect(didThrow).toBe(true);
    });

    test('RPC testValidation when validation is successful', async () => {
        // arrange
        const validationTest = new ValidationRpcTest();
        validationTest.name = 'hello';
        validationTest.email = 'chaz@chazworld.net';
        validationTest.numbers = [1, 2];

        // act
        const result = await rpcClient.call().testValidation(validationTest);

        // assert
        expect(result.name).toBe('hello');
        expect(result.email).toBe('chaz@chazworld.net');
        expect(result.numbers.length).toBe(2);
        expect(result.numbers[0]).toBe(1);
        expect(result.numbers[1]).toBe(2);
    });

    test('RPC testRequestContext', async () => {
        // act
        const result = await rpcClient.call().testRequestContext();

        // assert
        expect(result.requestId).toBeDefined();
        expect(result.method).toBe('POST');
        expect(result.userAgent).toBeDefined();
    });

    test('RPC testRequestContextWithArgs', async () => {
        // act
        const result = await rpcClient
            .call()
            .testRequestContextWithArgs('hello-world');

        // assert
        expect(result.input).toBe('hello-world');
        expect(result.requestId).toBeDefined();
    });

    test('RPC testRcMiddleArgs preserves positional args around @InjectRequestContext', async () => {
        // Regression: guards against a future regression where the RPC
        // dispatcher ever stops using indexed assignment. If `push`
        // semantics crept back in, an RC slot between two positional
        // args would clobber one of them and the trailing arg would
        // arrive as `undefined`.
        const result = await rpcClient
            .call()
            .testRcMiddleArgs('alpha', undefined, 'omega');

        expect(result.before).toBe('alpha');
        expect(result.after).toBe('omega');
        expect(typeof result.rcRequestId).toBe('string');
        expect(result.rcRequestId.length).toBeGreaterThan(0);
    });
});

function createTestRpcJson(date: Date): TestRpcJson {
    return {
        testString: 'hello',
        testNumber: 15,
        testBoolean: true,
        testDateString: date.toISOString(),
        testArray: [1, 2, 3, 4, 5],
        testNestedObject: {
            testString: 'nested hello',
            testNumber: 150,
            anotherNestedObject: {
                testString: 'more nested hello',
                testBoolean: false,
            },
        },
        testNumberEnum: 1,
        testStringEnum: TestStringEnum.Test1,
    } satisfies TestRpcJson;
}
