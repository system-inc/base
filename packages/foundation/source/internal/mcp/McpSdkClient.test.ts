// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { PlatformType } from '../../configuration/Platform';
import { Rpc } from '../../rpc/decorators/Rpc';
import { RpcArgument } from '../../rpc/decorators/RpcArgument';
import { RpcService } from '../../rpc/decorators/RpcService';
import { BaseWorker } from '../../worker/BaseWorker';
import { BaseExecutionContext } from '../execution-context/BaseExecutionContext';

@RpcService({ visibility: 'public' })
class GreeterRpc {
    @Rpc({ mcp: { description: 'Greets someone by name.' } })
    async greet(
        @RpcArgument(() => String, {
            name: 'name',
            description: 'Who to greet.',
        })
        name: string,
    ): Promise<{ greeting: string }> {
        return { greeting: `Hello, ${name}!` };
    }
}

const base = BaseWorker.create({
    name: 'mcp-sdk-test',
    title: 'MCP SDK Test',
    version: '1.0.0',
    modules: [],
    services: [GreeterRpc],
    rpc: { service: {} },
    mcp: { instructions: 'Greet people.' },
}).getBase({
    PLATFORM: PlatformType.CloudflareWorker,
    ENVIRONMENT: 'Production',
});

/**
 * The official MCP TypeScript SDK client, talking to the endpoint
 * in-process: its transport's fetch hands each request to the worker.
 */
describe('the MCP SDK client', () => {
    let client: Client;

    beforeAll(async () => {
        const transport = new StreamableHTTPClientTransport(
            new URL('https://worker.example.com/mcp'),
            {
                fetch: (url, init) =>
                    base.handleRequest(
                        new Request(url, init),
                        new BaseExecutionContext(performance.now()),
                    ),
            },
        );
        client = new Client({ name: 'base-test', version: '1.0.0' });
        await client.connect(transport);
    });

    afterAll(async () => {
        await client.close();
    });

    it('negotiates the protocol and reads the server info and instructions', () => {
        expect(client.getServerVersion()).toEqual({
            name: 'mcp-sdk-test',
            title: 'MCP SDK Test',
            version: '1.0.0',
        });
        expect(client.getInstructions()).toBe('Greet people.');
    });

    it('lists the tools', async () => {
        const { tools } = await client.listTools();
        expect(tools).toEqual([
            {
                name: 'greeter_greet',
                description: 'Greets someone by name.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Who to greet.' },
                    },
                    required: ['name'],
                },
            },
        ]);
    });

    it('calls a tool', async () => {
        const result = await client.callTool({
            name: 'greeter_greet',
            arguments: { name: 'Ada' },
        });
        expect(result).toEqual({
            content: [{ type: 'text', text: '{"greeting":"Hello, Ada!"}' }],
            structuredContent: { greeting: 'Hello, Ada!' },
        });
    });

    it('pings', async () => {
        await expect(client.ping()).resolves.toEqual({});
    });
});
