// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Gets the type or token that caused the injection error.
 *
 * We could modify tsyringe to return the extact token in the error,
 * but this is a workaround for now.
 *
 * @param message
 * @returns
 */
export function extractTypeOrTokenFromErrorMessage(
    message: string,
): string | null {
    const regex =
        /(?:TypeInfo not known for|Attempted to resolve unregistered dependency token:) "(.*?)"/g;
    let match;
    let lastMatch: string | null = null;
    while ((match = regex.exec(message)) !== null) {
        lastMatch = match[1];
    }
    return lastMatch;
}
