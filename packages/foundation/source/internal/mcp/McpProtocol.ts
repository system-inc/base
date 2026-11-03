// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * The MCP protocol revisions this server speaks, newest first. All three
 * share the stateless JSON request/response shape the endpoint serves.
 */
export const McpSupportedProtocolVersions: readonly string[] = [
    '2025-11-25',
    '2025-06-18',
    '2025-03-26',
];

/**
 * The JSON-RPC 2.0 error codes the endpoint answers with.
 */
export const JsonRpcErrorCode = {
    ParseError: -32700,
    InvalidRequest: -32600,
    MethodNotFound: -32601,
    InvalidParams: -32602,
    InternalError: -32603,
} as const;

export type JsonRpcErrorCode =
    (typeof JsonRpcErrorCode)[keyof typeof JsonRpcErrorCode];

/**
 * A JSON-RPC request or notification id.
 */
export type JsonRpcId = string | number;

/**
 * Thrown while handling a method to answer with a JSON-RPC error.
 */
export class McpProtocolError extends Error {
    constructor(
        readonly code: JsonRpcErrorCode,
        message: string,
    ) {
        super(message);
    }
}

/**
 * The tool-name rule from the MCP spec: 1–128 characters of letters,
 * digits, `_`, `-`, and `.`.
 */
export const McpToolNamePattern = /^[A-Za-z0-9_.-]{1,128}$/;
