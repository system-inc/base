// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseErrorSerializer } from '@system-inc/base-common/error/BaseErrorSerializer';
import { BaseErrorData } from '@system-inc/base-common/error/interfaces/BaseErrorData';
import { HTTP_HEADER_CONTENT_TYPE } from '@system-inc/base-common/http/HttpHeaders';
import {
    isMediaTypeJson,
    isMediaTypeText,
} from '@system-inc/base-common/http/MediaType';

export class HttpError extends Error {
    /**
     * The HTTP headers of the response.
     */
    readonly headers: Record<string, string>;

    /**
     * The HTTP status code of the response.
     */
    readonly statusCode: number;

    /**
     * The cause of this error.
     */
    readonly cause?: BaseErrorData;

    constructor(
        statusCode: number,
        statusText: string,
        headers: Record<string, string> = {},
        cause?: BaseErrorData,
    ) {
        super(statusText);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.headers = headers;
        this.cause = cause;
    }
}

export function httpErrorFromJson(
    response: Response,
    body: unknown,
): HttpError {
    const headers: Record<string, string> = {};
    for (const [key, value] of response.headers.entries()) {
        headers[key.toLowerCase()] = value;
    }

    return new HttpError(
        response.status,
        response.statusText,
        headers,
        new BaseErrorSerializer(body).toClientErrorData(),
    );
}

export async function httpErrorFromResponse(
    response: Response,
): Promise<HttpError> {
    const headers: Record<string, string> = {};
    for (const [key, value] of response.headers.entries()) {
        headers[key.toLowerCase()] = value;
    }

    let cause: BaseErrorData | undefined = undefined;
    const mediaType = response.headers.get(HTTP_HEADER_CONTENT_TYPE) || '';
    if (isMediaTypeJson(mediaType)) {
        try {
            const responseJson = await response.json();
            cause = new BaseErrorSerializer(responseJson).error;
        } catch (error) {}
    } else if (isMediaTypeText(mediaType)) {
        try {
            const responseText = await response.text();
            cause = new BaseErrorSerializer(responseText).error;
        } catch (error) {}
    }

    return new HttpError(response.status, response.statusText, headers, cause);
}
