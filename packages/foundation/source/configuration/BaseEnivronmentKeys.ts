// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseEnvironmentKey } from './BaseEnvironmentKey';
import { ExecutionModeType } from './ExecutionMode';
import { PlatformType } from './Platform';

/**
 * Well-known environment variable keys used by the framework.
 */
export namespace BaseEnvironmentKeys {
    export const CommitSha = BaseEnvironmentKey.create<string>('COMMIT_SHA');
    export const BuildTimestamp =
        BaseEnvironmentKey.create<string>('BUILD_TIMESTAMP');
    export const DeployedBy = BaseEnvironmentKey.create<string>('DEPLOYED_BY');
    export const CfVersionMetadata =
        BaseEnvironmentKey.create<WorkerVersionMetadata>('CF_VERSION_METADATA');
    export const Environment = BaseEnvironmentKey.create<string>('ENVIRONMENT');
    /**
     * Log-level directive applied at boot, overriding
     * `BaseSettings.logging.level`. A default level and/or per-category
     * overrides, e.g. `warn` or `warn,rpc=debug`.
     */
    export const LogLevel = BaseEnvironmentKey.create<string>('LOG_LEVEL');
    export const ExecutionMode =
        BaseEnvironmentKey.create<ExecutionModeType>('EXECUTION_MODE');
    export const Platform = BaseEnvironmentKey.create<PlatformType>('PLATFORM');
    export const Databases = BaseEnvironmentKey.create<unknown>('DATABASES');
}
