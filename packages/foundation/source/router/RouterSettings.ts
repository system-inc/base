// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { NamedConfiguration } from '@system-inc/base-common/configuration/NamedConfiguration';

export type AllowedOrigin =
    | boolean
    | string
    | string[]
    | RegExp
    | ((origin: string) => string | void);

export interface RouterCorsSettings {
    /**
     * Allow preflight requests.
     */
    readonly preflight?: boolean;

    /**
     * The allowed origins.
     */
    readonly allowedOrigins?: NamedConfiguration<AllowedOrigin>;

    /**
     * The allowed methods.
     */
    readonly allowedMethods?: string[];

    /**
     * The allowed headers.
     */
    readonly allowedHeaders?: string[];

    /**
     * The exposed headers.
     */
    readonly exposedHeaders?: string[];

    /**
     * Whether credentials are allowed.
     */
    readonly allowCredentials?: boolean;

    /**
     * The max age of the request.
     */
    readonly maxAge?: number;
}

/**
 * Router settings for Base applications.
 */
export interface RouterSettings {
    /**
     * Cors settings for the router.
     */
    readonly cors?: RouterCorsSettings;

    /**
     * A map of paths to rewrite to other paths.
     */
    readonly rewrite?: Record<string, string>;

    /**
     * A map of routes that should not be logged
     * or true to disable for all routes.
     */
    readonly disableAccessLog?: boolean | string[];
}
