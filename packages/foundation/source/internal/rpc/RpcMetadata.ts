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
    returnType?: TypeFunc;
    args: Record<number, RpcArgumentMetadata | undefined>;
    options?: RpcOptions;
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

const HANDLER_LOOKUP = new Map<string, RpcServiceMetadata>();

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
}

/**
 * Adds metadata for a remote procedure handler.
 * This is used to register a method as a remote procedure handler.
 *
 * @param procedureMetadata
 * @returns
 */
export function rpcMetadataAddHandler(
    procedureMetadata: AddRpcHandlerMetadata,
): RpcHandlerMetadata {
    const rpcMetadata = rpcMetadataAddService({
        serviceCtor: procedureMetadata.serviceCtor,
    });

    let rpcProcedure = rpcMetadata.procedures[procedureMetadata.handlerName];
    if (!rpcProcedure) {
        rpcProcedure = {
            handlerName: procedureMetadata.handlerName,
            returnType: procedureMetadata.returnType,
            args: {},
            options: procedureMetadata.options,
        };
        rpcMetadata.procedures[procedureMetadata.handlerName] = rpcProcedure;
    } else {
        rpcProcedure.returnType = procedureMetadata.returnType;
        rpcProcedure.options = procedureMetadata.options;
    }

    if (!HANDLER_LOOKUP.has(procedureMetadata.handlerName)) {
        HANDLER_LOOKUP.set(procedureMetadata.handlerName, rpcMetadata);
    }

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
    const rpcProcedure = rpcMetadataAddHandler({
        serviceCtor: paramMeta.serviceCtor,
        handlerName: paramMeta.handler,
    });

    let rpcParameter = rpcProcedure?.args[paramMeta.index];
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

export function rpcMetadataGet(
    procedureName: string,
): RpcServiceMetadata | undefined {
    return HANDLER_LOOKUP.get(procedureName);
}
