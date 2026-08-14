// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { cfPrepareRequest } from '@system-inc/base-common/cloudflare/CloudflareRequest';
import {
    HTTP_HEADER_CONTENT_TYPE,
    HTTP_HEADER_COOKIE,
} from '@system-inc/base-common/http/HttpHeaders';
import { MEDIA_TYPE_APPLICATION_JSON } from '@system-inc/base-common/http/MediaType';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import {
    isRpcFailureResponse,
    isRpcSuccessResponse,
    RpcResult,
} from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import {
    HttpError,
    httpErrorFromJson,
    httpErrorFromResponse,
} from '../../../error/HttpError';
import { rpcErrorMalformedResponse } from '../error/RpcClientErrorHandling';
import { RpcCallOptions } from '../interfaces/RpcCallOptions';
import { RpcClientOptions } from '../interfaces/RpcClientOptions';
import { RpcClientResult } from '../interfaces/RpcClientResult';

/**
 * A client driver for making remote procedure calls using a standard fetch request.
 */
export abstract class RpcClientDriver {
    async handleResponse(
        rpc: RpcCall,
        response: Response,
    ): Promise<RpcClientResult<RpcResult>> {
        try {
            // check the response, return an error if it isn't a success code
            // if the response is not a success code, throw an error
            if (!isRpcSuccessCode(response.status)) {
                throw await httpErrorFromResponse(response);
            }

            // first check and see if the response media type is json
            // if not, nothing we can do, so throw an error
            if (
                !response.headers
                    .get(HTTP_HEADER_CONTENT_TYPE)
                    ?.includes(MEDIA_TYPE_APPLICATION_JSON)
            ) {
                throw await httpErrorFromResponse(response);
            }

            const rpcResponse: unknown = await response.json();
            if (
                isRpcSuccessResponse(rpcResponse) ||
                isRpcFailureResponse(rpcResponse)
            ) {
                return {
                    ...rpcResponse,
                    http: {
                        status: response.status,
                        statusText: response.statusText,
                    },
                };
            }

            throw httpErrorFromJson(response, rpcResponse);
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }
            // Don't mask an abort (fired by the caller's AbortSignal mid-parse)
            // as a malformed response — surface the real cause.
            if (error instanceof Error && error.name === 'AbortError') {
                throw error;
            }
            // Return the failure result (rather than throwing this plain,
            // non-Error object) so the client's normal failure path raises a
            // proper RpcError.
            return rpcErrorMalformedResponse(rpc, response);
        } finally {
            if (!response.bodyUsed) {
                await response.body?.cancel();
            }
        }
    }

    abstract sendRequest(request: RequestInit): Promise<Response>;

    buildRequest(
        rpc: RpcCall,
        options: RpcCallOptions & RpcClientOptions,
    ): RequestInit {
        // We use our own ReqeustInit type to make it easier to work with
        const requestInit: {
            method: 'POST';
            body: string;
            headers: Dictionary<string>;
            credentials?: RequestCredentials;
            mode?: RequestMode;
            priority?: RequestPriority;
            keepalive?: boolean;
            signal?: AbortSignal;
            cache?: RequestCache;
        } = {
            method: 'POST',
            body: JSON.stringify(rpc),
            headers: {
                [HTTP_HEADER_CONTENT_TYPE]: MEDIA_TYPE_APPLICATION_JSON,
            },
        };

        if (options.credentials) {
            requestInit.credentials = options.credentials;
        }

        if (options.mode) {
            requestInit.mode = options.mode;
        }

        if (options.priority) {
            requestInit.priority = options.priority;
        }

        if (options.keepalive) {
            requestInit.keepalive = options.keepalive;
        }

        if (options.signal) {
            requestInit.signal = options.signal;
        }

        if (options.cache) {
            requestInit.cache = options.cache;
        }

        // if a template request is provided, copy the headers from it
        if (options.request) {
            // Display the key/value pairs
            const optionsRequestHeaders: Dictionary<string> = {};
            for (const pair of options.request.headers.entries()) {
                optionsRequestHeaders[pair[0]] = pair[1];
            }
            // merge the headers from the request from options
            requestInit.headers = {
                ...requestInit.headers,
                ...optionsRequestHeaders,
            };
        }

        if (options.headers) {
            // merge the headers from options
            requestInit.headers = {
                ...requestInit.headers,
                ...options.headers,
            };
        }

        // set the cookies
        const cookieString = this.getCookies(options.cookies);
        if (cookieString) {
            if (requestInit.headers[HTTP_HEADER_COOKIE]) {
                requestInit.headers[HTTP_HEADER_COOKIE] += `; ${cookieString}`;
            } else {
                requestInit.headers[HTTP_HEADER_COOKIE] = cookieString;
            }
        }

        // cfPrepareRequest sanitizes hop-by-hop headers but deliberately drops
        // credentials/mode/cache. Those are needed and supported in browsers
        // (e.g. credentials: 'include' to send the session cookie
        // cross-origin), so carry them back through. On Cloudflare the
        // platform delegate's fetch patch runs cfPrepareRequest again at the
        // real fetch boundary, stripping what workerd genuinely can't handle.
        const prepared = cfPrepareRequest(requestInit, false);
        if (requestInit.credentials) {
            prepared.credentials = requestInit.credentials;
        }
        if (requestInit.mode) {
            prepared.mode = requestInit.mode;
        }
        if (requestInit.cache) {
            prepared.cache = requestInit.cache;
        }
        return prepared;
    }

    private getCookies(cookies?: Dictionary<string>): string | undefined {
        if (!cookies) {
            return undefined;
        }
        const cookieKeys = Object.keys(cookies);
        if (cookieKeys.length === 0) {
            return undefined;
        }
        return cookieKeys.map((key) => `${key}=${cookies[key]}`).join('; ');
    }
}

export function isRpcSuccessCode(httpStatusCode: number): boolean {
    const successCodes = [200];
    return successCodes.includes(httpStatusCode);
}
