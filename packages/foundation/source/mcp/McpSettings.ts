// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * The default route the MCP endpoint is served on.
 */
export const DefaultMcpEndpoint = '/mcp';

/**
 * Serves the worker's MCP tools (`@Rpc({ mcp: { ... } })` procedures) over
 * MCP's Streamable HTTP transport. Setting `BaseSettings.mcp` enables the
 * endpoint.
 */
export interface McpSettings {
    /**
     * The route to serve on.
     *
     * @default '/mcp'
     */
    readonly route?: string;

    /**
     * The `instructions` returned from `initialize`: guidance a client may
     * give its model about using these tools together.
     */
    readonly instructions?: string;

    /**
     * Browser origins allowed to call the endpoint. A request carrying an
     * `Origin` header that isn't listed is refused with 403, which is the
     * DNS-rebinding protection MCP requires of HTTP servers. Requests
     * without an `Origin` header (non-browser clients) are always allowed.
     *
     * @default []
     */
    readonly allowedOrigins?: string[];

    /**
     * When set, a request whose `Host` header isn't listed is refused with
     * 403: defense in depth for a server bound to a local address.
     */
    readonly allowedHosts?: string[];
}
