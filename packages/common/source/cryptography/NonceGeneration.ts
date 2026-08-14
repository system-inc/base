// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export function generateNonce(): string {
    return crypto
        .getRandomValues(new Uint8Array(16))
        .reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');
}
