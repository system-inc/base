// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseErrorData } from '@system-inc/base-common/error/interfaces/BaseErrorData';
import { RpcErrorCode } from '@system-inc/base-common/rpc/protocol/RpcErrorCode';
import { RpcFailure } from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { RpcClientResult } from '../interfaces/RpcClientResult';

/**
 * An error type that represents an error from an RPC call.
 */
export class RpcError extends Error {
    /**
     * The id of the RPC sent to the server.
     */
    readonly id: string;

    /**
     * The remote procedure that caused the error.
     */
    readonly procedure: string;

    /**
     * The RPC specific error code.
     */
    readonly code: RpcErrorCode;

    /**
     * The cause of this error.
     */
    readonly cause?: BaseErrorData;

    /**
     * The HTTP status and status text of the response.
     */
    readonly http: {
        /**
         * The HTTP status code of the response.
         */
        status: number;

        /**
         * The HTTP status text of the response.
         */
        statusText: string;
    };

    constructor(failure: RpcClientResult<RpcFailure>) {
        super();
        this.name = 'RpcError';
        this.id = failure.id;
        this.procedure = failure.procedure;
        this.code = failure.error.code;
        this.message = failure.error.message;
        this.cause = failure.error.cause;
        this.http = {
            status: failure.http.status,
            statusText: failure.http.statusText,
        };
    }
}
