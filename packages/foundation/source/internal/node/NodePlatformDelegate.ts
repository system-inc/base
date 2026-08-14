// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { BaseWorkerPlatformDelegate } from '../../worker/BaseWorkerPlatformDelegate';

export class NodePlatformDelegate implements BaseWorkerPlatformDelegate {
    initializePlatform(
        _configuration: BaseConfiguration,
    ): void | Promise<void> {}

    getRequestIpAddress(_request: Request): string | undefined {
        return undefined;
    }

    getPlatformRequestProperties(_request: Request): unknown {
        return {};
    }
}
