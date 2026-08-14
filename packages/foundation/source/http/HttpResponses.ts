// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    HttpRedirectStatusCode,
    HttpStatus,
    HttpStatusCode,
} from '@system-inc/base-common/http/HttpStatus';
import { BaseError } from '../error/BaseError';

/**
 * Class for creating common HTTP responses.
 */
export class HttpResponses {
    /**
     * Creates a empty response with status 200 OK.
     *
     * This is used to signal a successful request or server processing to the
     * client when no response body is required, desired or necessary.
     *
     * @param responseInit
     * @returns
     */
    static ok(responseInit?: ResponseInit): Response {
        return new Response(null, {
            ...responseInit,
            status: HttpStatusCode.Ok,
            statusText: HttpStatus.getStatusInfo(HttpStatusCode.Ok).message,
        });
    }

    /**
     * Creates a status 204 No Content with null response body (required for no-content).
     *
     * @param responseInit
     * @returns
     */
    static noContent(responseInit?: ResponseInit): Response {
        return new Response(null, {
            ...responseInit,
            status: HttpStatusCode.NoContent,
            statusText: HttpStatus.getStatusInfo(HttpStatusCode.NoContent)
                .message,
        });
    }

    /**
     * Creates a redirect Response.
     *
     * @param url The URL to redirect to
     * @param status The HTTP redirect status code (default: 303 See Other)
     * @returns
     */
    static redirect(
        url: string | URL,
        status: HttpRedirectStatusCode = HttpRedirectStatusCode.SeeOther,
    ): Response {
        // Build the redirect with an ordinary (mutable) Response rather than
        // Response.redirect(), whose headers are immutable — otherwise cookies
        // and headers set by the handler (via ResponseWriter) can't be applied
        // to the redirect and are silently dropped.
        return new Response(null, {
            status: status,
            headers: { location: url.toString() },
        });
    }

    /**
     * Creates a Response from a JSON object.
     *
     * @param json The JSON object to include in the response body
     * @param responseInit The response initialization options
     * @returns
     */
    static fromJson(json: unknown, responseInit?: ResponseInit): Response {
        return Response.json(json, responseInit);
    }

    /**
     * Creates a Response from a BaseError.
     *
     * This response will be the same as if the BaseError was thrown,
     * however it will not produce a stack trace in the logs, indicating
     * that this was an expected error condition, which may be desired.
     *
     * @param error The BaseError instance
     * @param responseInit Response initialization options
     * @returns
     */
    static fromError(error: BaseError, responseInit?: ResponseInit): Response {
        return Response.json(error, {
            ...responseInit,
            status: error.statusCode,
            statusText: HttpStatus.getMessage(error.statusCode),
        });
    }
}
