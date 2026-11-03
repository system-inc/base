// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { IntegrationTestEnvironment } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';

const baseUrl = IntegrationTestEnvironment.get().client.getServerBaseUrl();

/**
 * Connects the official MCP SDK client to the worker's `/mcp` endpoint,
 * optionally signed in through the test session header.
 */
async function connect(session?: { roles: string[] }): Promise<Client> {
    const headers: Record<string, string> = session
        ? {
              'x-test-session': JSON.stringify({
                  accountId: 'a1',
                  actorId: 'a1',
                  roles: session.roles,
              }),
          }
        : {};
    const client = new Client({ name: 'base-integration', version: '1.0.0' });
    await client.connect(
        new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
            requestInit: { headers },
        }),
    );
    return client;
}

describe('MCP endpoint (official SDK client)', () => {
    const clients: Client[] = [];

    afterAll(async () => {
        await Promise.all(clients.map((client) => client.close()));
    });

    async function connected(session?: { roles: string[] }) {
        const client = await connect(session);
        clients.push(client);
        return client;
    }

    test('initializes with the worker’s identity and instructions', async () => {
        const client = await connected();
        expect(client.getServerVersion()).toMatchObject({
            name: 'test-worker',
            title: 'Test Worker',
        });
        expect(client.getInstructions()).toBe(
            'Tools for exercising the MCP endpoint in tests.',
        );
    });

    test('lists only the tools the caller may use', async () => {
        const anonymous = await connected();
        const admin = await connected({ roles: ['Administrator'] });

        const anonymousNames = (await anonymous.listTools()).tools.map(
            (tool) => tool.name,
        );
        const adminNames = (await admin.listTools()).tools.map(
            (tool) => tool.name,
        );

        expect(anonymousNames).toEqual(['tools_shout']);
        expect(adminNames).toEqual(['tools_admin_secret', 'tools_shout']);
    });

    test('describes each tool with a schema generated in the bundled worker', async () => {
        const admin = await connected({ roles: ['Administrator'] });
        const { tools } = await admin.listTools();

        expect(tools).toEqual([
            {
                name: 'tools_admin_secret',
                description:
                    'Returns a labeled secret. Visible only to administrators.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        label: {
                            type: 'string',
                            maxLength: 20,
                            description: 'The label to attach to the secret.',
                        },
                    },
                    required: ['label'],
                },
            },
            {
                name: 'tools_shout',
                description: 'Returns the text in upper case.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        text: {
                            type: 'string',
                            description: 'The text to shout.',
                        },
                    },
                    required: ['text'],
                },
                annotations: { readOnlyHint: true },
            },
        ]);
    });

    test('calls a tool', async () => {
        const client = await connected();
        const result = await client.callTool({
            name: 'tools_shout',
            arguments: { text: 'hello' },
        });
        expect(result).toEqual({
            content: [{ type: 'text', text: '"HELLO"' }],
            structuredContent: { result: 'HELLO' },
        });
    });

    test('calls a session-guarded tool as a caller allowed to see it', async () => {
        const client = await connected({ roles: ['Administrator'] });
        const result = await client.callTool({
            name: 'tools_admin_secret',
            arguments: { label: 'launch' },
        });
        expect(result.structuredContent).toEqual({
            label: 'launch',
            secret: 'swordfish',
        });
    });

    test('reports invalid arguments as a tool error', async () => {
        const client = await connected({ roles: ['Administrator'] });
        const result = await client.callTool({
            name: 'tools_admin_secret',
            arguments: { label: 'far-too-long-for-the-limit' },
        });
        expect(result.isError).toBe(true);
    });

    test('answers a hidden tool as an unknown one', async () => {
        const client = await connected();
        await expect(
            client.callTool({
                name: 'tools_admin_secret',
                arguments: { label: 'launch' },
            }),
        ).rejects.toThrow('Unknown tool: tools_admin_secret');
    });
});

/**
 * Raw HTTP, below the SDK: the origin check must hold through the worker's
 * global middleware (its CORS settings allow every origin).
 */
describe('MCP endpoint origin check', () => {
    async function ping(headers: Record<string, string>) {
        return fetch(`${baseUrl}/mcp`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
        });
    }

    test('refuses a browser origin that is not allowed', async () => {
        const response = await ping({ origin: 'https://evil.example' });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
            error: { message: 'Origin not allowed: https://evil.example' },
        });
    });

    test('allows a request without an Origin header', async () => {
        const response = await ping({});
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            jsonrpc: '2.0',
            id: 1,
            result: {},
        });
    });
});
