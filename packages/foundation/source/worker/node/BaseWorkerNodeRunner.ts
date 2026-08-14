// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { createServer, Server } from 'http';
import { createServerAdapter } from '@whatwg-node/server';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { EnvironmentVariables } from '../../configuration/EnvironmentVariables';
import { DetachedExecutionContext } from '../../internal/execution-context/DetachedExecutionContext';
import { NodeWebSocketServer } from '../../web-socket/node/NodeWebSocketServer';
import { BaseWorker } from '../BaseWorker';
import { BaseWorkerDelegate } from '../BaseWorkerDelegate';

/**
 * The default port to use when starting the Node.js server.
 * Only used if the port is not specified in the settings.
 */
const DefaultPort = 8787; // 8787 to match wrangler default port
const DefaultRequestTimeout = 30_000; // 30 seconds

let _delegate: BaseWorkerDelegate | null = null;

/**
 * Creates a nodejs server and runs the worker on it.
 */
export class BaseWorkerNodeRunner {
    private httpServer: Server | undefined = undefined;
    private readonly webSocketServer: NodeWebSocketServer;

    protected isStarted: boolean = false;

    constructor(private readonly worker: BaseWorker) {
        this.webSocketServer = new NodeWebSocketServer(worker);
    }

    /**
     * Registers fetch as the request handler for the Node.js server, then starts the node server.
     */
    async start(environmentVariables: EnvironmentVariables): Promise<void> {
        if (this.isStarted) {
            throw new Error(
                'NodeWorker.start() - NodeWorker has already been started.',
            );
        }

        this.isStarted = true;

        const serverAdapter = createServerAdapter(async (request, _env) => {
            // TODO forward requests for queues and cron jobs to the entrypoint
            return await this.worker.fetch(
                request,
                environmentVariables,
                new DetachedExecutionContext(),
            );
        });

        // Resolve server settings from the named configuration
        const runConfigName = environmentVariables.RUN_CONFIG
            ? environmentVariables.RUN_CONFIG
            : DefaultConfigurationKey;
        const serverConfig = this.worker.settings.server?.[runConfigName];

        // set the port if one is specified in the settings
        let port = DefaultPort;
        if (process.env.PORT) {
            port = parseInt(process.env.PORT, 10);
        } else if (environmentVariables.PORT) {
            port = parseInt(environmentVariables.PORT, 10);
        } else if (serverConfig?.port) {
            port = serverConfig.port;
        }

        // we need to manually initialize base so the container and
        // all dependencies are available to the delegate
        const base = this.worker.getBase(environmentVariables);
        await base.initialize();

        if (this.worker.settings.delegate) {
            if (base.delegate) {
                _delegate = base.delegate;
            }
        }

        // setup the server and start listening
        const requestTimeout =
            serverConfig?.requestTimeout ?? DefaultRequestTimeout;
        // whatwg-node's adapter returns a Promise but writes the response
        // itself; Node's createServer expects a void-returning handler.
        // The shim aligns the signatures and discards the adapter's
        // informational Promise.
        this.httpServer = createServer((request, response) => {
            void serverAdapter(request, response);
        });
        this.httpServer.timeout = requestTimeout;
        this.httpServer.on('timeout', (socket) => {
            Logger.warn(
                LogCategory.Base,
                'Request timed out after %dms, destroying socket.',
                requestTimeout,
            );
            socket.destroy();
        });
        this.webSocketServer.listenForConnections(
            this.httpServer,
            environmentVariables,
        );
        this.httpServer.listen(port);
        Logger.info(
            LogCategory.Base,
            'Listening at http://127.0.0.1:%d ...',
            port,
        );
        Logger.info(LogCategory.Base, 'Request timeout: %dms', requestTimeout);

        await _delegate?.onStart?.();
    }
}

/**
 * Sometimes a signal will emit multiple times, this prevents
 * calling the lifecycle listener multiple times
 */
let _isExiting = false;

/**
 * Block for handling process exit events, we catch the event
 * and call the lifecycle listener's onStop() method
 * then we exit the process when all work is complete.
 */
async function handleShutdownSignal(evt: string, args: unknown): Promise<void> {
    if (_isExiting) {
        return;
    }
    _isExiting = true;
    Logger.info(LogCategory.Base, 'NodeWorker caught:', evt, args);
    let result: number | void = 0;
    if (_delegate?.onStop) {
        result = await _delegate.onStop();
    }
    Logger.info(LogCategory.Base, 'NodeWorker exiting with:', result);
    if (typeof result === 'number') {
        process.exit(result);
    } else {
        process.exit(0);
    }
}

// Graceful shutdown signals — these are safe to handle.
['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM'].forEach(
    (evt) =>
        process.on(evt, (args) => {
            handleShutdownSignal(evt, args).catch((error: unknown) => {
                // Don't lose error info while shutting down.
                Logger.error(
                    LogCategory.Base,
                    'NodeWorker shutdown handler failed:',
                    error,
                );
                process.exit(1);
            });
        }),
);

// Fatal signals (SIGSEGV, SIGBUS, SIGFPE, SIGILL, SIGTRAP, SIGABRT) and
// uncaughtException/unhandledRejection are intentionally NOT caught.
// The process is in a corrupt or unknown state — let it crash so the
// container runtime can restart it cleanly.
