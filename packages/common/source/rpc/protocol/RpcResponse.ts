// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseErrorData } from '../../error/interfaces/BaseErrorData';
import { RpcEnvelope } from './RpcEnvelope';
import { RpcErrorCode } from './RpcErrorCode';

/**
 * Object that represents a remote procedure call response.
 * Used as a transport to send RPC responses from the server.
 */
export interface RpcResponse extends RpcEnvelope {
    /**
     * The message type. For responses, this is always 'response'.
     */
    type: 'response';

    /**
     * The status of the RPC call.
     * Indicates whether the call was successful or failed.
     */
    status: 'success' | 'failure';

    /**
     * The processing time of the RPC call.
     * This is the time spent on the server-side processing the request.
     * It is not the time spent on the client-side waiting for the response.
     */
    durationMs?: number;
}

/**
 * Represents a successful remote procedure call response.
 */
export interface RpcSuccess<TResult = unknown> extends RpcResponse {
    /**
     * The status of the RPC call.
     * Indicates that the call has succeeded.
     */
    status: 'success';

    /**
     * The result of the remote procedure call.
     * This is the data returned by the procedure.
     * It can be any type, depending on the procedure's return type.
     */
    result?: TResult;
}

/**
 * Represents a failed remote procedure call response.
 */
export interface RpcFailure extends RpcResponse {
    /**
     * The status of the RPC call.
     * Indicates that the call has failed.
     */
    status: 'failure';

    /**
     * The name of the procedure that failed.
     */
    procedure: string;

    /**
     * The error object containing details about the failure.
     */
    error: {
        /**
         * Error code indicating the type of failure.
         * Use this code to dertermine how to handle the error
         * and how to interpret the error data.
         */
        code: RpcErrorCode;

        /**
         * A human-readable message describing the error.
         * This message can be displayed to the user or logged for debugging.
         */
        message: string;

        /**
         * Optional cause of the error.
         */
        cause?: BaseErrorData;
    };
}

/**
 * Represents the result of a remote procedure call.
 */
export type RpcResult<TResult = unknown> = RpcSuccess<TResult> | RpcFailure;

export function isBaseRpcResponse(response: unknown): response is RpcResponse {
    return (
        typeof response === 'object' &&
        response !== null &&
        'type' in response &&
        response.type === 'response' &&
        '__version' in response &&
        response.__version === '1.0' &&
        '__protocol' in response &&
        response.__protocol === 'BaseRPC'
    );
}

export function isRpcSuccessResponse(
    response: unknown,
): response is RpcSuccess {
    return (
        isBaseRpcResponse(response) &&
        'status' in response &&
        response.status === 'success'
    );
}

export function isRpcFailureResponse(
    response: unknown,
): response is RpcFailure {
    return (
        isBaseRpcResponse(response) &&
        'status' in response &&
        response.status === 'failure' &&
        'error' in response
    );
}
