// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DateJsonValueTransformer } from '@system-inc/base-common/json/value-transformer/DateJsonValueTransformer';
import { WithMiddleware } from '@system-inc/base-foundation/middleware/decorators/WithMiddleware';
import { InjectRequestContext } from '@system-inc/base-foundation/request/decorators/RequestContextDecorator';
import { RequestContext } from '@system-inc/base-foundation/request/RequestContext';
import { RequestContextKey } from '@system-inc/base-foundation/request/RequestContextKey';
import { Rpc } from '@system-inc/base-foundation/rpc/decorators/Rpc';
import { RpcArgument } from '@system-inc/base-foundation/rpc/decorators/RpcArgument';
import { RpcService } from '@system-inc/base-foundation/rpc/decorators/RpcService';
import { SerializableField } from '@system-inc/base-foundation/serialization/decorators/SerializableField';
import { SerializableObject } from '@system-inc/base-foundation/serialization/decorators/SerializableObject';
import { VerifyIsArray } from '@system-inc/base-foundation/validation/decorators/VerifyIsArray';
import { VerifyIsEmail } from '@system-inc/base-foundation/validation/decorators/VerifyIsEmail';
import {
    MoreTestNestedJson,
    RpcTestServiceInterface,
    TestNestedJson,
    TestNumberEnum,
    TestRpcJson,
    TestRpcJsons,
    TestStringEnum,
    ValidationRpcTestJson,
} from './RpcTestServiceInterface';

//#region Middleware

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

const serviceMiddlewareKey = new RequestContextKey<string>(
    'serviceMiddlewareKey',
);
const serviceMiddleware = (requestContext: RequestContext) => {
    requestContext.set(serviceMiddlewareKey, 'hello from service middleware');
};

//#endregion Middleware
//#region Rpc Classes

@SerializableObject()
export class MoreTestNestedObject implements MoreTestNestedJson {
    @SerializableField(() => String)
    testString: string;

    @SerializableField(() => Boolean)
    testBoolean: boolean;
}

@SerializableObject()
export class ValidationRpcTest implements ValidationRpcTestJson {
    @SerializableField(() => String)
    name: string;

    @VerifyIsEmail()
    @SerializableField(() => String)
    email: string;

    @VerifyIsArray()
    @SerializableField(() => [Number])
    numbers: number[];
}

@SerializableObject()
export class TestNestedObject implements TestNestedJson {
    @SerializableField(() => String)
    testString: string;

    @SerializableField(() => Number)
    testNumber: number;

    @SerializableField(() => MoreTestNestedObject)
    anotherNestedObject: MoreTestNestedObject;
}

@SerializableObject()
export class TestRpcObject implements TestRpcJson {
    @SerializableField(() => String)
    testString: string;

    @SerializableField(() => Number)
    testNumber: number;

    @SerializableField(() => Boolean)
    testBoolean: boolean;

    @SerializableField(() => Date, {
        name: 'testDateString',
        transformer: DateJsonValueTransformer,
    })
    testDate: Date;

    @SerializableField(() => String)
    testDateString: string;

    @SerializableField(() => TestNestedObject)
    testNestedObject: TestNestedObject;

    @SerializableField(() => [Number])
    testArray: number[];

    @SerializableField(() => TestNumberEnum)
    testNumberEnum: TestNumberEnum;

    @SerializableField(() => TestStringEnum)
    testStringEnum: TestStringEnum;
}

@SerializableObject()
export class TestRpcObjects implements TestRpcJsons {
    @SerializableField(() => [TestRpcObject])
    tests: TestRpcObject[];
}

//#endregion Rpc Classes
//#region Rpc Service

@WithMiddleware(serviceMiddleware)
@RpcService()
export class RpcTestService implements RpcTestServiceInterface {
    @Rpc(() => String)
    async echo(...str: string[]): Promise<string> {
        const concat = str.join(' ');
        console.log('echo called!!!!!', concat);
        return concat;
    }

    // Fixed-arity required arguments — exercises the dispatcher's
    // missing-required-parameter rejection (audit finding 3): an omitted
    // or null declared-required argument must fail the call, never reach
    // the handler (RpcArgument's contract: non-optional "will throw an
    // error if missing").
    @Rpc(() => String)
    async echoRequired(
        @RpcArgument(() => String) greeting: string,
        @RpcArgument(() => String) name: string,
    ): Promise<string> {
        return `${greeting} ${name}`;
    }

    @Rpc(() => String)
    async testArrayResult(): Promise<string[]> {
        return ['test1'];
    }

    @Rpc(() => String)
    async testArrayResultWithArgs(
        test: string,
        test2: string,
    ): Promise<string[]> {
        return [test, test2];
    }

    @Rpc(() => Number)
    async testNumber(@RpcArgument(() => Number) test: number): Promise<number> {
        return test + 1;
    }

    @Rpc(() => Number)
    async testArrayAccumulate(
        @RpcArgument(() => [Number]) test: number[],
    ): Promise<number> {
        return test.reduce((a, b) => a + b, 0);
    }

    @Rpc(() => TestRpcObject)
    async testProcedureWithObjectArgs(
        @RpcArgument(() => TestRpcObject)
        test: TestRpcObject,
    ): Promise<TestRpcObject> {
        console.log('typeof test: ', typeof test);
        console.log('typeof test.testString: ', typeof test.testString);
        console.log('typeof test.testNumber: ', typeof test.testNumber);
        console.log('typeof test.testBoolean: ', typeof test.testBoolean);
        console.log('typeof test.testDateString: ', typeof test.testDateString);
        console.log('typeof test.testDate: ', typeof test.testDate);
        console.log(
            'typeof test.testNestedObject: ',
            typeof test.testNestedObject,
        );
        console.log('nested object: ', JSON.stringify(test.testNestedObject));
        console.log(
            'typeof test.testNestedObject.anotherNestedObject: ',
            typeof test.testNestedObject?.anotherNestedObject,
        );
        console.log(
            'nested nested object: ',
            JSON.stringify(test.testNestedObject?.anotherNestedObject),
        );
        return test;
    }

    @Rpc()
    async testProcedureWithInterfaceArgs(
        test: TestRpcObject,
    ): Promise<TestRpcObject> {
        console.log('typeof test: ', typeof test);
        console.log('typeof test.testString: ', typeof test.testString);
        console.log('typeof test.testNumber: ', typeof test.testNumber);
        console.log('typeof test.testBoolean: ', typeof test.testBoolean);
        console.log('typeof test.testDateString: ', typeof test.testDateString);
        console.log('typeof test.testDate: ', typeof test.testDate);
        console.log(
            'typeof test.testNestedObject: ',
            typeof test.testNestedObject,
        );
        console.log('nested object: ', JSON.stringify(test.testNestedObject));
        console.log(
            'typeof test.testNestedObject.anotherNestedObject: ',
            typeof test.testNestedObject?.anotherNestedObject,
        );
        console.log(
            'nested nested object: ',
            JSON.stringify(test.testNestedObject?.anotherNestedObject),
        );
        return test;
    }

    @Rpc(() => TestRpcObjects)
    async testProcedureWithObjectArrayArgs(
        @RpcArgument(() => TestRpcObjects)
        test: TestRpcObjects,
    ): Promise<TestRpcObjects> {
        console.log('test array: ', JSON.stringify(test));
        return test;
    }

    @Rpc()
    async testProcedureWithInterfaceArrayArgs(
        test: TestRpcObjects,
    ): Promise<TestRpcObjects> {
        console.log('test array: ', JSON.stringify(test));
        return test;
    }

    @Rpc()
    async testJsonArgs<T>(test: T): Promise<T> {
        console.log('test json: ', test);
        return test;
    }

    @Rpc()
    async testUndefined(): Promise<string | undefined> {
        return undefined;
    }

    @Rpc()
    async testNull(): Promise<string | null> {
        return null;
    }

    @Rpc()
    async testNestedFalsy(): Promise<{
        name: 'test';
        email: null;
        age: undefined;
        nested: {
            name: 'test';
            email: null;
            age: undefined;
        };
    }> {
        return {
            name: 'test',
            email: null,
            age: undefined,
            nested: {
                name: 'test',
                email: null,
                age: undefined,
            },
        };
    }

    @Rpc()
    async testVoid(arg1: string, arg2: string): Promise<void> {
        console.log('request', arg1, arg2);
        console.log('test void called!!!!!');
    }

    @Rpc()
    async testThrow(arg1: string, arg2: string): Promise<void> {
        console.log('request', arg1, arg2);
        console.log('test void called!!!!!');
        throw new Error('This is a test error');
    }

    @Rpc()
    async testHeaders(
        @InjectRequestContext() context: RequestContext,
    ): Promise<string | null> {
        console.log('request', context);
        if (context) {
            return context.headers.get('x-test-header') ?? null;
        }
        return null;
    }

    @Rpc()
    async testCookies(
        @InjectRequestContext() context: RequestContext,
    ): Promise<string> {
        if (context.cookies) {
            console.log('cookies', JSON.stringify(context.cookies));
            return context.cookies['my-cookie'] ?? 'no cookie found!';
        }
        return 'no cookie found!';
    }

    @Rpc()
    @WithMiddleware(myMiddleware1)
    async testMiddlewareSingle(
        @InjectRequestContext() context: RequestContext,
    ): Promise<string> {
        return context.get(myMiddleware1Key) ?? 'no value found in context';
    }

    @Rpc()
    @WithMiddleware([myMiddleware1, myMiddleware2, myMiddleware3])
    async testMiddlewareMultiple(
        @InjectRequestContext() context: RequestContext,
    ): Promise<string> {
        const output =
            (context.get(myMiddleware1Key) ?? '') +
            (context.get(myMiddleware2Key) ?? '') +
            (context.get(myMiddleware3Key) ?? '');
        return output;
    }

    @Rpc()
    @WithMiddleware(myMiddleware1)
    async testServiceMiddlwareSingle(
        @InjectRequestContext() context: RequestContext,
    ): Promise<string> {
        return context.get(serviceMiddlewareKey) ?? 'no value found in context';
    }

    @Rpc(() => ValidationRpcTest)
    async testValidation(
        @RpcArgument(() => ValidationRpcTest)
        test: ValidationRpcTest,
    ): Promise<ValidationRpcTest> {
        console.log('test array: ', JSON.stringify(test));
        return test;
    }

    @Rpc()
    async testRequestContext(
        @InjectRequestContext() rc?: RequestContext,
    ): Promise<{
        requestId: string;
        method: string;
        userAgent: string;
    }> {
        return {
            requestId: rc!.requestId,
            method: rc!.method,
            userAgent: rc!.userAgent,
        };
    }

    @Rpc()
    async testRequestContextWithArgs(
        input: string,
        @InjectRequestContext() rc?: RequestContext,
    ): Promise<{
        input: string;
        requestId: string;
    }> {
        return {
            input: input,
            requestId: rc!.requestId,
        };
    }

    /**
     * Regression coverage for positional-alignment on the RPC path.
     * `@InjectRequestContext` is between two positional args; a correct
     * dispatcher preserves both args and fills the RC at its declared
     * slot. If the server ever regressed to push-based assembly, the
     * trailing arg would end up `undefined` here.
     */
    @Rpc()
    async testRcMiddleArgs(
        before: string,
        @InjectRequestContext() rc: RequestContext | undefined,
        after: string,
    ): Promise<{
        before: string;
        rcRequestId: string;
        after: string;
    }> {
        return {
            before,
            rcRequestId: rc!.requestId,
            after,
        };
    }

    //#endregion Rpc Service
}
