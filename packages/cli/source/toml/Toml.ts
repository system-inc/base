// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as smolToml from 'smol-toml';

export namespace Toml {
    /**
     * Parses a TOML file into a JavaScript object.
     *
     * @param location
     * @param content
     * @returns
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export function parseToml<T = any>(location: string, content: string): T {
        try {
            return smolToml.parse(content) as T;
        } catch (error) {
            console.error(
                'Unable to parse env.toml at:',
                location,
                'Error:',
                error,
            );
            process.exit(1);
        }
    }
}
