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
     * The hostname or IP address the server binds to: passed to
     * `wrangler dev` as `--ip`, and to `listen()` by the Node runner (a
     * deployed Node worker or container included). `base test` also uses
     * it to derive the integration test host.
     *
     * Bind a Node worker that must be reachable from other machines or from
     * outside its container to `'0.0.0.0'` (or leave `host` unset). Bind a
     * local-only service to `'127.0.0.1'`, and point its clients at that
     * same literal address: a client configured with `localhost` may
     * resolve it to `::1` and fail to connect.
     *
     * @default 'localhost' under `wrangler dev`; every interface on Node
     */
    host?: string;

    /**
     * Whether the Node runner fires scheduled executables on their cron
     * triggers. Cloudflare runs each cron once however many instances
     * serve the worker, but every Node instance runs its own schedule —
     * enable it on one instance of a horizontally scaled deployment.
     *
     * @default true
     */
    scheduled?: boolean;

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
