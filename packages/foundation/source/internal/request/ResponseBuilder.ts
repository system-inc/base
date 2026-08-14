// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HTTP_HEADER_SET_COOKIE } from '@system-inc/base-common/http/HttpHeaders';
import {
    SetCookie,
    SetCookieOptions,
} from '@system-inc/base-common/http/SetCookie';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { ResponseWriter } from '../../request/ResponseWriter';

/**
 * The ResponseBuilder class represents aspects of the response that can be modified by the route handlers.
 * It is passed to the route handlers as part of the request object.
 */
export class ResponseBuilder implements ResponseWriter {
    readonly headers: Headers = new Headers();

    setCookie(cookieOptions: SetCookieOptions): void {
        const cookie = new SetCookie(cookieOptions).toString();
        this.headers.append(HTTP_HEADER_SET_COOKIE, cookie);
    }

    appendHeader(name: string, value: string): void {
        this.headers.append(name, value);
    }

    applyToResponse(response: Response): void {
        // sometimes the response headers are immutable, like in the case of the
        // worker forwarding a request to a durable object. In this case, we need to
        // catch the error and log it but continue on.
        try {
            for (const [name, value] of this.headers.entries()) {
                response.headers.append(name, value);
            }
        } catch (e) {
            Logger.warn(
                LogCategory.Http,
                'Error applying headers to response',
                e,
            );
        }
    }
}
