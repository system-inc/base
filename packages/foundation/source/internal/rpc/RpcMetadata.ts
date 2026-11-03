// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { PartialDictionary } from '@system-inc/base-common/type/Dictionary';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { RpcOptions } from '../../rpc/decorators/Rpc';
import { RpcArgumentOptions } from '../../rpc/decorators/RpcArgument';
import { RpcServiceOptions } from '../../rpc/decorators/RpcService';

export interface RpcArgumentMetadata {
    typeFunc?: TypeFunc;
    index: number;
    options?: RpcArgumentOptions;
}

export interface RpcHandlerMetadata {
    handlerName: string;
    /**
     * Set by `@Rpc()` / `@WebSocketRpc()`: the method is a declared
     * procedure. `@RpcArgument` alone records argument metadata but never
     * makes a method callable.
     */
    declared: boolean;
    returnType?: TypeFunc;
    args: Record<number, RpcArgumentMetadata | undefined>;
    options?: RpcOptions;
    /**
     * Set by `@WebSocketRpc()`: the procedure is callable only by a client
     * over a WebSocket, never over HTTP.
     */
    webSocket?: boolean;
}

export interface RpcServiceMetadata {
    serviceCtor: Constructor;
    procedures: PartialDictionary<RpcHandlerMetadata>;
    options?: RpcServiceOptions;
}

/**
 * Keyed by the *actual class* (constructor), so no string collisions.
 * Automatic GC when the class is unloaded (workers, tests, etc.).
 */
const META = new WeakMap<Constructor, RpcServiceMetadata>();

/**
 * Metadata for defining a RPC service class.
 */
export interface AddRpcServiceMetadata {
    readonly serviceCtor: Constructor;
    readonly options?: RpcServiceOptions;
}

/**
 * Adds metadata for a remote procedure service.
 * This is used to register a class as a remote procedure service.
 *
 * @param serviceMetadata
 * @returns
 */
export function rpcMetadataAddService(
    serviceMetadata: AddRpcServiceMetadata,
): RpcServiceMetadata {
    let rpcMetadata = META.get(serviceMetadata.serviceCtor);
    if (!rpcMetadata) {
        rpcMetadata = {
            serviceCtor: serviceMetadata.serviceCtor,
            procedures: {},
            options: serviceMetadata.options,
        };
        META.set(serviceMetadata.serviceCtor, rpcMetadata);
    } else {
        rpcMetadata.options = serviceMetadata.options;
    }
    return rpcMetadata;
}

/**
 * All metadata related to the actual callable procedure.
 */
export interface AddRpcHandlerMetadata {
    readonly serviceCtor: Constructor;
    readonly handlerName: string;
    readonly returnType?: TypeFunc;
    readonly options?: RpcOptions;
    readonly webSocket?: boolean;
}

/**
 * Returns the method's handler metadata, creating an undeclared entry when
 * none exists yet. Parameter decorators run before the method decorator,
 * so `@RpcArgument` usually creates the entry that `@Rpc()` then declares.
 */
function rpcMetadataGetOrCreateHandler(
    serviceCtor: Constructor,
    handlerName: string,
): RpcHandlerMetadata {
    const rpcMetadata = rpcMetadataAddService({ serviceCtor });
    let rpcProcedure = rpcMetadata.procedures[handlerName];
    if (!rpcProcedure) {
        rpcProcedure = { handlerName, declared: false, args: {} };
        rpcMetadata.procedures[handlerName] = rpcProcedure;
    }
    return rpcProcedure;
}

/**
 * Declares a method as a remote procedure handler. Called by `@Rpc()` and
 * `@WebSocketRpc()`; only declared handlers are callable.
 *
 * @param procedureMetadata
 * @returns
 */
export function rpcMetadataAddHandler(
    procedureMetadata: AddRpcHandlerMetadata,
): RpcHandlerMetadata {
    const rpcProcedure = rpcMetadataGetOrCreateHandler(
        procedureMetadata.serviceCtor,
        procedureMetadata.handlerName,
    );
    rpcProcedure.declared = true;
    rpcProcedure.returnType = procedureMetadata.returnType;
    rpcProcedure.options = procedureMetadata.options;
    rpcProcedure.webSocket = procedureMetadata.webSocket;
    return rpcProcedure;
}

/**
 * Metadata for parameters of Procedures.
 */
export interface AddRpcArgumentMetadata {
    readonly serviceCtor: Constructor;
    readonly handler: string;
    readonly index: number;
    readonly typeFunc: TypeFunc;
    readonly options?: RpcArgumentOptions;
}

export function rpcMetadataAddArgument(paramMeta: AddRpcArgumentMetadata) {
    const rpcProcedure = rpcMetadataGetOrCreateHandler(
        paramMeta.serviceCtor,
        paramMeta.handler,
    );

    let rpcParameter = rpcProcedure.args[paramMeta.index];
    if (rpcParameter) {
        // If the parameter already exists, we can skip adding it again
        // This can happen in HMR or tests where the file is re-evaluated
        return;
    }

    rpcParameter = {
        typeFunc: paramMeta.typeFunc,
        index: paramMeta.index,
        options: paramMeta.options,
    };
    rpcProcedure.args[paramMeta.index] = rpcParameter;
}

export function rpcMetadataGetService(
    serviceCtor: Constructor,
): RpcServiceMetadata | undefined {
    return META.get(serviceCtor);
}

/**
 * A declared procedure and the service that declares it.
 */
export interface RpcProcedureEntry {
    readonly service: RpcServiceMetadata;
    readonly procedure: RpcHandlerMetadata;
}

/**
 * Indexes the declared procedures of the given (registered) services by
 * procedure name. Services that are decorated but not registered are never
 * consulted, so they can't shadow a registered procedure.
 *
 * Throws when two services declare the same procedure name: the BaseRPC
 * wire format names only the procedure, so such a call would be ambiguous.
 */
export function rpcMetadataIndexProcedures(
    services: ReadonlyArray<Constructor<object>>,
): ReadonlyMap<string, RpcProcedureEntry> {
    const index = new Map<string, RpcProcedureEntry>();
    for (const serviceCtor of new Set(services)) {
        const service = META.get(serviceCtor);
        if (!service) {
            continue;
        }
        for (const procedure of Object.values(service.procedures)) {
            if (!procedure?.declared) {
                continue;
            }
            const existing = index.get(procedure.handlerName);
            if (existing) {
                throw new Error(
                    `RPC procedure "${procedure.handlerName}" is declared by both ${existing.service.serviceCtor.name} and ${serviceCtor.name}. RPC calls name only the procedure, so procedure names must be unique across a worker's registered RPC services — rename one of them.`,
                );
            }
            index.set(procedure.handlerName, { service, procedure });
        }
    }
    return index;
}
