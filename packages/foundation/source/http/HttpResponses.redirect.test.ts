// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HTTP_HEADER_SET_COOKIE } from '@system-inc/base-common/http/HttpHeaders';
import { HttpRedirectStatusCode } from '@system-inc/base-common/http/HttpStatus';
import { ResponseBuilder } from '../internal/request/ResponseBuilder';
import { HttpResponses } from './HttpResponses';

describe('HttpResponses.redirect', () => {
    it('defaults to 303 with a Location header', () => {
        const response = HttpResponses.redirect('/login');
        expect(response.status).toBe(303);
        expect(response.headers.get('location')).toBe('/login');
    });

    it('produces a mutable response so handler cookies/headers survive the redirect', () => {
        const response = HttpResponses.redirect(
            '/dashboard',
            HttpRedirectStatusCode.SeeOther,
        );

        // a handler sets a cookie + header via the ResponseWriter, then returns
        // the redirect; applyToResponse must be able to write them
        const builder = new ResponseBuilder();
        builder.setCookie({ name: 'session', value: 'abc' });
        builder.appendHeader('x-custom', 'yes');

        expect(() => builder.applyToResponse(response)).not.toThrow();

        expect(response.headers.get(HTTP_HEADER_SET_COOKIE)).toContain(
            'session=abc',
        );
        expect(response.headers.get('x-custom')).toBe('yes');
    });
});
