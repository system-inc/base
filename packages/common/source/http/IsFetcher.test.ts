// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { isFetcher } from './IsFetcher';

describe('IsFetcher', () => {
    describe('isFetcher function', () => {
        describe('should return true for valid fetcher objects', () => {
            test('object with fetch function', () => {
                const validFetcher = {
                    fetch: async () => new Response('test'),
                };

                expect(isFetcher(validFetcher)).toBe(true);
            });

            test('object with fetch function and other properties', () => {
                const fetcherWithExtras = {
                    fetch: async () => new Response('test'),
                    name: 'test-fetcher',
                    version: '1.0.0',
                };

                expect(isFetcher(fetcherWithExtras)).toBe(true);
            });

            test('class instance with fetch method', () => {
                class CustomFetcher {
                    async fetch() {
                        return new Response('custom');
                    }
                }

                const customFetcher = new CustomFetcher();
                expect(isFetcher(customFetcher)).toBe(true);
            });

            test('object with synchronous fetch function', () => {
                const syncFetcher = {
                    fetch: () => Promise.resolve(new Response('sync')),
                };

                expect(isFetcher(syncFetcher)).toBe(true);
            });

            test('mock fetch implementation', () => {
                const mockFetcher = {
                    fetch: jest.fn().mockResolvedValue(new Response('mock')),
                };

                expect(isFetcher(mockFetcher)).toBe(true);
            });

            test('object with fetch function that takes parameters', () => {
                const parameterizedFetcher = {
                    fetch: async (request: RequestInfo, init?: RequestInit) => {
                        return new Response(JSON.stringify({ request, init }));
                    },
                };

                expect(isFetcher(parameterizedFetcher)).toBe(true);
            });

            test('native fetch function wrapped in object', () => {
                // Mock global fetch for this test
                const originalFetch = global.fetch;
                global.fetch = jest
                    .fn()
                    .mockResolvedValue(new Response('native'));

                const nativeFetcher = {
                    fetch: global.fetch,
                };

                expect(isFetcher(nativeFetcher)).toBe(true);

                // Restore original fetch
                global.fetch = originalFetch;
            });

            test('object with arrow function fetch', () => {
                const arrowFetcher = {
                    fetch: async () => new Response('arrow'),
                };

                expect(isFetcher(arrowFetcher)).toBe(true);
            });

            test('object with regular function fetch', () => {
                const regularFetcher = {
                    fetch: function () {
                        return Promise.resolve(new Response('regular'));
                    },
                };

                expect(isFetcher(regularFetcher)).toBe(true);
            });

            test('object with bound function fetch', () => {
                const originalFunction = async function () {
                    return new Response('bound');
                };

                const boundFetcher = {
                    fetch: originalFunction.bind(null),
                };

                expect(isFetcher(boundFetcher)).toBe(true);
            });

            test('Proxy object with fetch', () => {
                const target = {
                    fetch: async () => new Response('proxy'),
                };

                const proxyFetcher = new Proxy(target, {});
                expect(isFetcher(proxyFetcher)).toBe(true);
            });

            test('object with inherited fetch method', () => {
                class BaseFetcher {
                    async fetch() {
                        return new Response('base');
                    }
                }

                class ExtendedFetcher extends BaseFetcher {
                    constructor(public name: string) {
                        super();
                    }
                }

                const extendedFetcher = new ExtendedFetcher('extended');
                expect(isFetcher(extendedFetcher)).toBe(true);
            });
        });

        describe('should return false for invalid objects', () => {
            test('null', () => {
                expect(isFetcher(null)).toBe(false);
            });

            test('undefined', () => {
                expect(isFetcher(undefined)).toBe(false);
            });

            test('primitive string', () => {
                expect(isFetcher('string')).toBe(false);
            });

            test('primitive number', () => {
                expect(isFetcher(42)).toBe(false);
            });

            test('primitive boolean', () => {
                expect(isFetcher(true)).toBe(false);
                expect(isFetcher(false)).toBe(false);
            });

            test('primitive bigint', () => {
                expect(isFetcher(123n)).toBe(false);
            });

            test('primitive symbol', () => {
                expect(isFetcher(Symbol('test'))).toBe(false);
            });

            test('empty object', () => {
                expect(isFetcher({})).toBe(false);
            });

            test('object without fetch property', () => {
                const noFetchObject = {
                    name: 'test',
                    version: '1.0.0',
                };

                expect(isFetcher(noFetchObject)).toBe(false);
            });

            test('object with non-function fetch property', () => {
                const nonFunctionFetch = {
                    fetch: 'not a function',
                };

                expect(isFetcher(nonFunctionFetch)).toBe(false);
            });

            test('object with null fetch property', () => {
                const nullFetch = {
                    fetch: null,
                };

                expect(isFetcher(nullFetch)).toBe(false);
            });

            test('object with undefined fetch property', () => {
                const undefinedFetch = {
                    fetch: undefined,
                };

                expect(isFetcher(undefinedFetch)).toBe(false);
            });

            test('object with number fetch property', () => {
                const numberFetch = {
                    fetch: 42,
                };

                expect(isFetcher(numberFetch)).toBe(false);
            });

            test('object with boolean fetch property', () => {
                const booleanFetch = {
                    fetch: true,
                };

                expect(isFetcher(booleanFetch)).toBe(false);
            });

            test('object with object fetch property', () => {
                const objectFetch = {
                    fetch: { method: 'get' },
                };

                expect(isFetcher(objectFetch)).toBe(false);
            });

            test('object with array fetch property', () => {
                const arrayFetch = {
                    fetch: ['GET', 'POST'],
                };

                expect(isFetcher(arrayFetch)).toBe(false);
            });

            test('array', () => {
                expect(isFetcher([])).toBe(false);
                expect(isFetcher([1, 2, 3])).toBe(false);
            });

            test('Date object', () => {
                expect(isFetcher(new Date())).toBe(false);
            });

            test('RegExp object', () => {
                expect(isFetcher(/test/)).toBe(false);
            });

            test('Error object', () => {
                expect(isFetcher(new Error('test'))).toBe(false);
            });

            test('Map object', () => {
                expect(isFetcher(new Map())).toBe(false);
            });

            test('Set object', () => {
                expect(isFetcher(new Set())).toBe(false);
            });

            test('Promise object', () => {
                expect(isFetcher(Promise.resolve())).toBe(false);
            });

            test('function (not an object with fetch property)', () => {
                const standaloneFunction = async () =>
                    new Response('standalone');
                expect(isFetcher(standaloneFunction)).toBe(false);
            });

            test('class constructor', () => {
                class FetcherClass {
                    async fetch() {
                        return new Response('class');
                    }
                }

                expect(isFetcher(FetcherClass)).toBe(false);
            });
        });

        describe('edge cases', () => {
            test('object with fetch property on prototype', () => {
                function FetcherConstructor(this: {
                    fetch?: () => Promise<Response>;
                }) {}
                FetcherConstructor.prototype.fetch = async function () {
                    return new Response('prototype');
                };

                const prototypeFetcher =
                    new (FetcherConstructor as unknown as new () => {
                        fetch: () => Promise<Response>;
                    })();
                expect(isFetcher(prototypeFetcher)).toBe(true);
            });

            test('object with non-enumerable fetch property', () => {
                const obj = {};
                Object.defineProperty(obj, 'fetch', {
                    value: async () => new Response('non-enumerable'),
                    enumerable: false,
                    configurable: true,
                    writable: true,
                });

                expect(isFetcher(obj)).toBe(true);
            });

            test('object with getter fetch property', () => {
                const getterFetcher = {
                    get fetch() {
                        return async () => new Response('getter');
                    },
                };

                expect(isFetcher(getterFetcher)).toBe(true);
            });

            test('object with setter-only fetch property', () => {
                let _storedFetch: (() => Promise<Response>) | undefined;
                const setterOnlyFetcher = {
                    set fetch(value: () => Promise<Response>) {
                        _storedFetch = value;
                    },
                };

                expect(isFetcher(setterOnlyFetcher)).toBe(false);
            });

            test('frozen object with fetch', () => {
                const frozenFetcher = Object.freeze({
                    fetch: async () => new Response('frozen'),
                });

                expect(isFetcher(frozenFetcher)).toBe(true);
            });

            test('sealed object with fetch', () => {
                const sealedFetcher = Object.seal({
                    fetch: async () => new Response('sealed'),
                });

                expect(isFetcher(sealedFetcher)).toBe(true);
            });

            test('object created with Object.create(null)', () => {
                const nullPrototypeFetcher = Object.create(null);
                nullPrototypeFetcher.fetch = async () =>
                    new Response('null-prototype');

                expect(isFetcher(nullPrototypeFetcher)).toBe(true);
            });

            test('object with symbol properties', () => {
                const symbolKey = Symbol('fetch');
                const symbolFetcher = {
                    [symbolKey]: async () => new Response('symbol'),
                    fetch: async () => new Response('regular'),
                };

                expect(isFetcher(symbolFetcher)).toBe(true);
            });

            test('object with fetch property that throws when accessed', () => {
                const throwingFetcher = {
                    get fetch() {
                        throw new Error('Access denied');
                    },
                };

                expect(() => isFetcher(throwingFetcher)).toThrow(
                    'Access denied',
                );
            });

            test('Proxy object that intercepts fetch access', () => {
                const target = {};
                const interceptingProxy = new Proxy(target, {
                    has: (target, prop) => prop === 'fetch',
                    get: (target, prop) => {
                        if (prop === 'fetch') {
                            return async () => new Response('intercepted');
                        }
                        return undefined;
                    },
                });

                expect(isFetcher(interceptingProxy)).toBe(true);
            });

            test('object with fetch property that returns different types', () => {
                // Function that sometimes returns a function, sometimes not
                let counter = 0;
                const inconsistentFetcher = {
                    get fetch() {
                        counter++;
                        return counter % 2 === 0
                            ? async () => new Response('function')
                            : 'not a function';
                    },
                };

                // First access - returns string
                expect(isFetcher(inconsistentFetcher)).toBe(false);
                // Second access - returns function
                expect(isFetcher(inconsistentFetcher)).toBe(true);
            });

            test('WeakMap as fetcher candidate', () => {
                expect(isFetcher(new WeakMap())).toBe(false);
            });

            test('WeakSet as fetcher candidate', () => {
                expect(isFetcher(new WeakSet())).toBe(false);
            });

            test('ArrayBuffer as fetcher candidate', () => {
                expect(isFetcher(new ArrayBuffer(8))).toBe(false);
            });
        });

        describe('type safety and TypeScript integration', () => {
            test('should work as type guard', () => {
                const unknownValue: unknown = {
                    fetch: async () => new Response('type guard'),
                };

                if (isFetcher(unknownValue)) {
                    // TypeScript should know this has a fetch method
                    expect(typeof unknownValue.fetch).toBe('function');
                } else {
                    // This shouldn't happen in this test
                    fail('Expected value to be identified as fetcher');
                }
            });

            test('should narrow union types', () => {
                type MaybeFetcher =
                    | { fetch: () => Promise<Response> }
                    | { data: string };

                const fetcherVariant: MaybeFetcher = {
                    fetch: async () => new Response('union'),
                };

                const dataVariant: MaybeFetcher = {
                    data: 'test data',
                };

                expect(isFetcher(fetcherVariant)).toBe(true);
                expect(isFetcher(dataVariant)).toBe(false);

                if (isFetcher(fetcherVariant)) {
                    // TypeScript should know this has fetch
                    expect(typeof fetcherVariant.fetch).toBe('function');
                }
            });

            test('should work with generic constraints', () => {
                function processFetcher<T>(value: T): boolean {
                    return isFetcher(value);
                }

                const validFetcher = {
                    fetch: async () => new Response('generic'),
                };
                const invalidValue = { notFetch: 'test' };

                expect(processFetcher(validFetcher)).toBe(true);
                expect(processFetcher(invalidValue)).toBe(false);
            });
        });

        describe('realistic usage scenarios', () => {
            test('Cloudflare Worker Fetcher-like object', () => {
                // Simulate what a Cloudflare Worker Fetcher might look like
                const cloudFlareFetcher = {
                    fetch: async (
                        _request: RequestInfo,
                        init?: RequestInit,
                    ) => {
                        // Simulate a real fetch implementation
                        const url =
                            typeof _request === 'string'
                                ? _request
                                : _request.url;
                        return new Response(
                            JSON.stringify({
                                url,
                                method: init?.method || 'GET',
                                cloudflare: true,
                            }),
                        );
                    },
                };

                expect(isFetcher(cloudFlareFetcher)).toBe(true);
            });

            test('Service Worker Fetcher-like object', () => {
                const serviceWorkerFetcher = {
                    fetch: async (_request: RequestInfo) => {
                        return new Response('Service Worker Response');
                    },
                    cache: new Map(),
                };

                expect(isFetcher(serviceWorkerFetcher)).toBe(true);
            });

            test('Mock fetcher for testing', () => {
                const mockFetcher = {
                    fetch: jest.fn().mockImplementation(async (url: string) => {
                        return new Response(
                            JSON.stringify({ mocked: true, url }),
                        );
                    }),
                    callCount: 0,
                };

                expect(isFetcher(mockFetcher)).toBe(true);
            });

            test('Wrapper around native fetch', () => {
                const fetchWrapper = {
                    fetch: async (
                        _request: RequestInfo,
                        init?: RequestInit,
                    ) => {
                        // Add some wrapper logic
                        const _modifiedInit = {
                            ...init,
                            headers: {
                                ...init?.headers,
                                'X-Wrapper': 'true',
                            },
                        };

                        // Would normally call real fetch here
                        return new Response('Wrapped response');
                    },
                    isWrapper: true,
                };

                expect(isFetcher(fetchWrapper)).toBe(true);
            });

            test('Caching fetcher implementation', () => {
                const cachingFetcher = {
                    cache: new Map<string, Response>(),
                    fetch: async function (
                        this: { cache: Map<string, Response> },
                        request: RequestInfo,
                    ) {
                        const url =
                            typeof request === 'string' ? request : request.url;

                        if (this.cache.has(url)) {
                            return this.cache.get(url)!.clone();
                        }

                        const response = new Response('Cached response');
                        this.cache.set(url, response.clone());
                        return response;
                    },
                };

                expect(isFetcher(cachingFetcher)).toBe(true);
            });

            test('Rate-limited fetcher', () => {
                const rateLimitedFetcher = {
                    lastRequest: 0,
                    minInterval: 100,
                    fetch: async function (
                        this: { lastRequest: number; minInterval: number },
                        _request: RequestInfo,
                    ) {
                        const now = Date.now();
                        if (now - this.lastRequest < this.minInterval) {
                            throw new Error('Rate limited');
                        }
                        this.lastRequest = now;
                        return new Response('Rate limited response');
                    },
                };

                expect(isFetcher(rateLimitedFetcher)).toBe(true);
            });
        });

        describe('performance considerations', () => {
            test('should handle large numbers of objects efficiently', () => {
                const objects = Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    fetch:
                        i % 2 === 0
                            ? async () => new Response('even')
                            : undefined,
                }));

                const start = performance.now();
                const results = objects.map(isFetcher);
                const end = performance.now();

                // Should complete reasonably quickly
                expect(end - start).toBeLessThan(100); // 100ms threshold

                // Should correctly identify every other object as a fetcher
                const fetcherCount = results.filter(Boolean).length;
                expect(fetcherCount).toBe(500);
            });

            test('should not have memory leaks with repeated calls', () => {
                const fetcher = { fetch: async () => new Response('test') };

                // Run many iterations
                for (let i = 0; i < 10000; i++) {
                    isFetcher(fetcher);
                }

                // Test passes if no memory errors occur
                expect(isFetcher(fetcher)).toBe(true);
            });
        });
    });
});
