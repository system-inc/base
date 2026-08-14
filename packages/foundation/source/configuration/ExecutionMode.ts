// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Execution mode of the base application.
 */
export enum ExecutionModeType {
    /**
     * Command line (Cli) execution mode.
     * Some Cli commands require an instantiated base application to run.
     * This mode is used for that use case enabling a base application to
     * initialize but not start while running inside the Cli.
     */
    CommandLine = 'CommandLine',

    /**
     * The default execution mode.
     * This mode is used when the base application is running in a normal
     * production environment. This is the default mode for the base application.
     */
    Default = 'Default',

    /**
     * Test execution mode.
     * This mode is used when the base application is running as
     * part of an test test suite. There could be situations
     * where the base application needs to behave differently when
     * running in an test suite. For instance, using a
     * sandbox mode for an external service.
     */
    Test = 'Test',

    /**
     * Local execution mode.
     * This mode is used when the base application is running on a local
     * machine. This mode is used to alter the system behavior to facilitate
     * easier development.
     */
    Local = 'Local',
}

export namespace ExecutionModeType {
    /**
     * Converts the given string to an ExecutionMode.
     *
     * @param mode
     * @returns
     */
    export function fromString(mode: string): ExecutionModeType {
        switch (mode.trim().toLowerCase()) {
            case ExecutionModeType.CommandLine.toLowerCase():
                return ExecutionModeType.CommandLine;
            case ExecutionModeType.Test.toLowerCase():
                return ExecutionModeType.Test;
            case ExecutionModeType.Local.toLowerCase():
                return ExecutionModeType.Local;
            default:
                return ExecutionModeType.Default;
        }
    }
}

/**
 * How the worker process was started — normal serving (`Default`), under the
 * CLI (`CommandLine`), in tests (`Test`), or serving locally (`Local`) —
 * parsed from the `EXECUTION_MODE` environment variable. Gates
 * mode-dependent behavior such as CLI-safe routing and local RPC visibility.
 */
export class ExecutionMode {
    readonly type: ExecutionModeType;

    constructor(executionMode?: ExecutionModeType) {
        this.type = executionMode
            ? ExecutionModeType.fromString(executionMode)
            : ExecutionModeType.Default;
    }

    get isCommandLine(): boolean {
        return this.type === ExecutionModeType.CommandLine;
    }

    get isDefault(): boolean {
        return this.type === ExecutionModeType.Default;
    }

    get isTest(): boolean {
        return this.type === ExecutionModeType.Test;
    }

    get isLocal(): boolean {
        return this.type === ExecutionModeType.Local;
    }
}
