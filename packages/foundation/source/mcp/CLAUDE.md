# mcp/ — RPC procedures as MCP tools

Serves chosen `@Rpc` procedures as [Model Context Protocol](https://modelcontextprotocol.io) tools over the Streamable HTTP transport, on both Cloudflare and Node. There is no second dispatch path: a tool call runs through `RpcDispatcher.dispatch`, so visibility, session access (before arguments are deserialized), validation, and request-scoped DI apply exactly as on the RPC route. Public contract here (`McpSettings`, `McpToolOptions`); machinery in `internal/mcp/` (`McpToolRegistry`, `McpDispatcher`, `McpProtocol`).

## Declaring a tool

```ts
@RpcService({ visibility: 'public' })
export class BillingRpc {
    @Rpc(() => ChargeResult, {
        mcp: {
            description: 'Charge a saved card. Returns the charge id; fails if the card is expired.',
            annotations: { destructiveHint: true },
        },
    })
    async charge(@RpcArgument(() => ChargeInput) input: ChargeInput): Promise<ChargeResult> { ... }
}
```

Exposure is the `mcp` option on `@Rpc` (`McpToolOptions`): there is no separate tool decorator, so only an RPC procedure can be a tool by construction (an HTTP route has nowhere to put the option; `@WebSocketRpc()` takes no options). `description` is required by the type; `name`, `title`, and `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) are optional. Setting `BaseSettings.mcp` serves the endpoint (`route`, default `/mcp`; `instructions`; `allowedOrigins`; `allowedHosts`).

## Boot validation (`McpToolRegistry`)

Built when `Base.initialize` registers the route, so every contradiction fails boot naming `Service.procedure`: a blank description; a procedure whose resolved visibility (procedure → service → `rpc.service`) isn't `'public'` — checked in **every** mode, since local mode treats everything as public and the tool would otherwise fail only in production; an invalid tool name (MCP's `^[A-Za-z0-9_.-]{1,128}$`) or two tools with one name; a parameter without `@RpcArgument` (and not `@InjectRequestContext`); an unnamed or duplicate-named argument on a multi-argument tool. Rest parameters don't count in `Function.length`, so they can't be detected. Input properties without a description get one boot warning per class.

**Names** default to `<service>_<procedure>` in snake_case with a trailing `RpcService`/`Rpc`/`Service` dropped (`BillingRpc.chargeCard` → `billing_charge_card`); `mcp.name` overrides. Class names survive minified bundles because `base bundle` passes `--keep-names`.

**Arguments.** A procedure whose only argument is a serializable class takes that class's fields as the tool's arguments (its `generateJsonSchema` is the `inputSchema`); any other takes one property per `@RpcArgument`, keyed by its `name`, typed through a shared `JsonSchemaBuilder`, with `description`/`default` and `required` unless optional or defaulted. `toRpcArguments` maps the named object back to positional `RpcCall.arguments`, leaving a missing value `undefined` (never `null`) so the dispatcher applies the default or reports it missing.

## The endpoint (`McpDispatcher`)

Stateless, JSON responses only (protocol revisions `2025-11-25`, `2025-06-18`, `2025-03-26`):

- `POST` one JSON-RPC message. `initialize` (negotiates the version: the client's if supported, else the latest; returns `serverInfo` from `BaseSettings` name/title/version and `instructions`), `ping`, `tools/list`, `tools/call`. Any other method with an id → `-32601`; notifications and client responses → `202` with no body; malformed JSON → `400` `-32700`; a non-message or batch → `400` `-32600`.
- `GET`/`DELETE` → `405` (no SSE stream, no session; no `Mcp-Session-Id` is issued). An unsupported `MCP-Protocol-Version` header → `400`.
- **Origin/Host**: a present `Origin` not in `allowedOrigins` (default empty) → `403`; no `Origin` (non-browser clients) is allowed. When `allowedHosts` is set, an unlisted `Host` → `403`. Error bodies are JSON-RPC errors.

**Per-caller tools.** `tools/list` returns only tools the caller's session access allows, decided by `sessionAccessDenial` (the same resolution and checks the session-access middleware enforces, returning the denial instead of throwing) — no handler runs. Other handler middleware can't be evaluated without running it, so it isn't part of filtering. Calling a hidden tool answers byte-for-byte like an unknown tool (`-32602 Unknown tool: <name>`); a session denial thrown inside `dispatch` is mapped the same way. (Hiding covers `/mcp` only — `/rpc` still distinguishes 401/403 from not-found.)

**Credentials.** OAuth is out of scope: clients send a static header the `SessionContextProvider` reads. A provider that returns `null` makes the caller anonymous; one that throws `HttpErrors.unauthorized()` (`AUTHENTICATION_REQUIRED`) for credentials it rejects makes the endpoint answer HTTP `401`, so a client reports an auth failure instead of showing a short tool list. Other provider errors become a JSON-RPC error with the client-safe message.

**Results.** Success → a text block with the result's JSON plus `structuredContent` (the result if it's an object, else `{ result }`); a `void` result → empty `content`. Failure (validation, deserialization, a thrown handler error, a non-session middleware denial) → `isError: true` with the client-safe message (and the failure's `cause` JSON), so the model can correct its call. No `outputSchema` is emitted: the server doesn't validate results, and a declared-contract schema (no `null`) would make clients reject results with null fields.

## See also

[`rpc/`](../rpc/CLAUDE.md) (`dispatch`, visibility) · [`serialization/`](../serialization/CLAUDE.md) (`generateJsonSchema`) · [`access-control/`](../access-control/CLAUDE.md) (providers, `sessionAccessDenial`).
