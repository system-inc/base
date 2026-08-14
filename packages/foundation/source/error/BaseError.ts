// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { StatusError } from 'itty-router';

import { BaseErrorSerializer } from '@system-inc/base-common/error/BaseErrorSerializer';
import { BaseErrorData } from '@system-inc/base-common/error/interfaces/BaseErrorData';
import { BaseErrorDataType } from '@system-inc/base-common/error/interfaces/BaseErrorDataType';
import {
    HttpStatus,
    HttpStatusCode,
} from '@system-inc/base-common/http/HttpStatus';
import { JsonObject } from '@system-inc/base-common/json/Json';

export type BaseErrorOptions = {
    /**
     * The name of the error type.
     */
    name?: string;

    /**
     * The HTTP status code associated with the error.
     */
    statusCode?: number;

    /**
     * The stack trace of the error.
     */
    stack?: string;

    /**
     * Application-specific error code for programmatic error handling.
     */
    errorCode?: string;

    /**
     * The underlying cause of the error.
     */
    cause?: unknown;

    /**
     * Any additional information related to the error.
     */
    extensions?: Readonly<JsonObject>;
};

/**
 * Base error class for all errors in a Base application.
 * Simply wraps the StatusError class from IttyRouter.
 */
export class BaseError extends Error {
    /**
     * Creates a BaseError from a message. Surfaces as a 500 error.
     *
     * @param message The error message.
     * @param options Error options such as `statusCode`, `errorCode`, or
     * `cause`.
     */
    static fromMessage(message: string, options?: BaseErrorOptions): BaseError {
        return new BaseError(message, options);
    }

    /**
     * Creates a BaseError from an HTTP status code.
     *
     * @param statusCode HTTP status code.
     * @param options Error options such as `errorCode` or `cause`.
     */
    static fromHttpStatus(
        statusCode: HttpStatusCode,
        options?: Omit<BaseErrorOptions, 'statusCode'>,
    ): BaseError {
        return new BaseError(HttpStatus.getMessage(statusCode), {
            ...options,
            statusCode: statusCode,
        });
    }

    /**
     * Creates a BaseError from error data.
     *
     * @param data
     * @returns
     */
    static fromErrorData(data: BaseErrorData): BaseError {
        return new BaseError(data.message, {
            name: data.name,
            statusCode: data.statusCode,
            stack: data.stack,
            errorCode: data.errorCode,
            extensions: data.extensions,
            cause: data.cause,
        });
    }

    /**
     * Creates a new BaseError from an error.
     * Surfaces as a 500 error if a status code was
     * not specified in the originating error.
     *
     * @param error The thrown value to coerce into a BaseError.
     */
    static normalize(error: unknown): BaseError {
        if (error instanceof BaseError) {
            return error;
        } else if (error instanceof StatusError) {
            // this shouldn't be thrown by Base application code anylonger,
            // but we leave it here for safety.
            return new BaseError(error.message, {
                name: error.name,
                statusCode: error.status,
                stack: error.stack,
            });
        } else if (error instanceof Error) {
            return new BaseError(error.message, {
                name: error.name,
                stack: error.stack,
            });
        }
        return BaseError.fromErrorData(new BaseErrorSerializer(error).error);
    }

    /**
     * Returns a client-safe BaseError. Authored 4xx errors pass through
     * unchanged so their message, errorCode, and extensions reach the client.
     * Anything else — plain Errors, 5xx BaseErrors, non-Error throws — is
     * substituted with a generic 500 so internal details (V8 messages,
     * stack traces, infrastructure errors) don't leak across the wire.
     *
     * Returns the original throw as `raw` so the caller can log it.
     *
     * Use this at transport boundaries (HTTP, RPC, GraphQL). For internal
     * paths that need the unmasked error (task retry, alerting), use
     * {@link normalize} instead.
     */
    static forClient(
        error: unknown,
        defaultMessage: string = 'Internal server error',
    ): { safe: BaseError; raw: unknown; masked: boolean } {
        const normalized = BaseError.normalize(error);
        if (normalized.statusCode < 500) {
            return { safe: normalized, raw: error, masked: false };
        }
        return {
            safe: new BaseError(defaultMessage, {
                name: 'InternalServerError',
                statusCode: HttpStatusCode.InternalServerError,
            }),
            raw: error,
            masked: true,
        };
    }

    /**
     * Runs a function and rethrows any error it throws as a BaseError
     * carrying the original message. Defaults to 422 (Unprocessable
     * Entity); callers can pass a different status (e.g. 400 for
     * malformed requests, 403 for policy rejection).
     *
     * Use at API boundaries (resolvers, RPC entry points) so that
     * failures from utilities — which conventionally throw plain `Error`
     * with a specific reason — surface as application-level errors with
     * a meaningful status, instead of generic 500s.
     *
     * @param fn The function to run.
     * @param statusCode HTTP status code for the rethrown error.
     * Defaults to 422 Unprocessable Entity.
     * @returns The function's return value, if it succeeds.
     */
    static wrap<T>(
        fn: () => T,
        statusCode: HttpStatusCode = HttpStatusCode.UnprocessableEntity,
    ): T {
        try {
            return fn();
        } catch (error) {
            throw BaseError.fromMessage(
                error instanceof Error ? error.message : 'Invalid input',
                { statusCode },
            );
        }
    }

    /**
     * The HTTP status code for this error.
     */
    readonly statusCode: HttpStatusCode;

    /**
     * Application-specific error code for programmatic error handling.
     * Examples: 'DEVICE_ID_REQUIRED', 'AUTH.TOKEN_EXPIRED'
     */
    readonly errorCode?: string;

    /**
     * The error that caused this error.
     */
    readonly cause?: BaseError;

    /**
     * A dictionary of additional information for this error.
     */
    readonly extensions?: Readonly<JsonObject>;

    constructor(message: string, options?: BaseErrorOptions) {
        super(message);

        // set the Error options

        if (options?.name) {
            this.name = options.name;
        } else {
            this.name = BaseError.name;
        }

        if (options?.stack) {
            this.stack = options.stack;
        }

        // set the BaseError options

        this.statusCode =
            options?.statusCode ?? HttpStatusCode.InternalServerError;

        this.errorCode = options?.errorCode;

        if (options?.cause) {
            const errorData = new BaseErrorSerializer(options.cause).error;
            this.cause = BaseError.fromErrorData(errorData);
        }

        this.extensions = options?.extensions;
    }

    override toString(): string {
        let output = `${this.name}: ${this.message}`;
        if (this.cause) {
            output += ` (Caused by: ${this.cause.name}: ${this.cause.message})`;
        }
        return output;
    }

    getSerializer(): BaseErrorSerializer {
        return new BaseErrorSerializer({
            message: this.message,
            name: this.name,
            statusCode: this.statusCode,
            errorCode: this.errorCode,
            cause: this.cause ? this.cause.getSerializer().toJSON() : undefined,
            extensions: this.extensions,
            stack: this.stack,
        });
    }

    /**
     * Serializes the error, with options for masking details.
     *
     * @returns Serialized error object safe for client consumption.
     */
    toJSON(): BaseErrorDataType {
        return this.getSerializer().toClientErrorData();
    }
}
