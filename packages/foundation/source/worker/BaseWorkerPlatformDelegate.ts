// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseConfiguration } from '../configuration/BaseConfiguration';

/**
 * Delegate for platform-specific worker functionality.
 */
export interface BaseWorkerPlatformDelegate<
    PlatformRequestProperties = unknown,
> {
    /**
     * Perform any platform-specific initialization.
     *
     * @param configuration
     */
    initializePlatform(configuration: BaseConfiguration): Promise<void> | void;

    /**
     * Gets the IP address from the request.
     *
     * @param request
     */
    getRequestIpAddress(request: Request): string | undefined;

    /**
     * Gets properties that have been added to the request that are specific to the platform.
     * For example, Cloudflare adds additional headers to the request that can be used to
     * determine the country of the request.
     *
     * @param request
     */
    getPlatformRequestProperties(
        request: Request,
    ): PlatformRequestProperties | undefined;
}
