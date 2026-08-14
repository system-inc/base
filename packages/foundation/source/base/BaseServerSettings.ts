// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Local development-server settings for a worker project
 * (`BaseSettings.server`): platform, host/port, request timeout, and — when
 * `protocol: 'https'` — the certificate and key paths.
 */
export type BaseServerSettings = InsecureServerSettings | SecureServerSettings;

/**
 * Local development settings for a worker project.
 */
interface SharedServerSettings {
    /**
     * The platform the worker is targeting (e.g. cloudflare or node).
     * This can optionally be set in the environment variables as PLATFORM.
     *
     * @default 'cloudflare'
     */
    platform?: 'cloudflare' | 'node';

    /**
     * The port the worker is going to be running on.
     * This only applies to environments where the port is used,
     * for example Node.js or running locally.
     *
     * @default 8787
     */
    port?: number;

    /**
     * The port the inspector will be running on.
     * This is the port you can connect to with a debugger.
     *
     * @default 9229
     */
    inspectorPort?: number;

    /**
     * The host to bind to for local development.
     *
     * @default 'localhost'
     */
    host?: string;

    /**
     * Maximum time in milliseconds that the server will wait for a
     * request to complete before aborting it.
     *
     * @default 30000
     */
    requestTimeout?: number;
}

/**
 * Local development settings for a worker project.
 */
interface InsecureServerSettings extends SharedServerSettings {
    /**
     * Whether to use https for local development.
     *
     * @default http
     */
    protocol?: 'http';
}

interface SecureServerSettings extends SharedServerSettings {
    /**
     * Whether to use https for local development.
     *
     * @default http
     */
    protocol: 'https';

    /**
     * The path to the certificate PEM file, resolved relative to the
     * worker folder. Generate a locally-trusted pair with a tool like
     * mkcert.
     */
    certificatePath: string;

    /**
     * The path to the certificate's private key PEM file, resolved
     * relative to the worker folder.
     */
    keyPath: string;
}
