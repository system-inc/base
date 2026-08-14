// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Mirrors the Fetch API so that we can inject a custom fetch implementation if needed
 * (e.g. for testing or in environments where fetch isn't available).
 */
export interface Fetchable {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
