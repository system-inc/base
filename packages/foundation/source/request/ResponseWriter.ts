// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SetCookieOptions } from '@system-inc/base-common/http/SetCookie';

/**
 *
 */
export interface ResponseWriter {
    /**
     *
     * @param cookieOptions
     */
    setCookie(cookieOptions: SetCookieOptions): void;

    /**
     *
     * @param name
     * @param value
     */
    appendHeader(name: string, value: string): void;
}
