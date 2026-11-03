// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { RequireSessionAccess } from '../../access-control/decorators/RequireSessionAccess';
import { SessionContext } from '../../access-control/SessionContext';
import { SessionContextProvider } from '../../access-control/SessionContextProvider';
import { Base } from '../../base/Base';
import { BaseSettings } from '../../base/BaseSettings';
import { PlatformType } from '../../configuration/Platform';
import { ERROR_CODE_AUTHENTICATION_REQUIRED } from '../../error/ErrorCode';
import { HttpErrors } from '../../error/HttpErrors';
import { McpSettings } from '../../mcp/McpSettings';
import { HandlerRequestContext } from '../../request/HandlerRequestContext';
import { Rpc } from '../../rpc/decorators/Rpc';
import { RpcArgument } from '../../rpc/decorators/RpcArgument';
import { RpcService } from '../../rpc/decorators/RpcService';
import { SerializableField } from '../../serialization/decorators/SerializableField';
import { SerializableObject } from '../../serialization/decorators/SerializableObject';
import { VerifyIsEmail } from '../../validation/decorators/VerifyIsEmail';
import { BaseWorker } from '../../worker/BaseWorker';
import { BaseExecutionContext } from '../execution-context/BaseExecutionContext';

/**
 * Signs the caller in with the roles named in `x-test-roles`. No header is
 * anonymous; `reject` stands for credentials the provider refuses.
 */
class HeaderRolesProvider implements SessionContextProvider {
    resolve(
        requestContext: HandlerRequestContext,
    ): Promise<SessionContext | null> {
        const header = requestContext.headers.get('x-test-roles');
        if (header === null) {
            return Promise.resolve(null);
        }
        if (header === 'reject') {
            throw HttpErrors.unauthorized({
                message: 'The access token has expired.',
                errorCode: ERROR_CODE_AUTHENTICATION_REQUIRED,
            });
        }
        const accessRoles = header.split(',');
        return Promise.resolve({
            sessionId: 's1',
            accountId: 'a1',
            actorId: 'a1',
            accessRoles,
            entitlements: [],
            hasAccessRole: (role: string | string[]) =>
                (Array.isArray(role) ? role : [role]).some((value) =>
                    accessRoles.includes(value),
                ),
            hasEntitlement: () => false,
            getActor: () => ({}),
        });
    }
}

@SerializableObject()
class InviteInput {
    @VerifyIsEmail()
    @SerializableField(() => String, { description: 'Who to invite.' })
    email: string;
}

@RpcService({ visibility: 'public' })
class ToolboxRpc {
    @Rpc({ mcp: { description: 'Invites someone by email.' } })
    async invite(
        @RpcArgument(() => InviteInput) input: InviteInput,
    ): Promise<string> {
        return `invited ${input.email}`;
    }

    @Rpc({
        mcp: {
            description: 'Adds two numbers.',
            title: 'Add',
            annotations: { readOnlyHint: true },
        },
    })
    async add(
        @RpcArgument(() => Number, { name: 'a', description: 'The first.' })
        a: number,
        @RpcArgument(() => Number, { name: 'b', defaultValue: 10 })
        b: number,
    ): Promise<{ sum: number }> {
        return { sum: a + b };
    }

    @RequireSessionAccess({ roles: ['Administrator'] })
    @Rpc({ mcp: { description: 'Resets an account. Administrators only.' } })
    async adminReset(
        @RpcArgument(() => InviteInput) input: InviteInput,
    ): Promise<string> {
        return `reset ${input.email}`;
    }

    @Rpc()
    async rpcOnly(): Promise<string> {
        return 'rpc';
    }
}

function createBase(
    services: Constructor<object>[] = [ToolboxRpc],
    mcp: McpSettings = {
        instructions: 'Invite people, then add numbers.',
        allowedOrigins: ['https://app.example.com'],
    },
    rpcVisibility?: 'public' | 'internal',
): Base {
    const settings: BaseSettings = {
        name: 'mcp-test',
        title: 'MCP Test',
        version: '1.2.3',
        modules: [],
        services,
        rpc: { service: rpcVisibility ? { visibility: rpcVisibility } : {} },
        accessControl: { provider: HeaderRolesProvider },
        mcp,
    };
    return BaseWorker.create(settings).getBase({
        PLATFORM: PlatformType.CloudflareWorker,
        ENVIRONMENT: 'Production',
    });
}

const base = createBase();

async function send(
    init: RequestInit & { path?: string },
    target: Base = base,
): Promise<Response> {
    return target.handleRequest(
        new Request(`https://api.example.com${init.path ?? '/mcp'}`, init),
        new BaseExecutionContext(performance.now()),
    );
}

async function rpc(
    method: string,
    params?: object,
    headers: Record<string, string> = {},
    target: Base = base,
): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await send(
        {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: JSON.stringify({ jsonrpc: '2.0', id: 7, method, params }),
        },
        target,
    );
    return { status: response.status, body: await response.json() };
}

async function callTool(
    name: string,
    args: object | undefined,
    headers: Record<string, string> = {},
): Promise<Record<string, unknown>> {
    const { body } = await rpc(
        'tools/call',
        { name, arguments: args },
        headers,
    );
    return body;
}

async function toolNames(headers: Record<string, string> = {}) {
    const { body } = await rpc('tools/list', {}, headers);
    const result = body.result as { tools: { name: string }[] };
    return result.tools.map((tool) => tool.name);
}

describe('MCP endpoint — lifecycle and transport', () => {
    it('initializes with the requested protocol version, server info and instructions', async () => {
        const { status, body } = await rpc('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'test', version: '1' },
        });

        expect(status).toBe(200);
        expect(body).toEqual({
            jsonrpc: '2.0',
            id: 7,
            result: {
                protocolVersion: '2025-06-18',
                capabilities: { tools: {} },
                serverInfo: {
                    name: 'mcp-test',
                    title: 'MCP Test',
                    version: '1.2.3',
                },
                instructions: 'Invite people, then add numbers.',
            },
        });
    });

    it('answers an unsupported requested version with its latest', async () => {
        const { body } = await rpc('initialize', {
            protocolVersion: '1999-01-01',
        });
        expect(body.result).toMatchObject({ protocolVersion: '2025-11-25' });
    });

    it('answers an unknown method (e.g. server/discover) with method-not-found', async () => {
        const { status, body } = await rpc('server/discover');
        expect(status).toBe(200);
        expect(body).toEqual({
            jsonrpc: '2.0',
            id: 7,
            error: {
                code: -32601,
                message: 'Method not found: server/discover',
            },
        });
    });

    it('accepts a notification with 202 and no body', async () => {
        const response = await send({
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized',
            }),
        });
        expect(response.status).toBe(202);
        expect(await response.text()).toBe('');
    });

    it('answers ping', async () => {
        const { body } = await rpc('ping');
        expect(body.result).toEqual({});
    });

    it('refuses GET and DELETE with 405: no SSE stream, no session', async () => {
        for (const method of ['GET', 'DELETE']) {
            const response = await send({ method });
            expect(response.status).toBe(405);
            expect(response.headers.get('allow')).toBe('POST');
        }
    });

    it('answers malformed JSON with a parse error and a batch with invalid request', async () => {
        const malformed = await send({
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{"jsonrpc":',
        });
        expect(malformed.status).toBe(400);
        expect(await malformed.json()).toMatchObject({
            error: { code: -32700 },
        });

        const batch = await send({
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'ping' }]),
        });
        expect(batch.status).toBe(400);
        expect(await batch.json()).toMatchObject({ error: { code: -32600 } });
    });

    it('refuses an unsupported MCP-Protocol-Version header with 400', async () => {
        const { status } = await rpc('ping', undefined, {
            'mcp-protocol-version': '1999-01-01',
        });
        expect(status).toBe(400);
        expect(
            (
                await rpc('ping', undefined, {
                    'mcp-protocol-version': '2025-11-25',
                })
            ).status,
        ).toBe(200);
    });
});

describe('MCP endpoint — origin and host', () => {
    it('refuses an Origin not on the allow-list with 403', async () => {
        const { status } = await rpc('ping', undefined, {
            origin: 'https://evil.example',
        });
        expect(status).toBe(403);
    });

    it('allows a listed Origin and a request with no Origin', async () => {
        expect(
            (
                await rpc('ping', undefined, {
                    origin: 'https://app.example.com',
                })
            ).status,
        ).toBe(200);
        expect((await rpc('ping')).status).toBe(200);
    });

    it('refuses an unlisted Host when an allow-list is configured', async () => {
        const hostBase = createBase([ToolboxRpc], {
            allowedHosts: ['127.0.0.1:8787'],
        });
        expect((await rpc('ping', undefined, {}, hostBase)).status).toBe(403);
    });
});

describe('MCP endpoint — tools', () => {
    it('lists tools with schemas, filtered by the caller’s session access', async () => {
        expect(await toolNames()).toEqual(['toolbox_add', 'toolbox_invite']);
        expect(await toolNames({ 'x-test-roles': 'Member' })).toEqual([
            'toolbox_add',
            'toolbox_invite',
        ]);
        expect(await toolNames({ 'x-test-roles': 'Administrator' })).toEqual([
            'toolbox_add',
            'toolbox_admin_reset',
            'toolbox_invite',
        ]);
    });

    it('describes each tool: named arguments, an inlined class, descriptions and hints', async () => {
        const { body } = await rpc('tools/list');
        const tools = (body.result as { tools: unknown[] }).tools;

        expect(tools).toEqual([
            {
                name: 'toolbox_add',
                title: 'Add',
                description: 'Adds two numbers.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        a: { type: 'number', description: 'The first.' },
                        b: { type: 'number', default: 10 },
                    },
                    required: ['a'],
                },
                annotations: { readOnlyHint: true },
            },
            {
                name: 'toolbox_invite',
                description: 'Invites someone by email.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        email: {
                            type: 'string',
                            pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
                            description: 'Who to invite.',
                        },
                    },
                    required: ['email'],
                },
            },
        ]);
    });

    it('wraps a primitive result in structuredContent and renders it as text', async () => {
        expect(await callTool('toolbox_invite', { email: 'a@b.co' })).toEqual({
            jsonrpc: '2.0',
            id: 7,
            result: {
                content: [{ type: 'text', text: '"invited a@b.co"' }],
                structuredContent: { result: 'invited a@b.co' },
            },
        });
    });

    it('maps named arguments to positional ones, applying defaults', async () => {
        expect((await callTool('toolbox_add', { a: 2 })).result).toMatchObject({
            structuredContent: { sum: 12 },
        });
        expect(
            (await callTool('toolbox_add', { a: 2, b: 3 })).result,
        ).toMatchObject({ structuredContent: { sum: 5 } });
    });

    it('fails validation the same way the RPC route does, as a tool error', async () => {
        const viaMcp = (await callTool('toolbox_invite', { email: 'nope' }))
            .result as { isError: boolean; content: { text: string }[] };

        const viaRpc = (await (
            await send({
                path: '/__rpc',
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    id: 'r1',
                    type: 'request',
                    procedure: 'invite',
                    arguments: [{ email: 'nope' }],
                    __protocol: 'BaseRPC',
                    __version: '1.0',
                }),
            })
        ).json()) as {
            error: { code: string; message: string; cause?: unknown };
        };

        expect(viaMcp.isError).toBe(true);
        expect(viaRpc.error.code).toBe('VALIDATION_ERROR');
        expect(viaMcp.content[0].text).toBe(
            `${viaRpc.error.message}\n${JSON.stringify(viaRpc.error.cause)}`,
        );
    });

    it('refuses a hidden tool through access control before reading its arguments', async () => {
        // invalid arguments would fail validation if they were read
        const response = await callTool(
            'toolbox_admin_reset',
            { email: 'nope' },
            { 'x-test-roles': 'Member' },
        );
        expect(response.error).toEqual({
            code: -32602,
            message: 'Unknown tool: toolbox_admin_reset',
        });
    });

    it('answers a hidden tool exactly as a tool that doesn’t exist', async () => {
        const callBody = (name: string) =>
            send({
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/call',
                    params: { name, arguments: {} },
                }),
            });
        const hidden = await callBody('toolbox_admin_reset');
        const missing = await callBody('toolbox_nope');

        expect(hidden.status).toBe(missing.status);
        // byte for byte, apart from the name the caller sent
        expect(
            (await hidden.text()).replace('toolbox_admin_reset', 'NAME'),
        ).toBe((await missing.text()).replace('toolbox_nope', 'NAME'));
    });

    it('runs a hidden tool for a caller allowed to see it', async () => {
        expect(
            (
                await callTool(
                    'toolbox_admin_reset',
                    { email: 'a@b.co' },
                    { 'x-test-roles': 'Administrator' },
                )
            ).result,
        ).toMatchObject({ structuredContent: { result: 'reset a@b.co' } });
    });

    it('does not expose a procedure without the mcp option', async () => {
        expect(
            await toolNames({ 'x-test-roles': 'Administrator' }),
        ).not.toContain('toolbox_rpc_only');
        expect((await callTool('toolbox_rpc_only', {})).error).toMatchObject({
            code: -32602,
        });
    });

    it('answers credentials the provider rejects with HTTP 401, not the anonymous list', async () => {
        const { status, body } = await rpc(
            'tools/list',
            {},
            {
                'x-test-roles': 'reject',
            },
        );
        expect(status).toBe(401);
        expect(body.error).toMatchObject({
            message: 'The access token has expired.',
        });
    });
});

async function bootError(service: Constructor<object>, visibility?: 'public') {
    return createBase([service], {}, visibility).initialize();
}

describe('MCP endpoint — boot validation', () => {
    it('fails boot on a blank description', async () => {
        @RpcService({ visibility: 'public' })
        class BlankDescriptionRpc {
            @Rpc({ mcp: { description: '   ' } })
            async blank(): Promise<void> {}
        }
        await expect(bootError(BlankDescriptionRpc)).rejects.toThrow(
            'MCP tool BlankDescriptionRpc.blank has a blank description',
        );
    });

    it('fails boot when the procedure isn’t public', async () => {
        @RpcService()
        class InternalToolRpc {
            @Rpc({ mcp: { description: 'Does a thing.' } })
            async internalThing(): Promise<void> {}
        }
        await expect(bootError(InternalToolRpc)).rejects.toThrow(
            "MCP tool InternalToolRpc.internalThing resolves to 'internal' RPC visibility",
        );
    });

    it('fails boot on two tools with the same name', async () => {
        @RpcService({ visibility: 'public' })
        class DuplicateToolRpc {
            @Rpc({ mcp: { description: 'One.', name: 'same' } })
            async first(): Promise<void> {}

            @Rpc({ mcp: { description: 'Two.', name: 'same' } })
            async second(): Promise<void> {}
        }
        await expect(bootError(DuplicateToolRpc)).rejects.toThrow(
            "MCP tools DuplicateToolRpc.first and DuplicateToolRpc.second are both named 'same'",
        );
    });

    it('fails boot on an invalid tool name', async () => {
        @RpcService({ visibility: 'public' })
        class BadNameRpc {
            @Rpc({ mcp: { description: 'Bad.', name: 'bad name' } })
            async badName(): Promise<void> {}
        }
        await expect(bootError(BadNameRpc)).rejects.toThrow(
            "is named 'bad name', which isn't a valid MCP tool name",
        );
    });

    it('fails boot on an unnamed argument of a multi-argument tool', async () => {
        @RpcService({ visibility: 'public' })
        class UnnamedArgumentRpc {
            @Rpc({ mcp: { description: 'Two args.' } })
            async unnamed(
                @RpcArgument(() => String, { name: 'first' }) first: string,
                @RpcArgument(() => String) second: string,
            ): Promise<string> {
                return first + second;
            }
        }
        await expect(bootError(UnnamedArgumentRpc)).rejects.toThrow(
            'MCP tool UnnamedArgumentRpc.unnamed has an argument at index 1 without a name',
        );
    });

    it('fails boot on a parameter without @RpcArgument', async () => {
        @RpcService({ visibility: 'public' })
        class UndecoratedParameterRpc {
            @Rpc({ mcp: { description: 'Raw.' } })
            async raw(payload: unknown): Promise<unknown> {
                return payload;
            }
        }
        await expect(bootError(UndecoratedParameterRpc)).rejects.toThrow(
            'MCP tool UndecoratedParameterRpc.raw has a parameter at index 0 without @RpcArgument',
        );
    });

    it('takes the worker’s rpc visibility into account', async () => {
        @RpcService()
        class WorkerPublicRpc {
            @Rpc({ mcp: { description: 'Public via the worker.' } })
            async workerPublic(): Promise<string> {
                return 'ok';
            }
        }
        await expect(
            bootError(WorkerPublicRpc, 'public'),
        ).resolves.toBeUndefined();
    });
});
