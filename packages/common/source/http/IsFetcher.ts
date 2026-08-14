// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Test if the given object is a Fetcher.
 *
 * @param fetcher
 * @returns
 */
export function isFetcher(fetcher: unknown): fetcher is Fetcher {
    return (
        typeof fetcher === 'object' &&
        fetcher !== null &&
        'fetch' in fetcher &&
        typeof fetcher.fetch === 'function'
    );
}
