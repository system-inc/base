// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { JsonArray, JsonObject } from '../../json/Json';
import { RpcEnvelope } from './RpcEnvelope';

/**
 * Object that represents a remote procedure call.
 * Used as a transport to send RPC calls to the server.
 */
export interface RpcCall<
    MetadataType extends JsonObject = JsonObject,
> extends RpcEnvelope<MetadataType> {
    readonly type: 'request';

    /**
     * The name of the procedure to call.
     */
    readonly procedure: string;

    /**
     * The arguments to pass to the procedure.
     */
    readonly arguments: JsonArray;
}

export function isRpcCall(obj: unknown): obj is RpcCall {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    const record = obj as Record<string, unknown>;

    if (record.type !== 'request') {
        return false;
    }
    if (typeof record.procedure !== 'string') {
        return false;
    }
    if (!Array.isArray(record.arguments)) {
        return false;
    }

    return true;
}
