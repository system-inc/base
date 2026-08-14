// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { BaseError } from '../../error/BaseError';
import { BaseRequest } from '../request/BaseRequest';
import { BaseRouter, shouldSkipCorsHeaders } from './BaseRouter';

// resolvePrimitiveParameter is pure (no router/config state), so a bare
// instance is enough to exercise HTTP primitive-parameter coercion.
const router = new BaseRouter({} as never, {} as unknown as BaseConfiguration);

function resolve(type: unknown, rawValue: unknown, name = 'p'): unknown {
    return (
        router as unknown as {
            resolvePrimitiveParameter: (
                type: unknown,
                rawValue: unknown,
                name: string,
            ) => unknown;
        }
    ).resolvePrimitiveParameter(type, rawValue, name);
}

describe('BaseRouter.resolvePrimitiveParameter', () => {
    describe('Boolean', () => {
        it('parses string booleans by value, not truthiness', () => {
            expect(resolve(Boolean, 'true')).toBe(true);
            expect(resolve(Boolean, '1')).toBe(true);
            expect(resolve(Boolean, 'false')).toBe(false);
            expect(resolve(Boolean, '0')).toBe(false);
            expect(resolve(Boolean, '')).toBe(false);
        });

        it('rejects a non-boolean string', () => {
            expect(() => resolve(Boolean, 'yes')).toThrow(BaseError);
        });
    });

    describe('missing values', () => {
        it('rejects an absent value rather than fabricating one', () => {
            expect(() => resolve(String, undefined)).toThrow(BaseError);
            expect(() => resolve(String, null)).toThrow(BaseError);
            expect(() => resolve(Number, undefined)).toThrow(BaseError);
            expect(() => resolve(Boolean, undefined)).toThrow(BaseError);
        });
    });

    describe('String', () => {
        it('accepts an empty string as a valid value', () => {
            expect(resolve(String, '')).toBe('');
        });

        it('passes through a normal string', () => {
            expect(resolve(String, 'hello')).toBe('hello');
        });
    });

    describe('Number', () => {
        it('parses numeric strings, including zero', () => {
            expect(resolve(Number, '42')).toBe(42);
            expect(resolve(Number, '0')).toBe(0);
        });

        it('rejects empty and non-numeric strings', () => {
            expect(() => resolve(Number, '')).toThrow(BaseError);
            expect(() => resolve(Number, '   ')).toThrow(BaseError);
            expect(() => resolve(Number, 'abc')).toThrow(BaseError);
        });
    });

    describe('parseJsonBody', () => {
        function parseBody(request: unknown): Promise<unknown> {
            return (
                router as unknown as {
                    parseJsonBody: (request: BaseRequest) => Promise<unknown>;
                }
            ).parseJsonBody(request as BaseRequest);
        }

        it('returns the parsed JSON for a valid body', async () => {
            const request = { json: () => Promise.resolve({ a: 1 }) };
            await expect(parseBody(request)).resolves.toEqual({ a: 1 });
        });

        it('throws a 400 (not a 500) for a malformed or empty JSON body', async () => {
            const request = {
                json: () => Promise.reject(new SyntaxError('Unexpected end')),
            };
            let caught: unknown;
            try {
                await parseBody(request);
            } catch (error) {
                caught = error;
            }
            expect(caught).toBeInstanceOf(BaseError);
            expect((caught as BaseError).statusCode).toBe(400);
        });
    });

    describe('shouldSkipCorsHeaders', () => {
        it('skips CORS for WebSocket upgrade requests', () => {
            const request = new Request('http://x', {
                headers: { upgrade: 'websocket' },
            });
            expect(shouldSkipCorsHeaders(request, new Response(null))).toBe(
                true,
            );
        });

        it('does NOT skip CORS for a 303 redirect', () => {
            const request = new Request('http://x');
            const redirect = new Response(null, { status: 303 });
            expect(shouldSkipCorsHeaders(request, redirect)).toBe(false);
        });

        it('does not skip CORS for a normal response', () => {
            const request = new Request('http://x');
            expect(shouldSkipCorsHeaders(request, new Response(null))).toBe(
                false,
            );
        });
    });
});
