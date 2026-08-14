// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { backoff } from '@system-inc/base-common/concurrent/Backoff';
import { JsonArray } from '@system-inc/base-common/json/Json';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import {
    isRpcFailureResponse,
    RpcResult,
} from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { MakeOptional } from '@system-inc/base-common/type/UtilityTypes';
import { RpcClientDriver } from './driver/RpcClientDriver';
import { RpcError } from './error/RpcError';
import { RpcCallOptions } from './interfaces/RpcCallOptions';
import { RpcClientIdGenerator } from './interfaces/RpcClientIdGenerator';
import { RpcClientOptions } from './interfaces/RpcClientOptions';
import { RpcClientResult } from './interfaces/RpcClientResult';

/**
 * Client for calling remote procedures.
 */
export class RpcClient<RpcInterface extends object> {
    readonly options: Readonly<RpcClientOptions>;
    private readonly idGenerator: RpcClientIdGenerator;

    constructor(
        readonly driver: RpcClientDriver,
        options?: RpcClientOptions,
    ) {
        this.driver = driver;
        this.options = options ? options : {};
        this.idGenerator = options?.idGenerator ?? (() => crypto.randomUUID());
    }

    /**
     * Creates a new call to a remote procedure.
     *
     * @param options
     * @returns
     */
    call(options?: RpcCallOptions): RpcInterface {
        return new Proxy(
            options || {},
            new RpcCallOptionsTrap(this),
        ) as unknown as RpcInterface;
    }

    /**
     * Calls the specified remote procedure with the specified arguments and options.
     *
     * Used to invoke a remote procedure directly and allows inspection of the response.
     *
     * @param procedure
     * @param args
     * @param options
     * @returns
     */
    async callProcedure<K extends RpcMethodKey<RpcInterface>>(
        procedure: K,
        args: RpcMethodParams<RpcInterface, K>,
        options?: RpcCallOptions,
    ): Promise<RpcClientResult<RpcResult>> {
        const procedureName = procedure.toString();
        // create the partial RPC call data
        const partialRpc: MakeOptional<RpcCall, 'id'> = {
            type: 'request',
            id: options?.id,
            procedure: procedureName,
            arguments: args as JsonArray,
            meta: options?.meta,
            __protocol: 'BaseRPC',
            __version: '1.0',
        };

        // if the id is not set, generate a new one
        let rpc: RpcCall;
        if (!partialRpc.id) {
            const id = this.idGenerator(partialRpc);
            rpc = { ...partialRpc, id };
        } else {
            rpc = partialRpc as RpcCall;
        }

        // create the request options by merging the RPC call options with the client options
        const requestOptions: RpcCallOptions & RpcClientOptions = {
            credentials: this.options.credentials,
            mode: this.options.mode,
            keepalive: options?.keepalive ?? this.options.keepalive,
            priority: options?.priority ?? this.options.priority,
            headers: {
                ...this.options.headers,
                ...options?.headers,
            },
            cookies: {
                ...this.options.cookies,
                ...options?.cookies,
            },
            signal: options?.signal,
            request: options?.request,
        };

        // Set up retry configuration with defaults
        const retryConfig = {
            maxAttempts: options?.retry?.maxAttempts ?? 3,
            minBackoffMs: options?.retry?.minBackoffMs ?? 100,
            maxBackoffMs: options?.retry?.maxBackoffMs ?? 2000,
            jitter: options?.retry?.jitter ?? true,
            isRetryable: options?.retry?.isRetryable ?? defaultIsRetryable,
        };

        // Validate retry configuration parameters
        if (retryConfig.maxAttempts < 1 || retryConfig.maxAttempts > 20) {
            throw new Error(
                `Invalid maxAttempts: ${retryConfig.maxAttempts}. Must be between 1 and 20.`,
            );
        }
        if (retryConfig.minBackoffMs < 0 || retryConfig.minBackoffMs > 60000) {
            throw new Error(
                `Invalid minBackoffMs: ${retryConfig.minBackoffMs}. Must be between 0 and 60000.`,
            );
        }
        if (
            retryConfig.maxBackoffMs < retryConfig.minBackoffMs ||
            retryConfig.maxBackoffMs > 300000
        ) {
            throw new Error(
                `Invalid maxBackoffMs: ${retryConfig.maxBackoffMs}. Must be between minBackoffMs and 300000 (5 minutes).`,
            );
        }

        const request = this.driver.buildRequest(rpc, requestOptions);

        let lastError: unknown;
        for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
            try {
                const response = await this.driver.sendRequest(request);
                return await this.driver.handleResponse(rpc, response);
            } catch (error) {
                lastError = error;

                // Check if we should retry
                if (
                    attempt < retryConfig.maxAttempts &&
                    retryConfig.isRetryable(error)
                ) {
                    Logger.warn(
                        LogCategory.Rpc,
                        'RPC %s failed %s (attempt %d/%d), retrying...',
                        procedureName,
                        error,
                        attempt,
                        retryConfig.maxAttempts,
                    );
                    await backoff(
                        attempt,
                        retryConfig.minBackoffMs,
                        retryConfig.maxBackoffMs,
                        retryConfig.jitter,
                    );
                } else {
                    // Either max attempts reached or error is not retryable
                    break;
                }
            }
        }

        Logger.error(
            LogCategory.Rpc,
            'RPC %s failed after %d attempts. %s',
            procedureName,
            retryConfig.maxAttempts,
            lastError,
        );
        throw lastError;
    }
}

/**
 * Trap for intercepting calls to the CallOptionsBuilder.
 * If the property exists on the builder, it will return it.
 * Otherwise it will return a function that will call the
 * remote procedure using the client and the options.
 */
class RpcCallOptionsTrap<RpcInterface extends object> {
    constructor(private readonly client: RpcClient<RpcInterface>) {}

    /**
     * The trap function that intercepts all property calls on the builder.
     *
     * @param target
     * @param property
     * @param receiver
     * @returns
     */
    get(target: RpcCallOptions, property: string | symbol): unknown {
        const propertyString = property.toString();
        // return the property if it exists on the target,
        if (propertyString in target) {
            return (target as any)[propertyString];
        } else if (propertyString === 'then') {
            // promise chaining from an await will cause a then call
            // we need to return undefined to avoid the RPC call
            return undefined;
        } else {
            // otherwise return a function that will call the
            // remote procedure using the client and the options
            return async (...args: any[]) => {
                const result = await this.client.callProcedure(
                    // we have to case the property because typescript does not know
                    // that the property is a valid RPC method name
                    propertyString as any,
                    // we have to cast the args because typescript does not know
                    // that the args are the correct type for the RPC method
                    args as any,
                    target,
                );
                if (isRpcFailureResponse(result)) {
                    throw new RpcError(result);
                }
                return result.result;
            };
        }
    }
}

/**
 * Keys whose values are call‑signatures
 */
type RpcMethodKey<T> = {
    [K in keyof T]-?: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * For one of those keys, extract its parameter list (as a tuple)
 */
type RpcMethodParams<T, K extends RpcMethodKey<T>> = T[K] extends (
    ...args: infer P
) => any
    ? P
    : never;

// Transient network-failure messages differ per runtime — the fetch spec
// doesn't standardize them — so match all the major ones, not just workerd's
// and Chrome's. Compared lower-cased.
const RETRYABLE_NETWORK_ERROR_PATTERNS = [
    'network connection lost', // workerd: "Network connection lost."
    'failed to fetch', // Chrome / Chromium
    'fetch failed', // Node / undici
    'networkerror', // Firefox: "NetworkError when attempting to fetch resource."
    'load failed', // Safari
    'the network connection was lost', // iOS / Safari
    'network request failed', // React Native and others
];

// Node surfaces the transport failure as an errno code on the error's cause.
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
]);

/**
 * Default function to determine if an error is retryable.
 * Retries on transient network errors and 502/503 responses.
 */
export function defaultIsRetryable(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
            RETRYABLE_NETWORK_ERROR_PATTERNS.some((pattern) =>
                message.includes(pattern),
            )
        ) {
            return true;
        }
        // Node/undici wrap the underlying socket error (with its errno code)
        // in the fetch error's `cause`.
        const cause = (error as { cause?: unknown }).cause;
        if (cause && typeof cause === 'object') {
            const code = (cause as { code?: unknown }).code;
            if (
                typeof code === 'string' &&
                RETRYABLE_NETWORK_ERROR_CODES.has(code)
            ) {
                return true;
            }
        }
    }

    // Check for HTTP status codes if available. The client throws HttpError
    // for HTTP failures, whose property is `statusCode`; also tolerate a
    // foreign `status` for non-HttpError shapes.
    if (typeof error === 'object' && error !== null) {
        const status =
            (error as { statusCode?: unknown }).statusCode ??
            (error as { status?: unknown }).status;
        // Retry on 503 Service Unavailable or 502 Bad Gateway
        return status === 502 || status === 503;
    }

    return false;
}
