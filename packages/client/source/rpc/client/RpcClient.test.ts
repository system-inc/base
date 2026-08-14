// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpError } from '../../error/HttpError';
import { defaultIsRetryable } from './RpcClient';

describe('defaultIsRetryable', () => {
    it('retries on 502/503 HttpError (which exposes statusCode, not status)', () => {
        expect(
            defaultIsRetryable(new HttpError(503, 'Service Unavailable')),
        ).toBe(true);
        expect(defaultIsRetryable(new HttpError(502, 'Bad Gateway'))).toBe(
            true,
        );
    });

    it('does not retry other HTTP statuses', () => {
        expect(defaultIsRetryable(new HttpError(500, 'Internal Error'))).toBe(
            false,
        );
        expect(defaultIsRetryable(new HttpError(404, 'Not Found'))).toBe(false);
    });

    it('retries transient network errors across runtimes', () => {
        // workerd + Chrome (already handled)
        expect(defaultIsRetryable(new Error('Network connection lost.'))).toBe(
            true,
        );
        expect(defaultIsRetryable(new Error('Failed to fetch'))).toBe(true);
        // Node/undici, Firefox, Safari
        expect(defaultIsRetryable(new TypeError('fetch failed'))).toBe(true);
        expect(
            defaultIsRetryable(
                new TypeError(
                    'NetworkError when attempting to fetch resource.',
                ),
            ),
        ).toBe(true);
        expect(defaultIsRetryable(new TypeError('Load failed'))).toBe(true);
    });

    it('retries when a Node errno code is on the error cause', () => {
        // set cause post-construction — the Error(message, {cause}) overload
        // isn't in this package's TS lib target
        const error = new TypeError('the request failed');
        (error as { cause?: unknown }).cause = { code: 'ECONNRESET' };
        expect(defaultIsRetryable(error)).toBe(true);
    });

    it('tolerates a foreign `status` property', () => {
        expect(defaultIsRetryable({ status: 503 })).toBe(true);
    });

    it('does not retry unrelated errors', () => {
        expect(defaultIsRetryable(new Error('boom'))).toBe(false);
        expect(defaultIsRetryable(null)).toBe(false);
        expect(defaultIsRetryable(undefined)).toBe(false);
    });
});
