// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '../logging/LogCategory';
import { Logger } from '../logging/Logger';

/**
 * Prepares a request for Cloudflare by removing properties that are not supported.
 * This is necessary because Cloudflare Workers do not support certain fetch options.
 *
 * @param request
 * @returns
 */
export function cfPrepareRequest(init?: RequestInit, warn = true): RequestInit {
    const src = init ?? {};

    // Carry every field through, then delete only the options workerd doesn't
    // support (cache/mode/credentials). A fixed-allowlist clone would silently
    // drop Cloudflare-specific members like `cf` (per-request CF settings) and
    // `duplex` (streaming request bodies), which callers legitimately set.
    const out: RequestInit = { ...src };

    for (const key of ['cache', 'credentials', 'mode'] as const) {
        // warn only for a truthy value the caller actually set; always drop the
        // key (the spread copies explicit `undefined` too)
        if (src[key]) {
            warnKey(key, warn);
        }
        delete out[key];
    }

    // clone & sanitize headers
    if (src.headers) {
        const headers = new Headers(src.headers);
        stripHopByHopHeaders(headers);
        out.headers = headers;
    }

    return out;
}

function stripHopByHopHeaders(h: Headers) {
    const hopHeaders = [
        'connection',
        'keep-alive',
        'proxy-connection',
        'transfer-encoding',
        'upgrade',
        'http2-settings',
        'te',
        'trailer',
        'proxy-authenticate',
        'proxy-authorization',
        'host',
        'content-length',
    ];
    for (const k of hopHeaders) {
        h.delete(k);
    }
}

function warnKey(key: string, warn = true) {
    if (warn) {
        Logger.warn(
            LogCategory.Common,
            'Unsupported `%s` fetch option used in Cloudflare Workers; removed.',
            key,
        );
    }
}
