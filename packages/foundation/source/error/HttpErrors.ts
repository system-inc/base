// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    HttpStatus,
    HttpStatusCode,
} from '@system-inc/base-common/http/HttpStatus';
import { BaseError } from './BaseError';

/**
 * Options for creating HTTP errors.
 */
export interface HttpErrorOptions {
    /**
     * Custom error message. If not provided, a default
     * message based on the status code will be used.
     */
    message?: string;

    /**
     * Application-specific error code.
     */
    errorCode?: string;
}

/**
 * Class for Http error handling and creation.
 */
export class HttpErrors {
    /**
     * Creates StatusError: 400 Bad Request
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static badRequest(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(HttpStatusCode.BadRequest, options);
    }

    /**
     * Creates StatusError: 401 Unauthorized
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static unauthorized(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(HttpStatusCode.Unauthorized, options);
    }

    /**
     * Creates StatusError: 403 Forbidden
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static forbidden(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(HttpStatusCode.Forbidden, options);
    }

    /**
     * Creates StatusError: 404 Not Found
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static notFound(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(HttpStatusCode.NotFound, options);
    }

    /**
     * Creates StatusError: 405 Method Not Allowed
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static methodNotAllowed(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(HttpStatusCode.MethodNotAllowed, options);
    }

    /**
     * Creates StatusError: 409 Conflict
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static conflict(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(HttpStatusCode.Conflict, options);
    }

    /**
     * Creates StatusError: 500 Internal Server Error
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static internalServerError(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(
            HttpStatusCode.InternalServerError,
            options,
        );
    }

    /**
     * Creates StatusError: 501 Not Implemented
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static notImplemented(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(HttpStatusCode.NotImplemented, options);
    }

    /**
     * Creates StatusError: 422 Unprocessable Entity
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static unprocessableEntity(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(
            HttpStatusCode.UnprocessableEntity,
            options,
        );
    }

    /**
     * Creates StatusError: 426 Upgrade Required
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static upgradeRequired(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(HttpStatusCode.UpgradeRequired, options);
    }

    /**
     * Creates StatusError: 503 Service Unavailable
     *
     * @param options Optional error configuration
     * @returns StatusError
     */
    static serviceUnavailable(options?: HttpErrorOptions): BaseError {
        return HttpErrors.statusError(
            HttpStatusCode.ServiceUnavailable,
            options,
        );
    }

    /**
     * Creates a status error for any HTTP status code.
     *
     * @param statusCode HTTP status code
     * @param options Optional error configuration
     * @returns StatusError
     */
    static statusError(
        statusCode: HttpStatusCode,
        options?: HttpErrorOptions,
    ): BaseError {
        const message = options?.message ?? HttpStatus.getMessage(statusCode);
        return new BaseError(message, {
            errorCode: options?.errorCode,
            statusCode: statusCode,
        });
    }
}
