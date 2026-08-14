// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export class AbortedError extends Error {
    constructor(message?: string) {
        super(message || 'The operation was aborted.');
        this.name = 'AbortedError';
    }
}
