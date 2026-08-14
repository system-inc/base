// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { cfPrepareRequest } from './CloudflareRequest';

describe('CloudflareRequest', () => {
    describe('cfPrepareRequest', () => {
        let consoleSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        test('should remove cache property and warn by default', () => {
            const request: RequestInit = {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-cache',
                body: JSON.stringify({ test: 'data' }),
            };

            const result = cfPrepareRequest(request);

            expect(result).not.toHaveProperty('cache');
            expect(result.method).toBe('GET');
            expect(result.headers).toBeInstanceOf(Headers);
            expect((result.headers as Headers).get('Content-Type')).toBe(
                'application/json',
            );
            expect(result.body).toBe(JSON.stringify({ test: 'data' }));
            expect(consoleSpy).toHaveBeenCalledWith(
                '[common] Unsupported `%s` fetch option used in Cloudflare Workers; removed.',
                'cache',
            );
        });

        test('should remove credentials property and warn by default', () => {
            const request: RequestInit = {
                method: 'POST',
                credentials: 'include',
                body: 'test data',
            };

            const result = cfPrepareRequest(request);

            expect(result).not.toHaveProperty('credentials');
            expect(result.method).toBe('POST');
            expect(result.body).toBe('test data');
            expect(consoleSpy).toHaveBeenCalledWith(
                '[common] Unsupported `%s` fetch option used in Cloudflare Workers; removed.',
                'credentials',
            );
        });

        test('should remove mode property and warn by default', () => {
            const request: RequestInit = {
                method: 'PUT',
                mode: 'cors',
                headers: { Authorization: 'Bearer token' },
            };

            const result = cfPrepareRequest(request);

            expect(result).not.toHaveProperty('mode');
            expect(result.method).toBe('PUT');
            expect(result.headers).toBeInstanceOf(Headers);
            expect((result.headers as Headers).get('Authorization')).toBe(
                'Bearer token',
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                '[common] Unsupported `%s` fetch option used in Cloudflare Workers; removed.',
                'mode',
            );
        });

        test('should remove all unsupported properties and warn for each', () => {
            const request: RequestInit = {
                method: 'DELETE',
                cache: 'default',
                credentials: 'same-origin',
                mode: 'no-cors',
                headers: { 'X-Custom': 'header' },
            };

            const result = cfPrepareRequest(request);

            expect(result).not.toHaveProperty('cache');
            expect(result).not.toHaveProperty('credentials');
            expect(result).not.toHaveProperty('mode');
            expect(result.method).toBe('DELETE');
            expect(result.headers).toBeInstanceOf(Headers);
            expect((result.headers as Headers).get('X-Custom')).toBe('header');

            expect(consoleSpy).toHaveBeenCalledTimes(3);
            expect(consoleSpy).toHaveBeenCalledWith(
                '[common] Unsupported `%s` fetch option used in Cloudflare Workers; removed.',
                'cache',
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                '[common] Unsupported `%s` fetch option used in Cloudflare Workers; removed.',
                'credentials',
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                '[common] Unsupported `%s` fetch option used in Cloudflare Workers; removed.',
                'mode',
            );
        });

        test('should not warn when warn parameter is false', () => {
            const request: RequestInit = {
                method: 'GET',
                cache: 'no-cache',
                credentials: 'include',
                mode: 'cors',
            };

            const result = cfPrepareRequest(request, false);

            expect(result).not.toHaveProperty('cache');
            expect(result).not.toHaveProperty('credentials');
            expect(result).not.toHaveProperty('mode');
            expect(result.method).toBe('GET');
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        test('should return request unchanged when no unsupported properties exist', () => {
            const request: RequestInit = {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ update: 'data' }),
            };

            const result = cfPrepareRequest(request);

            // Function always creates new object with Headers instance
            expect(result.method).toBe('PATCH');
            expect(result.body).toBe(JSON.stringify({ update: 'data' }));
            expect(result.headers).toBeInstanceOf(Headers);
            expect((result.headers as Headers).get('Content-Type')).toBe(
                'application/json',
            );
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        test('should handle empty request object', () => {
            const request: RequestInit = {};

            const result = cfPrepareRequest(request);

            // Function always creates object with all supported fields (even undefined)
            expect(result.method).toBeUndefined();
            expect(result.body).toBeUndefined();
            expect(result.headers).toBeUndefined();
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        test('should handle request with only supported properties', () => {
            const request: RequestInit = {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'test-agent',
                },
                body: null,
                signal: new AbortController().signal,
            };

            const result = cfPrepareRequest(request);

            expect(result.method).toBe('GET');
            expect(result.headers).toBeInstanceOf(Headers);
            expect((result.headers as Headers).get('Accept')).toBe(
                'application/json',
            );
            expect((result.headers as Headers).get('User-Agent')).toBe(
                'test-agent',
            );
            expect(result.body).toBeNull();
            expect(result.signal).toBeDefined();
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        test('should not modify original request object', () => {
            const request: RequestInit = {
                method: 'POST',
                cache: 'force-cache',
                body: 'test',
            };

            const result = cfPrepareRequest(request);

            // Verify the original request object was NOT modified
            expect(request).toHaveProperty('cache');
            expect(request.cache).toBe('force-cache');
            expect(request.method).toBe('POST');
            expect(request.body).toBe('test');

            // Result should not have cache
            expect(result).not.toHaveProperty('cache');
        });

        test('should not warn for properties with undefined values', () => {
            const request: RequestInit = {
                method: 'GET',
                cache: undefined,
                credentials: undefined,
                mode: undefined,
            };

            const result = cfPrepareRequest(request);

            // Undefined properties don't trigger warnings (only truthy values)
            expect(result).not.toHaveProperty('cache');
            expect(result).not.toHaveProperty('credentials');
            expect(result).not.toHaveProperty('mode');
            expect(result.method).toBe('GET');
            expect(consoleSpy).not.toHaveBeenCalled();
        });

        test('carries Cloudflare-specific init members (cf, duplex) through', () => {
            const request = {
                method: 'POST',
                body: 'stream',
                duplex: 'half',
                cf: { cacheEverything: true, cacheTtl: 60 },
                cache: 'no-store',
            } as unknown as RequestInit;

            const result = cfPrepareRequest(request, false) as Record<
                string,
                unknown
            >;

            // cf and duplex are preserved...
            expect(result.duplex).toBe('half');
            expect(result.cf).toEqual({ cacheEverything: true, cacheTtl: 60 });
            // ...while the unsupported cache option is still dropped
            expect(result).not.toHaveProperty('cache');
        });
    });
});
