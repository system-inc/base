---
title: Expose Procedures as MCP Tools
description: Serve RPC procedures as Model Context Protocol tools, with the same access control and validation as RPC.
---

A procedure can also be a [Model Context Protocol](https://modelcontextprotocol.io) tool, so an MCP client such as Claude Code can discover it and call it. Tool calls run through the same dispatcher as RPC calls: visibility, access control, argument validation and dependency injection work exactly as they do on `/__rpc`.

## Mark the procedure

Add the `mcp` option to `@Rpc`. The `description` is required: it is what the model reads to decide whether and how to call the tool.

```ts
@RpcService({ visibility: 'public' })
export class NoteRpcService {
    @Rpc(() => NoteJson, {
        mcp: {
            description:
                'Creates a note and returns it. Fails if the title is empty or longer than 80 characters.',
        },
    })
    async createNote(
        @RpcArgument(() => CreateNoteInput) input: CreateNoteInput,
    ): Promise<NoteJson> { ... }

    @Rpc({
        mcp: {
            description: 'Searches notes by text and returns up to `limit` matches.',
            annotations: { readOnlyHint: true },
        },
    })
    async searchNotes(
        @RpcArgument(() => String, { name: 'query', description: 'Text to search for.' })
        query: string,
        @RpcArgument(() => Number, { name: 'limit', defaultValue: 10 })
        limit: number,
    ): Promise<NoteJson[]> { ... }
}
```

Then turn the endpoint on in settings:

```ts
mcp: {
    instructions: 'Search before creating, to avoid duplicate notes.',
},
```

Tools are served on `POST /mcp`, using MCP's Streamable HTTP transport (stateless, JSON responses). This works on Cloudflare and on Node.

## How a tool is described

- **Names** default to `<service>_<procedure>` in snake_case, without a trailing `RpcService`, `Rpc` or `Service`. The procedures above become `note_create_note` and `note_search_notes`. Set `mcp.name` to choose another name.
- **Arguments.** When the procedure's only argument is a class, the class's fields are the tool's arguments (`createNote` takes `title`, `body`, …). Otherwise each `@RpcArgument` is one argument, keyed by its `name`, and every argument then needs a `name`.
- **Schemas** are generated from `@SerializableField` and `@Verify*` metadata (see [JSON Schema](../serialization/03-json-schema.md)). Give fields and arguments a `description`. The model picks values from them, and Base logs a warning at boot for each input property that has none.
- **Results** come back as JSON text plus `structuredContent`: the result itself when it's an object, else `{ "result": … }`. A failure (a validation error, or an error the procedure throws) comes back as a tool error carrying the same client-safe message the RPC route returns, so the model can correct its call.

## Rules checked at boot

Booting fails, naming the procedure, when:

- the description is blank;
- the procedure's visibility isn't `'public'` (the MCP endpoint is a public route, and this is checked even in local development);
- a tool name is invalid, or two tools share a name;
- a parameter has no `@RpcArgument`, or a multi-argument tool has an argument without a `name`.

## Who sees which tools

The endpoint uses your [access-control](../security/01-access-control.md) provider. Clients send credentials as a header, for example a bearer token configured in the MCP client.

- `tools/list` returns only the tools the caller's `@RequireSessionAccess` / `@WithSessionAccess` requirements allow. Calling a tool the caller can't see gets the same answer as calling a tool that doesn't exist.
- A provider that returns `null` treats the caller as anonymous. For credentials that were sent but are invalid (an expired or mistyped token), throw `HttpErrors.unauthorized()` instead. The endpoint then answers HTTP 401, so the client reports an authentication failure rather than showing a shorter tool list.

OAuth authorization isn't supported.

## Origins

Browsers can't reach the endpoint unless you allow them. A request with an `Origin` header not listed in `mcp.allowedOrigins` gets a 403; this protects a local server from DNS-rebinding attacks. Requests without an `Origin` header, which is how CLI and server clients call, are always allowed. For a service bound to `127.0.0.1`, `mcp.allowedHosts` additionally refuses requests whose `Host` header isn't listed.

## Connect Claude Code

```bash
claude mcp add --transport http notes http://127.0.0.1:8787/mcp \
  --header "Authorization: Bearer $NOTES_TOKEN"
```
