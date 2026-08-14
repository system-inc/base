// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { rpcError } from '@system-inc/base-client/rpc/client/error/RpcClientErrorHandling';
import { Json } from '@system-inc/base-common/json/Json';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import {
    isRpcCall,
    RpcCall,
} from '@system-inc/base-common/rpc/protocol/RpcCall';
import {
    RPC_ERROR_CODE_INTERNAL_ERROR,
    RPC_ERROR_CODE_NOT_ALLOWED,
    RPC_ERROR_CODE_VALIDATION_ERROR,
} from '@system-inc/base-common/rpc/protocol/RpcErrorCode';
import {
    isRpcFailureResponse,
    RpcFailure,
    RpcSuccess,
} from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import {
    Constructor,
    isConstructor,
} from '@system-inc/base-common/type/Constructor';
import { EnumLike, isEnumLike } from '@system-inc/base-common/type/EnumLike';
import { isPrimitiveType } from '@system-inc/base-common/type/PrimitiveType';
import {
    TypeFunc,
    typeFuncUnwrap,
} from '@system-inc/base-common/type/TypeFunc';
import { RpcServerConfiguration } from '../../configuration/BaseConfiguration';
import { Runtime } from '../../configuration/Runtime';
import { ArgumentValidationError } from '../../error/ArgumentValidationError';
import { BaseError } from '../../error/BaseError';
import { HttpErrors } from '../../error/HttpErrors';
import {
    UnhandledExceptionEvent,
    UnhandledExceptionEventName,
} from '../../event/UnhandledExceptionEvent';
import { resolveRequestContextParams } from '../../request/decorators/RequestContextDecorator';
import { rpcErrorNotFound } from '../../rpc/error/RpcServerErrorHandling';
import { RpcVisibility } from '../../rpc/RpcVisibility';
import { deserialize } from '../../serialization/Deserialize';
import { serialize } from '../../serialization/Serialize';
import { validate } from '../../validation/ValidationEngine';
import {
    isWebSocketInfo,
    WebSocketInfoRequestContextKey,
} from '../../web-socket/WebSocketTypes';
import { runHandlerMiddleware } from '../middleware/Middleware';
import { BaseRequest } from '../request/BaseRequest';
import { RequestTimings } from '../request/RequestTimings';
import {
    RpcArgumentMetadata,
    RpcHandlerMetadata,
    rpcMetadataGet,
    RpcServiceMetadata,
} from './RpcMetadata';

/**
 * The RpcDispatcher class handles incoming RPC calls,
 * routes them to the correct procedure and returns the result.
 */
export class RpcDispatcher {
    private readonly visibility: RpcVisibility;
    private readonly allowedWorkers: string[];
    private readonly services: ReadonlyArray<Constructor<object>>;

    constructor(
        private readonly runtime: Runtime,
        configuration: RpcServerConfiguration,
    ) {
        this.visibility = this.runtime.mode.isLocal
            ? 'public'
            : (configuration.visibility ?? 'internal');
        this.allowedWorkers = configuration.allowedWorkers ?? [];
        this.services = configuration.procedures ?? [];
    }

    async handleRequest(request: BaseRequest): Promise<Response> {
        // get the RPC and run it
        const rpc = await this.getRpc(request);

        // set the rpc operation on the request
        request.context.rpc = rpc.procedure;

        // add the web socket info to the request if there is any
        if (isWebSocketInfo(rpc.meta)) {
            request.context.set(WebSocketInfoRequestContextKey, rpc.meta);
        }

        // get the RPC metadata
        const serviceMetadata = rpcMetadataGet(rpc.procedure);
        if (!serviceMetadata) {
            Logger.warn(
                LogCategory.Rpc,
                'RPC procedure %s not found in metadata.',
                rpc.procedure,
            );
            return Response.json(rpcErrorNotFound(rpc));
        }

        // verify the procedure visibility
        const visibilityResult = this.verifyProcedureVisibility(
            rpc,
            request,
            serviceMetadata,
        );
        // if the visibility check failed, return the error
        if (isRpcFailureResponse(visibilityResult)) {
            return Response.json(visibilityResult);
        }

        // only allow the RPC if it is in the list of services set in settings
        // this makes it so even if an RPC is defined, it won't be callable unless it is in the list
        if (!this.services.includes(serviceMetadata.serviceCtor)) {
            Logger.warn(
                LogCategory.Rpc,
                'RPC service %s not found for procedure %s.',
                serviceMetadata.serviceCtor.name,
                rpc.procedure,
            );
            return Response.json(rpcErrorNotFound(rpc));
        }

        const procedureMetadata = serviceMetadata.procedures[rpc.procedure];
        if (!procedureMetadata) {
            Logger.warn(
                LogCategory.Rpc,
                'RPC procedure %s not found in service metadata %s.',
                rpc.procedure,
                serviceMetadata.serviceCtor.name,
            );
            return Response.json(rpcErrorNotFound(rpc));
        }

        // run the procedure; handler middleware runs inside runRemoteProcedure
        // once rc.handler has been set.
        let rpcResult = await this.runRemoteProcedure(
            request,
            rpc,
            serviceMetadata,
            procedureMetadata,
        );

        // do not continue if the result is an error
        if (isRpcFailureResponse(rpcResult)) {
            return Response.json(rpcResult);
        }

        // if we have a return type, we need to run the
        // serialization logic before returning the result
        let returnType: Constructor | EnumLike | undefined = undefined;
        if (procedureMetadata.returnType) {
            returnType = typeFuncUnwrap(procedureMetadata.returnType);
            if (returnType) {
                rpcResult = serialize(rpcResult);
            }
        }

        request.context.stopWatch.split(RequestTimings.Handler);

        return Response.json({
            type: 'response',
            status: 'success',
            id: rpc.id,
            result: rpcResult,
            __protocol: 'BaseRPC',
            __version: '1.0',
            durationMs: request.context.stopWatch.getElapsedTimeToSplit(
                RequestTimings.Handler,
            ),
        } satisfies RpcSuccess);
    }

    private async getRpc(request: BaseRequest): Promise<RpcCall> {
        try {
            const rpc = await request.json();
            if (isRpcCall(rpc)) {
                return rpc;
            } else {
                Logger.warn(
                    LogCategory.Rpc,
                    "RPC request isn't a valid RemoteProcedureCall.",
                    rpc,
                );
                throw HttpErrors.badRequest({
                    message: 'Unable to process RPC, Malformed request.',
                });
            }
        } catch (e) {
            Logger.warn(LogCategory.Rpc, 'Malformed RPC request:', e);
            throw HttpErrors.badRequest({
                message: 'Unable to process RPC, Malformed request.',
            });
        }
    }

    private verifyProcedureVisibility(
        rpc: RpcCall,
        request: BaseRequest,
        rpcMetadata: RpcServiceMetadata,
    ): RpcFailure | undefined {
        // Most specific wins: procedure (@Rpc) over service (@RpcService)
        // over the worker's rpc.service settings.
        const visibility =
            rpcMetadata.procedures[rpc.procedure]?.options?.visibility ??
            rpcMetadata.options?.visibility ??
            this.visibility;

        if (this.runtime.mode.isDefault && visibility === 'internal') {
            // TODO decide if these errors are too detailed
            // make sure the request is an internal request
            const routingInfo = request.context.routing;
            if (routingInfo.originType !== 'internal') {
                const message = `Invalid RPC request - Internal access only.`;
                Logger.warn(LogCategory.Rpc, message);
                return rpcError(rpc, RPC_ERROR_CODE_NOT_ALLOWED, message);
            }

            // make sure we have a valid origin server
            if (!routingInfo.origin) {
                const message = `Invalid RPC request - No origin server found..`;
                Logger.warn(LogCategory.Rpc, message);
                return rpcError(rpc, RPC_ERROR_CODE_NOT_ALLOWED, message);
            }

            // make sure the origin server is allowed
            if (!this.allowedWorkers.includes(routingInfo.origin)) {
                const message = `Invalid RPC request - ${routingInfo.origin} access denied.`;
                Logger.warn(LogCategory.Rpc, message);
                return rpcError(rpc, RPC_ERROR_CODE_NOT_ALLOWED, message);
            }
        }

        // if we get this far, the RPC is allowed
        return undefined;
    }

    private async runRemoteProcedure(
        request: BaseRequest,
        rpc: RpcCall,
        serviceMetadata: RpcServiceMetadata,
        procedureMetadata: RpcHandlerMetadata,
    ): Promise<any> {
        Logger.debug(LogCategory.Rpc, 'RPC: %s', rpc.procedure);

        // Run handler middleware — access control (session access) first —
        // BEFORE resolving the service or binding/deserializing/validating
        // arguments, so an unauthenticated caller to a protected procedure
        // can't exercise deserialization/validation (or probe whether the
        // service exists) ahead of the auth check. The handler identity comes
        // from metadata, needing no resolved instance or bound arguments.
        const handler = new BaseHandler(
            serviceMetadata.serviceCtor,
            rpc.procedure,
        );
        request.context.handler = handler;
        const handlerMiddlewareResponse = await runHandlerMiddleware(
            request.context,
            handler,
        );
        request.context.stopWatch.split(RequestTimings.Middleware);
        if (handlerMiddlewareResponse) {
            // Handler middleware short-circuited (e.g. a rate limiter or
            // access guard returning a 429/403 Response). Convert it to an
            // RPC failure — RPC dispatch doesn't emit Responses, so returning
            // it as-is would let it fall through to the RpcSuccess wrapper and
            // serialize an enforcement denial as an empty success.
            return rpcError(
                rpc,
                RPC_ERROR_CODE_NOT_ALLOWED,
                `Request blocked by handler middleware (HTTP ${handlerMiddlewareResponse.status}).`,
            );
        }

        // get the service for the procedure
        let service: any = null;
        try {
            service = request.context.container.resolve(
                serviceMetadata.serviceCtor,
            );
        } catch (e) {
            // if we can't find the service return an error
            Logger.warn(
                LogCategory.Rpc,
                'Could not get service for procedure: %s.',
                rpc.procedure,
                e,
            );
            return rpcErrorNotFound(rpc);
        }

        // create the argument list for the route handler. Iterate over the
        // DECLARED arguments, not just the ones the caller sent — a trailing
        // required argument omitted from the call must fail the same way as
        // an explicit null, not silently reach the handler as undefined.
        const rpcArguments: unknown[] = [];
        const declaredArgumentCount = Object.keys(
            procedureMetadata.args,
        ).reduce((max, index) => Math.max(max, Number(index) + 1), 0);
        const argumentCount = Math.max(
            rpc.arguments.length,
            declaredArgumentCount,
        );
        for (let i = 0; i < argumentCount; i++) {
            // check if there is metadata for the argument
            const argMeta = procedureMetadata.args[i];
            if (!argMeta) {
                // if there is no metadata for the argument, we just
                // add the argument to the list of args and continue
                rpcArguments[i] = rpc.arguments[i];
                continue;
            }

            // get the raw parameters for the parameter we are working on
            const rawArg = rpc.arguments[i];

            // if there is a type definition then we need to deserialize and validate it
            let argValue: Json | object | undefined = rawArg;
            if (argMeta.typeFunc) {
                argValue = await this.deserializeArgument(
                    rpc,
                    i,
                    rawArg,
                    argMeta.typeFunc,
                );
                // if the deserialization failed, we return the error
                if (isRpcFailureResponse(argValue)) {
                    return argValue;
                }
            }

            const resolvedValue = this.getArgValue(rpc, argValue, argMeta);
            // getArgValue RETURNS the missing-required-parameter failure —
            // it must short-circuit the call, never be passed into the
            // handler as if it were the argument.
            if (isRpcFailureResponse(resolvedValue)) {
                return resolvedValue;
            }
            rpcArguments[i] = resolvedValue;
        }

        // resolve any @InjectRequestContext() decorated parameters
        resolveRequestContextParams(
            Object.getPrototypeOf(service),
            rpc.procedure,
            request.context,
            rpcArguments,
        );

        // run the procedure, do not try/catch, we want to let to complete
        // exception get thrown and retuned to the caller.
        try {
            return await service[rpc.procedure](...rpcArguments);
        } catch (e) {
            const { safe, raw, masked } = BaseError.forClient(e);
            if (masked) {
                Logger.error(LogCategory.Rpc, '%o', raw);
                // an error the app didn't model escaped the procedure —
                // surface it to unhandled-exception listeners after the
                // response goes out
                request.context.eventBus.defer<UnhandledExceptionEvent>({
                    name: UnhandledExceptionEventName,
                    error: raw,
                    surface: 'rpc',
                    requestId: request.context.requestId,
                    ipAddress: request.context.ipAddress,
                    userAgent: request.context.userAgent,
                    detail: rpc.procedure,
                });
            }
            return rpcError(
                rpc,
                RPC_ERROR_CODE_INTERNAL_ERROR,
                safe.message,
                safe.getSerializer().error,
            );
        }
    }

    private async deserializeArgument(
        rpc: RpcCall,
        argIndex: number,
        rawArg: Json,
        typeFunc: TypeFunc,
    ): Promise<RpcFailure | object | undefined> {
        try {
            // convert it into a typed param
            const bareFunc = typeFuncUnwrap(typeFunc);
            const typedParam = deserialize(rawArg, typeFunc);

            if (!typedParam) {
                // if the deserialization failed, we return undefined
                // this will be handled by the caller
                return undefined;
            }

            // determine if we need to do a validation pass, we can only do this on object types
            if (
                isEnumLike(bareFunc) ||
                (isConstructor(bareFunc) && isPrimitiveType(bareFunc))
            ) {
                return typedParam;
            }

            // if the type is a class, we need to validate it
            const errors = await validate(typedParam);
            if (errors.length > 0) {
                const message = `Validation failed for argument at index ${argIndex}.`;
                Logger.warn(LogCategory.Rpc, message, errors);
                return rpcError(
                    rpc,
                    RPC_ERROR_CODE_VALIDATION_ERROR,
                    message,
                    new ArgumentValidationError(errors).toJSON(),
                );
            }

            return typedParam;
        } catch (e) {
            const { safe, raw, masked } = BaseError.forClient(e);
            if (masked) {
                Logger.error(LogCategory.Rpc, '%o', raw);
            }
            return rpcError(
                rpc,
                RPC_ERROR_CODE_VALIDATION_ERROR,
                `Error deserializing argument at index ${argIndex}.`,
                safe.getSerializer().error,
            );
        }
    }

    private getArgValue(
        rpc: RpcCall,
        argValue: unknown,
        argMeta: RpcArgumentMetadata,
    ): RpcFailure | Json | object | undefined {
        // if the deserialization was successful, we add it to the arguments list
        if (argValue !== undefined) {
            return argValue;
        }

        // if we don't have a parameter value, we check if there is a default value
        if (argMeta.options?.defaultValue !== undefined) {
            return argMeta.options.defaultValue;
        }

        // if the parameter is optional, we can return undefined
        if (argMeta.options?.optional) {
            return undefined;
        }

        // if we don't have a parameter value and it is not optional, we return an error
        const message = `Missing required parameter at index ${argMeta.index}.`;
        Logger.warn(LogCategory.Rpc, message);
        return rpcError(rpc, RPC_ERROR_CODE_VALIDATION_ERROR, message);
    }
}
