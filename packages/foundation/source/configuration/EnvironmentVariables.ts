// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ExportedEncryptionKey } from '@system-inc/base-common/cryptography/encryption/EncryptionKey';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { ExecutionModeType } from './ExecutionMode';
import { PlatformType } from './Platform';

/**
 * A default set of environment variables for Base.
 *
 * You can extend this interface to add your own variables specific to your Worker.
 *
 * These variables will be available to your worker at runtime,
 * and should match the variables you have set in your env.toml file.
 */
export interface EnvironmentVariables extends Dictionary<unknown> {
    /**
     * The type of platform the worker is running on.
     */
    readonly PLATFORM?: PlatformType;

    /**
     * The type of environment you are running in.
     * This should map to one of the possible types in
     * EnivronmentType in base/source/core/Environment.ts
     */
    readonly ENVIRONMENT?: string;

    /**
     * The execution mode of the worker.
     */
    readonly EXECUTION_MODE?: ExecutionModeType;

    /**
     * The configuration name to use when running the worker.
     */
    readonly RUN_CONFIG?: string;

    /**
     * The port the worker should run on.
     */
    readonly PORT?: string;

    /**
     * A list of databases to connect to.
     * Each database should have a name and a URL.
     * The URL should be formatted as a MySQL connection string.
     */
    readonly DATABASES?: string | DatabaseEnvironmentVariables[];

    /**
     * The encryption keys to use for the server.
     */
    readonly ENCRYPTION_KEYS?: string | ExportedEncryptionKey[];

    /**
     * Cloudflare Worker version metadata.
     */
    readonly CF_VERSION_METADATA?: WorkerVersionMetadata;

    /**
     * The commit SHA of the build.
     */
    readonly COMMIT_SHA?: string;

    /**
     * The build timestamp of the build.
     */
    readonly BUILD_TIMESTAMP?: string;

    /**
     * The user who deployed the build.
     */
    readonly DEPLOYED_BY?: string;
}

/**
 * A database connection entry in the `DATABASES` environment variable: the
 * database's configured name and its connection URL.
 */
export type DatabaseEnvironmentVariables = {
    name: string;
    url: string;
};
