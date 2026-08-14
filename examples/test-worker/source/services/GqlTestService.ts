// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';
import { GqlArgument } from '@system-inc/base-foundation/graphql/decorators/GqlArgument';
import { GqlField } from '@system-inc/base-foundation/graphql/decorators/GqlField';
import { GqlInputType } from '@system-inc/base-foundation/graphql/decorators/GqlInputType';
import { GqlMutation } from '@system-inc/base-foundation/graphql/decorators/GqlMutation';
import { GqlObjectType } from '@system-inc/base-foundation/graphql/decorators/GqlObjectType';
import { InjectGqlOperationContext } from '@system-inc/base-foundation/graphql/decorators/GqlOperationContext';
import { GqlQuery } from '@system-inc/base-foundation/graphql/decorators/GqlQuery';
import { GqlResolver } from '@system-inc/base-foundation/graphql/decorators/GqlResolver';
import { GqlOperationContext } from '@system-inc/base-foundation/graphql/GqlOperationContext';
import { InjectRequestContext } from '@system-inc/base-foundation/request/decorators/RequestContextDecorator';
import { RequestContext } from '@system-inc/base-foundation/request/RequestContext';
import { VerifyIsNotEmpty } from '@system-inc/base-foundation/validation/decorators/VerifyIsNotEmpty';
import { VerifyMax } from '@system-inc/base-foundation/validation/decorators/VerifyMax';
import { CrossDispatcherTokenKey } from './CrossDispatcherInjection';

@GqlObjectType()
@GqlInputType('TesterInput')
export class Tester {
    @VerifyIsNotEmpty()
    @GqlField(() => String)
    name: string;

    @VerifyMax(55)
    @GqlField(() => Number)
    age: number;
}

@GqlObjectType()
export class RcInjectionResult {
    @GqlField(() => String)
    requestId: string;

    @GqlField(() => String, { nullable: true })
    deviceId: string | null;
}

@GqlObjectType()
export class RcMiddleResult {
    @GqlField(() => String)
    before: string;

    @GqlField(() => String)
    rcRequestId: string;

    @GqlField(() => String)
    after: string;
}

@GqlObjectType()
export class OpContextResult {
    @GqlField(() => String)
    operationType: string;

    @GqlField(() => String)
    operationName: string;

    @GqlField(() => [String])
    selectedFields: string[];
}

@Injectable()
@GqlResolver(() => Tester)
export class GqlTestService {
    @GqlQuery(() => Tester)
    async basicQuery(): Promise<Tester> {
        return {
            name: 'John',
            age: 10,
        };
    }

    @GqlMutation(() => Tester)
    async basicMutation(): Promise<Tester> {
        return {
            name: 'Johnny',
            age: 101,
        };
    }

    @GqlQuery(() => Tester)
    async testThrow(): Promise<Tester> {
        throw HttpErrors.forbidden({ message: 'This is a test error' });
    }

    @GqlQuery(() => Tester)
    async testValidation(
        @GqlArgument('input', () => Tester) input: Tester,
    ): Promise<Tester> {
        return input;
    }

    /**
     * Exercises `@InjectRequestContext` across dispatchers — specifically
     * the GraphQL path, which routes through the forked type-graphql's
     * metadata-driven injection (see `resolvers/helpers.ts`).
     */
    @GqlQuery(() => RcInjectionResult)
    async rcInjection(
        @InjectRequestContext() rc: RequestContext,
    ): Promise<RcInjectionResult> {
        return {
            requestId: rc.requestId,
            deviceId: null,
        };
    }

    /**
     * Other half of the cross-dispatcher injection regression: echoes
     * whatever a worker-level global middleware wrote into the RC bag
     * under `crossDispatcherTokenKey`. A matching HTTP route
     * (`/test/router/cross-dispatcher`) echoes the same key. The
     * integration test asserts both extract the same value from a
     * shared header — proving `@InjectRequestContext(KEY)` resolves
     * consistently across dispatchers.
     */
    @GqlQuery(() => String, { nullable: true })
    async crossDispatcherToken(
        @InjectRequestContext(CrossDispatcherTokenKey)
        value: string | undefined,
    ): Promise<string | null> {
        return value ?? null;
    }

    /**
     * Regression coverage for the fork's `getParams` positional-alignment
     * bug. `@InjectRequestContext` sits between two `@GqlArgument` params;
     * a correct implementation echoes both args and the RC alongside
     * each other. A broken implementation loses whichever arg's slot
     * collides with the RC write position.
     */
    @GqlQuery(() => RcMiddleResult)
    async rcMiddleInjection(
        @GqlArgument('before', () => String) before: string,
        @InjectRequestContext() rc: RequestContext,
        @GqlArgument('after', () => String) after: string,
    ): Promise<RcMiddleResult> {
        return {
            before,
            rcRequestId: rc.requestId,
            after,
        };
    }

    @GqlQuery(() => OpContextResult)
    async opContext(
        @InjectGqlOperationContext()
        operationContext: GqlOperationContext<OpContextResult>,
    ): Promise<OpContextResult> {
        return {
            operationType: operationContext.type,
            operationName: operationContext.name,
            selectedFields: Object.keys(operationContext.selectionSet),
        };
    }

    @GqlMutation(() => OpContextResult)
    async opContextMutation(
        @InjectGqlOperationContext()
        operationContext: GqlOperationContext<OpContextResult>,
    ): Promise<OpContextResult> {
        return {
            operationType: operationContext.type,
            operationName: operationContext.name,
            selectedFields: Object.keys(operationContext.selectionSet),
        };
    }
}
