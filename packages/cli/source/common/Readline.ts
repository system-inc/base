// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as readline from 'readline';

export namespace ReadLine {
    export async function askQuestion(query: string): Promise<string> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve) =>
            rl.question(query, (ans) => {
                rl.close();
                resolve(ans);
            }),
        );
    }
}
