// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { RPC_ERROR_CODE_NOT_ALLOWED } from '@system-inc/base-common/rpc/protocol/RpcErrorCode';
import {
    isRpcFailureResponse,
    isRpcSuccessResponse,
} from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { Runtime } from '../../configuration/Runtime';
import { HttpErrors } from '../../error/HttpErrors';
import { UnhandledExceptionEventName } from '../../event/UnhandledExceptionEvent';
import { BaseRequest } from '../request/BaseRequest';
import { RpcDispatcher } from './RpcDispatcher';

class BlockedService {
    doThing(): string {
        return 'should not run';
    }
}

const rpc = {
    type: 'request',
    id: 'call-1',
    procedure: 'doThing',
    arguments: [],
    __version: '1.0',
    __protocol: 'BaseRPC',
} as unknown as RpcCall;

function makeRequest(handlerMiddleware: unknown[]): BaseRequest {
    return {
        context: {
            container: { resolve: () => new BlockedService() },
            handler: undefined,
            stopWatch: { split: () => {} },
            configuration: {
                middleware: { handler: handlerMiddleware },
                accessControl: { provider: null },
            },
        },
    } as unknown as BaseRequest;
}

describe('RpcDispatcher handler-middleware short-circuit', () => {
    const dispatcher = new RpcDispatcher(
        { mode: { isLocal: true } } as unknown as Runtime,
        { procedures: [BlockedService] } as never,
    );

    function runRemoteProcedure(request: BaseRequest): Promise<unknown> {
        return (
            dispatcher as unknown as {
                runRemoteProcedure: (
                    request: BaseRequest,
                    rpc: RpcCall,
                    serviceMetadata: unknown,
                    procedureMetadata: unknown,
                ) => Promise<unknown>;
            }
        ).runRemoteProcedure(
            request,
            rpc,
            { serviceCtor: BlockedService },
            { args: {} },
        );
    }

    it('converts a middleware short-circuit Response into an RPC failure', async () => {
        // a guard middleware blocks the request with a 403 Response
        const request = makeRequest([
            () => new Response(null, { status: 403 }),
        ]);

        const result = (await runRemoteProcedure(request)) as {
            error?: { code?: string };
        };

        // it must be a failure, NOT a success wrapping the Response as {}
        expect(isRpcFailureResponse(result)).toBe(true);
        expect(isRpcSuccessResponse(result)).toBe(false);
        expect(result.error?.code).toBe(RPC_ERROR_CODE_NOT_ALLOWED);
    });

    it('runs the procedure when no middleware short-circuits', async () => {
        const result = await runRemoteProcedure(makeRequest([]));
        expect(result).toBe('should not run');
    });

    it('does not deserialize/validate arguments when middleware denies', async () => {
        const request = makeRequest([
            () => new Response(null, { status: 401 }),
        ]);
        const deserializeSpy = jest.spyOn(
            dispatcher as unknown as {
                deserializeArgument: (...args: unknown[]) => unknown;
            },
            'deserializeArgument',
        );

        const rpcWithArg = {
            ...rpc,
            arguments: [{ payload: 'value' }],
        } as unknown as RpcCall;

        const result = (await (
            dispatcher as unknown as {
                runRemoteProcedure: (
                    request: BaseRequest,
                    rpc: RpcCall,
                    serviceMetadata: unknown,
                    procedureMetadata: unknown,
                ) => Promise<unknown>;
            }
        ).runRemoteProcedure(
            request,
            rpcWithArg,
            { serviceCtor: BlockedService },
            { args: { 0: { typeFunc: () => Object } } },
        )) as { error?: { code?: string } };

        // access control (handler middleware) now runs before argument
        // binding, so a denied caller never reaches deserialization/validation
        expect(result.error?.code).toBe(RPC_ERROR_CODE_NOT_ALLOWED);
        expect(deserializeSpy).not.toHaveBeenCalled();
        deserializeSpy.mockRestore();
    });
});

class ThrowingService {
    unmodeled(): string {
        throw new Error('This is a test error');
    }

    modeled(): string {
        throw HttpErrors.forbidden({ message: 'nope' });
    }
}

describe('RpcDispatcher defers Base.UnhandledException', () => {
    const dispatcher = new RpcDispatcher(
        { mode: { isLocal: true } } as unknown as Runtime,
        { procedures: [ThrowingService] } as never,
    );

    /**
     * The bus is faked down to `defer` — what's under test is WHICH
     * exceptions reach it and what they carry, not the bus's own delivery
     * (covered by `event/BaseEventBus.test.ts`).
     */
    function runProcedure(procedure: string): {
        result: Promise<unknown>;
        deferred: Array<Record<string, unknown>>;
    } {
        const deferred: Array<Record<string, unknown>> = [];
        const request = {
            context: {
                container: { resolve: () => new ThrowingService() },
                handler: undefined,
                stopWatch: { split: () => {} },
                configuration: {
                    middleware: { handler: [] },
                    accessControl: { provider: null },
                },
                eventBus: {
                    defer: (event: Record<string, unknown>) => {
                        deferred.push(event);
                    },
                },
                requestId: 'request-1',
                ipAddress: '203.0.113.7',
                userAgent: 'jest-agent',
            },
        } as unknown as BaseRequest;

        const result = (
            dispatcher as unknown as {
                runRemoteProcedure: (
                    request: BaseRequest,
                    rpc: RpcCall,
                    serviceMetadata: unknown,
                    procedureMetadata: unknown,
                ) => Promise<unknown>;
            }
        ).runRemoteProcedure(
            request,
            { ...rpc, procedure: procedure } as unknown as RpcCall,
            { serviceCtor: ThrowingService },
            { args: {} },
        );
        return { result: result, deferred: deferred };
    }

    it('fires for an error the procedure did not model, carrying the raw error', async () => {
        const { result, deferred } = runProcedure('unmodeled');

        // the caller gets a masked failure, the listener the original error
        expect(isRpcFailureResponse(await result)).toBe(true);
        expect(deferred).toHaveLength(1);
        const event = deferred[0];
        expect(event.name).toBe(UnhandledExceptionEventName);
        expect(event.surface).toBe('rpc');
        expect((event.error as Error).message).toBe('This is a test error');
        expect(event.detail).toBe('unmodeled');
        expect(event.requestId).toBe('request-1');
        expect(event.ipAddress).toBe('203.0.113.7');
        expect(event.userAgent).toBe('jest-agent');
    });

    it('does not fire for a modeled, client-facing HttpError', async () => {
        const { result, deferred } = runProcedure('modeled');

        expect(isRpcFailureResponse(await result)).toBe(true);
        expect(deferred).toEqual([]);
    });
});

describe('RpcDispatcher visibility precedence', () => {
    // Non-local runtime so 'internal' is actually enforced.
    const dispatcher = new RpcDispatcher(
        { mode: { isLocal: false, isDefault: true } } as unknown as Runtime,
        {
            procedures: [BlockedService],
            visibility: 'internal',
            allowedWorkers: [],
        } as never,
    );

    // An external caller: only 'public' visibility lets it through.
    const externalRequest = {
        context: { routing: { originType: 'external', origin: undefined } },
    } as unknown as BaseRequest;

    function verify(
        procedureVisibility?: string,
        serviceVisibility?: string,
    ): unknown {
        return (
            dispatcher as unknown as {
                verifyProcedureVisibility: (
                    rpc: RpcCall,
                    request: BaseRequest,
                    rpcMetadata: unknown,
                ) => unknown;
            }
        ).verifyProcedureVisibility(rpc, externalRequest, {
            serviceCtor: BlockedService,
            options: serviceVisibility
                ? { visibility: serviceVisibility }
                : undefined,
            procedures: {
                doThing: {
                    handlerName: 'doThing',
                    args: {},
                    options: procedureVisibility
                        ? { visibility: procedureVisibility }
                        : undefined,
                },
            },
        });
    }

    it('blocks external callers when nothing overrides the internal default', () => {
        expect(isRpcFailureResponse(verify())).toBe(true);
    });

    it('@Rpc({ visibility: "public" }) opens one procedure on an internal service', () => {
        expect(verify('public', 'internal')).toBeUndefined();
    });

    it('procedure-level visibility wins over a public service-level setting', () => {
        expect(isRpcFailureResponse(verify('internal', 'public'))).toBe(true);
    });

    it('service-level visibility applies when the procedure sets none', () => {
        expect(verify(undefined, 'public')).toBeUndefined();
    });
});
