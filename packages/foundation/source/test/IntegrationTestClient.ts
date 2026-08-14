// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { GraphQLClient } from 'graphql-request';
import { WebSocket } from 'ws';

import { FetchRpcClientDriver } from '@system-inc/base-client/rpc/client/driver/FetchRpcClientDriver';
import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import {
    HTTP_HEADER_CONNECTION,
    HTTP_HEADER_SET_COOKIE,
} from '@system-inc/base-common/http/HttpHeaders';
import { OrmDatabase } from '../orm/database/OrmDatabase';
import { OrmEntityClass } from '../orm/entity/OrmEntityClass';
import { IntegrationTestEnvironment } from './IntegrationTestEnvironment';

/**
 * Integration test client for interacting with the server under test.
 *
 * Generic transport plumbing only — cookies, GraphQL/RPC/WebSocket
 * client construction, and a bare data source factory. Module-specific
 * helpers (e.g. account setup, device cookie management) live with the
 * modules that own them and wrap an instance of this class.
 */
export class IntegrationTestClient {
    private readonly cookieJar: Record<string, string> = {};

    constructor(readonly runtime: IntegrationTestEnvironment) {}

    getServerBaseUrl(): string {
        return this.buildUrl('');
    }

    testGqlUrl(): string {
        return this.buildUrl('/graphql');
    }

    testRpcUrl(): string {
        return this.buildUrl('/__rpc');
    }

    /**
     * Build a URL against the configured `host`. If the host already
     * has a scheme use it as-is. Otherwise default to `http://` for
     * local-dev compatability.
     */
    private buildUrl(path: string): string {
        const host = this.runtime.host;
        const base = /^https?:\/\//.test(host) ? host : 'http://' + host;
        return base + path;
    }

    getCookies(): Record<string, string> {
        return { ...this.cookieJar };
    }

    getCookieString(): string {
        return Object.entries(this.cookieJar)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
    }

    setCookie(name: string, value: string): void {
        this.cookieJar[name] = value;
    }

    setCookies(cookies: Record<string, string>): void {
        Object.entries(cookies).forEach(([name, value]) => {
            this.setCookie(name, value);
        });
    }

    removeCookie(name: string): void {
        delete this.cookieJar[name];
    }

    clearAllCookies(): void {
        Object.keys(this.cookieJar).forEach((name) => {
            delete this.cookieJar[name];
        });
    }

    getWebSocket(): WebSocket {
        // WebSocket needs ws:// or wss://, not http(s)://. Reuse the
        // http URL builder so scheme/host stay consistent, then swap
        // the protocol: http→ws, https→wss (both via `replace(/^http/, 'ws')`).
        const httpUrl = this.buildUrl('/ws/test-connect');
        const wsUrl = httpUrl.replace(/^http/, 'ws');
        return new WebSocket(wsUrl);
    }

    getGqlClient(): GraphQLClient {
        // Custom fetch wraps the global fetch with cookie-jar plumbing —
        // injects accumulated cookies on outgoing requests, captures any
        // Set-Cookie headers on responses. Mirrors what `sendRequest` does
        // for plain HTTP so the GraphQL + REST paths share one cookie store.
        const fetchWithCookies: typeof fetch = async (input, init) => {
            const headers = new Headers(init?.headers);
            const cookieString = this.getCookieString();
            if (cookieString.length > 0) {
                headers.set('cookie', cookieString);
            }
            applyConnectionCloseForLocalWorker(headers);
            const response = await fetchWithTransportRetries(input, {
                ...init,
                headers,
            });
            const setCookieHeader = response.headers.get(
                HTTP_HEADER_SET_COOKIE,
            );
            if (setCookieHeader) {
                const cookies = parseSetCookie(setCookieHeader);
                for (const [name, value] of Object.entries(cookies)) {
                    if (value !== undefined) {
                        this.cookieJar[name] = value;
                    }
                }
            }
            return response;
        };

        return new GraphQLClient(this.testGqlUrl(), {
            fetch: fetchWithCookies,
            credentials: 'include',
        });
    }

    getRemoteProcedureClient<
        RpcInterface extends object,
    >(): RpcClient<RpcInterface> {
        const rpcClient = new RpcClient<RpcInterface>(
            new FetchRpcClientDriver(this.runtime.host),
            {
                cookies: this.cookieJar,
            },
        );
        return rpcClient;
    }

    /**
     * Creates an {@link OrmDatabase} against the configured test
     * database for direct DB assertions on Orm entities.
     */
    getOrmDatabase(
        entities: OrmEntityClass[],
        name: string = DefaultConfigurationKey,
    ): OrmDatabase {
        const url = this.runtime.getDatabaseUrl(name);
        if (!url) {
            throw new Error(`Database URL for ${name} is not configured.`);
        }
        // Resolved at call time, not load time: the standalone database
        // pulls in @planetscale/database, an optional peer — a static
        // import here would make every consumer's test run require the
        // PlanetScale driver just to load the harness.
        const { ormCreatePlanetScaleDatabase } =
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require('../orm/database/OrmStandaloneDatabase') as typeof import('../orm/database/OrmStandaloneDatabase');
        return ormCreatePlanetScaleDatabase({
            url,
            entities,
            databaseName: name,
        });
    }

    async sendRequest(
        url: string,
        requestInit?: RequestInit,
    ): Promise<Response> {
        const cookies = Object.entries(this.cookieJar).map(
            ([key, value]) => `${key}=${value}`,
        );
        if (cookies.length > 0) {
            requestInit = requestInit || {};
            requestInit.headers = {
                ...(requestInit.headers || {}),
                cookie: cookies.join('; '),
            };
        }
        const requestHeaders = new Headers(requestInit?.headers);
        applyConnectionCloseForLocalWorker(requestHeaders);
        const response = await fetchWithTransportRetries(url, {
            ...requestInit,
            headers: requestHeaders,
        });

        // Persist any Set-Cookie headers back into the jar so subsequent
        // calls (including the GraphQL client's fetch wrapper) can read
        // them — without this, chained HTTP calls never carry cookies the
        // server just set.
        const setCookieHeader = response.headers.get(HTTP_HEADER_SET_COOKIE);
        if (setCookieHeader) {
            const parsed = parseSetCookie(setCookieHeader);
            for (const [name, value] of Object.entries(parsed)) {
                if (value !== undefined) {
                    this.cookieJar[name] = value;
                }
            }
        }

        return response;
    }
}

/**
 * Asks the server to close the connection after responding, when the server under test is a
 * locally booted worker.
 *
 * The test process runs in Node while the worker runs in workerd, so every request crosses Node's
 * undici keep-alive pool into workerd's HTTP server, and workerd's idle timeout becomes the server
 * side of a known undici race (nodejs/undici#3141, #5450): a socket the server has already closed
 * is still sitting in the pool, the next request gets written onto it, and the failure surfaces as
 * `TypeError: fetch failed` / `read ECONNRESET`. Because the pool is shared, it takes out whole
 * suites at once and picks a different victim each run — which reads as flakiness rather than as
 * one bug with one cause.
 *
 * Counter-intuitively it worsens as the suite gets faster: per nodejs/node#47130 the reset lands on
 * the request following a lull, so removing latency elsewhere (faking a slow third-party call, for
 * instance) pushes the run further into the race's worst regime.
 *
 * Retiring the connection per request costs one loopback handshake and removes the race entirely.
 * Gated on the local-boot flag so a deployed host keeps normal connection pooling.
 */
function applyConnectionCloseForLocalWorker(headers: Headers): void {
    if (process.env.TEST_DISABLE_HTTP_KEEP_ALIVE === 'true') {
        headers.set(HTTP_HEADER_CONNECTION, 'close');
    }
}

// How many times a request is retried after a TRANSPORT failure, and how long to wait between
// attempts. Two retries covers a dropped connection and the reconnect behind it; more would start
// hiding a server that is genuinely refusing traffic.
//
// A full second between attempts, not a token pause. Whatever dropped the connection — a worker
// being replaced, a socket reset mid-flight, a momentary route change — needs time to actually
// clear, and retrying into it immediately just spends the retry budget on the same broken
// connection. Two seconds of worst-case delay is nothing against a suite that takes minutes, and
// costs nothing at all on the overwhelming majority of runs where no retry happens.
const transportRetryCount = 2;
const transportRetryDelayInMilliseconds = 1000;

/**
 * Whether a thrown error is the connection failing, as opposed to the server answering.
 *
 * This distinction is the entire point of retrying here rather than with `jest.retryTimes`. A
 * dropped TCP connection says nothing about the code under test; an assertion failure or a 500 says
 * everything. The test runner cannot tell them apart — it only sees "the test failed" — so a
 * blanket retry there would paper over real regressions. `fetch` can: it THROWS for transport
 * failures and RESOLVES for every HTTP response, however bad the status.
 *
 * Matching on message text rather than an error class because the cause arrives differently across
 * runtimes (undici on Node, workerd locally), and the identifying codes are stable where the
 * wrapper types are not.
 */
function isTransportError(error: unknown): boolean {
    const messages: string[] = [];
    let current: unknown = error;
    // The useful code is usually on `cause` — Node reports `TypeError: fetch failed` at the top and
    // `Error: read ECONNRESET` underneath — so walk the chain rather than reading only the surface.
    for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
        messages.push(current.message);
        current = (current as { cause?: unknown }).cause;
    }
    const combined = messages.join(' | ');
    return (
        combined.includes('ECONNRESET') ||
        combined.includes('ECONNREFUSED') ||
        combined.includes('ETIMEDOUT') ||
        combined.includes('EPIPE') ||
        combined.includes('socket hang up') ||
        combined.includes('other side closed') ||
        combined.includes('fetch failed')
    );
}

/**
 * `fetch`, retried when the CONNECTION fails — never when the server responds.
 *
 * One dropped packet used to end a whole deployed run: the integration tier stops at the first
 * failing test, so a single `ECONNRESET` between the CI runner and Cloudflare blanked roughly two
 * hundred tests and three workers that had nothing to do with it. That is the correct behaviour for
 * a real failure and the wrong one for a transient network error, and only the layer holding the
 * error can tell which it is.
 *
 * Every retry is logged. A request that needs one is worth seeing, and a suite that retries
 * constantly should be discoverable rather than quietly green.
 */
async function fetchWithTransportRetries(
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= transportRetryCount; attempt += 1) {
        try {
            return await fetch(input, init);
        } catch (error) {
            lastError = error;
            if (!isTransportError(error) || attempt === transportRetryCount) {
                throw error;
            }
            // Jest-harness output stays on plain console, like the rest of
            // this folder — the Logger is for the worker execution path.
            // eslint-disable-next-line no-console
            console.warn(
                `Integration test request failed to connect (${(error as Error).message}), retrying ${attempt + 1}/${transportRetryCount}...`,
            );
            await new Promise((resolve) =>
                setTimeout(resolve, transportRetryDelayInMilliseconds),
            );
        }
    }
    throw lastError;
}

/**
 * Parses a `Set-Cookie` header into a map of cookie names to values.
 *
 * Accepts an optional type argument so call sites with a known cookie
 * shape can narrow the result:
 *
 * ```ts
 * const cookies = parseSetCookie<{ deviceId: string; sessionId: string }>(header);
 * ```
 */
export function parseSetCookie<
    T extends Record<string, string> = Record<string, string>,
>(input: string): Partial<T> {
    const result: Record<string, string> = {};
    const segments = input.split(', ');
    for (const segment of segments) {
        const parts = segment.split('; ');
        const keyValue = parts[0]?.split('=') ?? [];
        const name = keyValue[0];
        const value = keyValue[1];
        if (name && value !== undefined) {
            result[name] = value;
        }
    }
    return result as Partial<T>;
}
