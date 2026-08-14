// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export namespace WranglerEnvironmentVariables {
    export const Keys = [
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_API_TOKEN',
        'CLOUDFLARE_API_KEY',
        'CLOUDFLARE_EMAIL',
        'WRANGLER_SEND_METRICS',
        'WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING',
        'CLOUDFLARE_API_BASE_URL',
        'WRANGLER_LOG',
        'FORCE_COLOR',
    ];
}

/**
 * Environment variables used by Wrangler.
 * https://developers.cloudflare.com/workers/wrangler/system-environment-variables/
 */
export interface WranglerEnvironmentVariables {
    /**
     * The account ID for the Workers related account.
     */
    readonly CLOUDFLARE_ACCOUNT_ID?: string;

    /**
     * The API token for your Cloudflare account, can be used for
     * authentication for situations like CI/CD, and other automation.
     */
    readonly CLOUDFLARE_API_TOKEN?: string;

    /**
     * The API key for your Cloudflare account,
     * usually used for older authentication method with CLOUDFLARE_EMAIL=.
     */
    readonly CLOUDFLARE_API_KEY?: string;

    /**
     * The email address associated with your Cloudflare account,
     * usually used for older authentication method with CLOUDFLARE_API_KEY=.
     */
    readonly CLOUDFLARE_EMAIL?: string;

    /**
     * Options for this are true and false, the default behavior is false.
     */
    readonly WRANGLER_SEND_METRICS?: string;

    /**
     * The local connection string for your database to use in local development with Hyperdrive.
     * For example, if the binding for your Hyperdrive is named PROD_DB, this would be
     * WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_PROD_DB="postgres://user:password@127.0.0.1:5432/testdb".
     * Each Hyperdrive is uniquely distinguished by the binding name.
     */
    readonly WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING?: string;

    /**
     * The default value is "https://api.cloudflare.com/client/v4".
     */
    readonly CLOUDFLARE_API_BASE_URL?: string;

    /**
     * Options for Logging levels are "none", "error", "warn", "info", "log" and "debug".
     * Levels are case-insensitive and default to "log".
     * If an invalid level is specified, Wrangler will fallback to the default.
     */
    readonly WRANGLER_LOG?: string;

    /**
     * By setting this to 0, you can disable Wrangler’s colorised output,
     * which makes it easier to read with some terminal setups.
     * For example, FORCE_COLOR=0.
     */
    readonly FORCE_COLOR?: string;
}
