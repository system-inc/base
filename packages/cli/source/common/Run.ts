// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import child_process from 'child_process';
import { once } from 'events';

import { Dictionary } from '@system-inc/base-common/type/Dictionary';

export namespace Run {
    export interface ProgramOptionsBase {
        env?: Dictionary<string | undefined>;
        /**
         * Working directory for the spawned process. Defaults to the
         * parent process's CWD when omitted. Set this when the child
         * tool resolves paths relative to its own CWD (e.g. drizzle-kit
         * reading `schema:` from a generated config) and you want that
         * resolution anchored somewhere other than where the user
         * happened to launch `base`.
         */
        cwd?: string;
    }

    export interface ProgramOptionsWithOutput extends ProgramOptionsBase {
        captureOutput: true;
        /**
         * If true, suppress output to console while still capturing it.
         * Only applies when captureOutput is true.
         */
        silent?: boolean;
    }

    export interface ProgramOptionsWithoutOutput extends ProgramOptionsBase {
        captureOutput?: false | undefined;
    }

    export class ProgramError extends Error {
        constructor(
            public readonly code: number | null,
            public readonly signal: NodeJS.Signals | null,
            message?: string,
            /**
             * The child's combined stdout+stderr, when the run captured
             * output — so a caller can report WHY the program failed, not
             * just that it exited non-zero.
             */
            public readonly output?: string,
        ) {
            super(message ?? `Process exited with code ${code}`);
        }
    }

    export async function program(
        command: string,
        args: string[],
        options: ProgramOptionsWithOutput,
    ): Promise<string>;
    export async function program(
        command: string,
        args: string[],
        options?: ProgramOptionsWithoutOutput,
    ): Promise<void>;
    export async function program(
        command: string,
        args: string[],
        options: ProgramOptionsBase = {},
    ): Promise<void | string> {
        const captureOutput =
            (options as ProgramOptionsWithOutput).captureOutput === true;
        const silent =
            captureOutput &&
            (options as ProgramOptionsWithOutput).silent === true;
        const env = options.env;

        // If captureOutput, use pipe (either to capture+print or capture silently)
        // Otherwise, inherit to show output automatically
        const stdio = captureOutput ? 'pipe' : 'inherit';

        const child = child_process.spawn(command, args, {
            stdio,
            env,
            cwd: options.cwd,
            detached: false,
        });

        let output = '';

        if (captureOutput) {
            if (child.stdout) {
                child.stdout.on('data', (data: Buffer) => {
                    const text = data.toString();
                    // Print to console unless silent mode
                    if (!silent) {
                        process.stdout.write(text);
                    }
                    output += text;
                });
            }
            if (child.stderr) {
                child.stderr.on('data', (data: Buffer) => {
                    const text = data.toString();
                    // Print to console unless silent mode
                    if (!silent) {
                        process.stderr.write(text);
                    }
                    output += text;
                });
            }
        }

        const [code, signal] = (await once(child, 'exit')) as [
            number | null,
            NodeJS.Signals | null,
        ];

        if (code !== 0) {
            throw new ProgramError(
                code,
                signal,
                undefined,
                captureOutput ? output : undefined,
            );
        }

        return captureOutput ? output : undefined;
    }
}
