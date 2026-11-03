// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Hints about a tool's behavior that MCP clients may use, for example to
 * decide when to ask the user before calling it. They are hints, not
 * guarantees.
 */
export interface McpToolAnnotations {
    /**
     * The tool doesn't modify its environment.
     */
    readonly readOnlyHint?: boolean;

    /**
     * The tool may perform destructive updates. Meaningful only when it
     * isn't read-only.
     */
    readonly destructiveHint?: boolean;

    /**
     * Calling the tool again with the same arguments has no further effect.
     * Meaningful only when it isn't read-only.
     */
    readonly idempotentHint?: boolean;

    /**
     * The tool interacts with an open world of external entities (the web,
     * for example) rather than a closed domain.
     */
    readonly openWorldHint?: boolean;
}

/**
 * Exposes an `@Rpc()` procedure as an MCP tool: `@Rpc({ mcp: { ... } })`.
 * Setting it is the opt-in; a procedure without it is RPC only.
 */
export interface McpToolOptions {
    /**
     * What a model reads to decide whether and how to call the tool: what
     * it does, what it returns, and when it fails. Required, and must not be
     * blank.
     */
    readonly description: string;

    /**
     * The tool name. Defaults to `<service>_<procedure>` in snake_case,
     * with a trailing `RpcService`, `Rpc`, or `Service` dropped from the
     * class name (`BillingRpc.chargeCard` → `billing_charge_card`).
     */
    readonly name?: string;

    /**
     * A human-readable display name.
     */
    readonly title?: string;

    /**
     * Behavior hints for clients.
     */
    readonly annotations?: McpToolAnnotations;
}
