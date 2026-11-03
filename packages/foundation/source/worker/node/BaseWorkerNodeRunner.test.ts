// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { once } from 'events';
import { AddressInfo, createConnection, createServer, Server } from 'net';
import { networkInterfaces } from 'os';

import { BaseServerSettings } from '../../base/BaseServerSettings';
import { BaseWorker } from '../BaseWorker';
import { BaseWorkerNodeRunner } from './BaseWorkerNodeRunner';

/**
 * An IPv4 address of this machine that isn't loopback, or `undefined` when
 * the machine has none (some CI sandboxes only have `lo`).
 */
const nonLoopbackAddress = Object.values(networkInterfaces())
    .flat()
    .find(
        (address) => address?.family === 'IPv4' && !address.internal,
    )?.address;

const itWithNonLoopbackAddress = nonLoopbackAddress ? it : it.skip;

async function freePort(): Promise<number> {
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as AddressInfo).port;
    server.close();
    await once(server, 'close');
    return port;
}

/**
 * Resolves whether a TCP connection to the address is accepted.
 */
async function acceptsConnection(host: string, port: number): Promise<boolean> {
    const socket = createConnection({ host, port });
    try {
        await once(socket, 'connect');
        return true;
    } catch {
        return false;
    } finally {
        socket.destroy();
    }
}

function createRunner(server: BaseServerSettings): BaseWorkerNodeRunner {
    return new BaseWorkerNodeRunner(
        BaseWorker.create({
            name: 'node-runner-test',
            title: 'Node Runner Test',
            version: '1.0.0',
            modules: [],
            services: [],
            server: { '@default': server },
        }),
    );
}

describe('BaseWorkerNodeRunner', () => {
    const originalPort = process.env.PORT;
    let runner: BaseWorkerNodeRunner | undefined;

    beforeEach(() => {
        // process.env.PORT outranks settings; keep it from leaking in
        delete process.env.PORT;
    });

    afterEach(async () => {
        await runner?.stop();
        runner = undefined;
        if (originalPort !== undefined) {
            process.env.PORT = originalPort;
        }
    });

    itWithNonLoopbackAddress(
        'binds the configured host and refuses connections on other addresses',
        async () => {
            const port = await freePort();
            runner = createRunner({ port, host: '127.0.0.1' });
            await runner.start({ ENVIRONMENT: 'Test' });

            expect(await acceptsConnection('127.0.0.1', port)).toBe(true);
            expect(await acceptsConnection(nonLoopbackAddress!, port)).toBe(
                false,
            );
        },
    );

    itWithNonLoopbackAddress(
        'binds every interface when no host is configured',
        async () => {
            const port = await freePort();
            runner = createRunner({ port });
            await runner.start({ ENVIRONMENT: 'Test' });

            expect(await acceptsConnection('127.0.0.1', port)).toBe(true);
            expect(await acceptsConnection(nonLoopbackAddress!, port)).toBe(
                true,
            );
        },
    );

    it('rejects start() when the port is already taken', async () => {
        const port = await freePort();
        const occupant: Server = createServer();
        occupant.listen(port, '127.0.0.1');
        await once(occupant, 'listening');
        try {
            runner = createRunner({ port, host: '127.0.0.1' });
            await expect(
                runner.start({ ENVIRONMENT: 'Test' }),
            ).rejects.toMatchObject({ code: 'EADDRINUSE' });
        } finally {
            occupant.close();
            await once(occupant, 'close');
        }
    });

    it('rejects a URL-valued host before binding', async () => {
        runner = createRunner({
            port: await freePort(),
            host: 'https://app-test.example.workers.dev',
        });
        await expect(runner.start({ ENVIRONMENT: 'Test' })).rejects.toThrow(
            "server['@default'].host must be a hostname or IP address",
        );
    });

    it('stops listening once stop() resolves', async () => {
        const port = await freePort();
        runner = createRunner({ port, host: '127.0.0.1' });
        await runner.start({ ENVIRONMENT: 'Test' });

        await runner.stop();

        expect(await acceptsConnection('127.0.0.1', port)).toBe(false);
    });
});
