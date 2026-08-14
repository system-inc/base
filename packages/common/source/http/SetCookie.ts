// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Represents a cookie that can be set in a HTTP response.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
 * for complete documentation on how Set-Cookie headers work.
 */
export class SetCookie {
    readonly name: string;
    readonly value: string;

    readonly domain: string | undefined;
    readonly expires: Date | undefined;
    readonly httpOnly: boolean | undefined;
    readonly maxAge: number | undefined;
    readonly partitioned: boolean | undefined;
    readonly path: string | undefined;
    readonly secure: boolean | undefined;
    readonly sameSite: SameSite | undefined;

    constructor({
        name,
        value,
        domain,
        expires,
        httpOnly,
        maxAge,
        partitioned,
        path,
        secure,
        sameSite,
    }: SetCookieOptions) {
        this.name = name;
        this.value = value;
        this.domain = domain;
        this.expires = expires;
        this.httpOnly = httpOnly;
        this.maxAge = maxAge;
        this.partitioned = partitioned;
        this.path = path;
        this.secure = secure;
        this.sameSite = sameSite;
    }

    /**
     * Returns the cookie as a string so it can be set in the response header 'Set-Cookie'.
     *
     * e.g.
     * Set-Cookie: <cookie-name>=<cookie-value>; Domain=<domain-value>; Secure; HttpOnly
     * @returns
     */
    toString(): string {
        let cookie = `${this.name}=${this.value}`;
        if (this.domain) {
            cookie += `; Domain=${this.domain}`;
        }
        if (this.expires) {
            cookie += `; Expires=${this.expires.toUTCString()}`;
        }
        if (this.maxAge !== undefined) {
            // Max-Age=0 is the idiomatic "delete immediately" value; a truthy
            // check would drop it and leave the cookie undeleted.
            cookie += `; Max-Age=${this.maxAge}`;
        }
        if (this.path) {
            cookie += `; Path=${this.path}`;
        }
        if (this.sameSite) {
            cookie += `; SameSite=${this.sameSite}`;
        }
        if (this.partitioned) {
            cookie += '; Partitioned';
        }
        if (this.secure) {
            cookie += '; Secure';
        }
        if (this.httpOnly) {
            cookie += '; HttpOnly';
        }
        return cookie;
    }
}

export interface SetCookieOptions {
    name: string;
    value: string;
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    partitioned?: boolean;
    path?: string;
    secure?: boolean;
    sameSite?: SameSite;
}

export type SameSite = 'Strict' | 'Lax' | 'None';
