// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export function stringHash(input: string) {
    let hash = 0,
        i,
        chr;
    if (input.length === 0) {
        return hash;
    }
    for (i = 0; i < input.length; i++) {
        chr = input.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

export function stringConcat(
    args?: string[] | ReadonlyArray<string>,
    joiner: string = ', ',
): string {
    if (!args || args.length === 0) {
        return '';
    }
    return args.join(joiner);
}
