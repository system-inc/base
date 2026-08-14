// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { StrictJsonInterface } from '@system-inc/base-common/json/StrictJson';

export interface RpcTestServiceInterface {
    echo(...str: string[]): Promise<string>;
    echoRequired(greeting: string, name: string): Promise<string>;
    testArrayResult(): Promise<string[]>;
    testArrayResultWithArgs(test: string, test2: string): Promise<string[]>;
    testNumber(test: number): Promise<number>;
    testArrayAccumulate(test: number[]): Promise<number>;
    testProcedureWithObjectArgs(test: TestRpcJson): Promise<TestRpcJson>;
    testProcedureWithInterfaceArgs(test: TestRpcJson): Promise<TestRpcJson>;
    testProcedureWithObjectArrayArgs(test: TestRpcJsons): Promise<TestRpcJsons>;
    testProcedureWithInterfaceArrayArgs(
        test: TestRpcJsons,
    ): Promise<TestRpcJsons>;
    testNestedFalsy(): Promise<{
        name: 'test';
        email: null;
        age: undefined;
        nested: {
            name: 'test';
            email: null;
            age: undefined;
        };
    }>;
    testJsonArgs<T>(test: T): Promise<T>;
    testUndefined(): Promise<string | undefined>;
    testNull(): Promise<string | null>;
    testVoid(arg1: string, arg2: string): Promise<void>;
    testThrow(arg1: string, arg2: string): Promise<void>;
    testHeaders(...args: unknown[]): Promise<string | null>;
    testCookies(...args: unknown[]): Promise<string>;
    testMiddlewareSingle(...args: unknown[]): Promise<string>;
    testMiddlewareMultiple(...args: unknown[]): Promise<string>;
    testServiceMiddlwareSingle(...args: unknown[]): Promise<string>;
    testValidation(test: ValidationRpcTestJson): Promise<ValidationRpcTestJson>;
    testRequestContext(): Promise<{
        requestId: string;
        method: string;
        userAgent: string;
    }>;
    testRequestContextWithArgs(input: string): Promise<{
        input: string;
        requestId: string;
    }>;
    testRcMiddleArgs(
        before: string,
        // Exposed as an explicit RC slot the client must pass `undefined`
        // for. The server-side `@InjectRequestContext` overwrites it.
        rcPlaceholder: undefined,
        after: string,
    ): Promise<{
        before: string;
        rcRequestId: string;
        after: string;
    }>;
}

export enum TestStringEnum {
    Test1 = 'test1',
    Test2 = 'test2',
    Test3 = 'test3',
}

export enum TestNumberEnum {
    Test1 = 1,
    Test2 = 2,
    Test3 = 3,
}

export type MoreTestNestedJson = StrictJsonInterface<{
    testString: string;
    testBoolean: boolean;
}>;

export type TestNestedJson = StrictJsonInterface<{
    testString: string;
    testNumber: number;
    anotherNestedObject: MoreTestNestedJson;
}>;

export type TestRpcJson = StrictJsonInterface<{
    testString: string;
    testNumber: number;
    testBoolean: boolean;
    testDateString: string;
    testNestedObject: TestNestedJson | undefined;
    testArray: number[];
    testNumberEnum: TestNumberEnum;
    testStringEnum: TestStringEnum;
}>;

export type TestRpcJsons = StrictJsonInterface<{
    tests: TestRpcJson[];
}>;

export type ValidationRpcTestJson = StrictJsonInterface<{
    name: string;
    email: string;
    numbers: number[];
}>;
