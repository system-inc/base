// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { once } from 'events';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { createServerAdapter } from '@whatwg-node/server';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import {
    CRON_ANY_TRIGGER,
    cronExpressionIsValid,
} from '@system-inc/base-common/cron/CronExpression';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { getBaseMetadata } from '../../base/BaseMetadata';
import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { EnvironmentVariables } from '../../configuration/EnvironmentVariables';
import { PlatformType } from '../../configuration/Platform';
import { DetachedExecutionContext } from '../../internal/execution-context/DetachedExecutionContext';
import { CronRun, CronScheduler } from '../../internal/scheduled/CronScheduler';
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
 * The started runners, which a shutdown signal stops.
 */
const _runners = new Set<BaseWorkerNodeRunner>();

/**
 * Creates a nodejs server and runs the worker on it, and fires the
 * worker's scheduled executables on their cron triggers (Node has no cron
 * service of its own).
 */
export class BaseWorkerNodeRunner {
    private httpServer: Server | undefined = undefined;
    private scheduler: CronScheduler | undefined = undefined;
    private stopping: Promise<void> | undefined = undefined;
    private requestTimeout = DefaultRequestTimeout;
    private readonly webSocketServer: NodeWebSocketServer;

    protected isStarted: boolean = false;

    constructor(private readonly worker: BaseWorker) {
        this.webSocketServer = new NodeWebSocketServer(worker);
    }

    /**
     * Registers fetch as the request handler for the Node.js server, then starts the node server.
     */
    async start(environment: EnvironmentVariables): Promise<void> {
        // This runner is the Node platform, whatever the environment says.
        // Left to the Cloudflare default, request routing would trust the
        // internal `.base-internal` hostname — which on Node comes straight
        // from the client's Host header.
        const environmentVariables: EnvironmentVariables = {
            ...environment,
            PLATFORM: PlatformType.Node,
        };
        if (this.isStarted) {
            throw new Error(
                'NodeWorker.start() - NodeWorker has already been started.',
            );
        }

        this.isStarted = true;
        _runners.add(this);

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

        // bind to the configured host, or every interface when unset
        const host = serverConfig?.host;
        if (host !== undefined && host.includes('/')) {
            throw new Error(
                `BaseWorkerNodeRunner.start() - server['${runConfigName}'].host must be a hostname or IP address to bind to, got '${host}'.`,
            );
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

        // a scheduled run goes through the same entry point Cloudflare's
        // cron service calls, so it runs on a @scheduled container
        const runScheduled: CronRun = (cron, scheduledTime) =>
            this.worker.scheduled(
                nodeScheduledEvent(cron, scheduledTime),
                environmentVariables,
                new DetachedExecutionContext(),
            );
        // validated before binding, so a bad trigger fails start()
        const triggers = scheduledTriggers(
            base.configuration,
            serverConfig?.scheduled,
        );
        const testScheduled =
            environmentVariables.TEST_SCHEDULED === 'true' &&
            base.configuration.runtime.mode.isLocal;

        const serverAdapter = createServerAdapter(async (request, _env) => {
            if (
                testScheduled &&
                new URL(request.url).pathname === '/__scheduled'
            ) {
                return runTestScheduled(new URL(request.url), runScheduled);
            }
            return await this.worker.fetch(
                request,
                environmentVariables,
                new DetachedExecutionContext(),
            );
        });

        // setup the server and start listening
        const requestTimeout =
            serverConfig?.requestTimeout ?? DefaultRequestTimeout;
        this.requestTimeout = requestTimeout;
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
        // wait until the server is bound, so a bind failure (port in use,
        // address not on this machine) rejects start() instead of
        // surfacing as an unhandled 'error' event
        this.httpServer.listen(port, host);
        await once(this.httpServer, 'listening');
        Logger.info(
            LogCategory.Base,
            'Listening at %s ...',
            formatListenAddress(this.httpServer.address() as AddressInfo),
        );
        Logger.info(LogCategory.Base, 'Request timeout: %dms', requestTimeout);

        if (triggers.length > 0) {
            this.scheduler = new CronScheduler(triggers, runScheduled);
            this.scheduler.start();
            Logger.info(
                LogCategory.Scheduled,
                'Firing cron triggers (UTC): %s',
                triggers.join(', '),
            );
        }
        if (testScheduled) {
            Logger.info(
                LogCategory.Scheduled,
                'Fire a trigger by hand: GET /__scheduled?cron=<expression>',
            );
        }

        await _delegate?.onStart?.();
    }

    /**
     * Stops the runner: cancels the cron timers, stops accepting
     * connections, then waits for in-flight scheduled runs and requests —
     * up to the request timeout, after which remaining connections are
     * closed. Idempotent, and safe to call when the runner never started.
     */
    stop(): Promise<void> {
        this.stopping ??= this.shutdown();
        return this.stopping;
    }

    private async shutdown(): Promise<void> {
        _runners.delete(this);
        const draining: Promise<unknown>[] = [];
        const scheduler = this.scheduler;
        const httpServer = this.httpServer;
        this.scheduler = undefined;
        this.httpServer = undefined;

        if (scheduler) {
            draining.push(scheduler.stop());
        }
        if (httpServer?.listening) {
            draining.push(once(httpServer, 'close'));
            httpServer.close();
            httpServer.closeIdleConnections();
        }
        if (draining.length === 0) {
            return;
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        const timedOut = await Promise.race([
            Promise.allSettled(draining).then(() => false),
            new Promise<boolean>((resolve) => {
                timer = setTimeout(() => resolve(true), this.requestTimeout);
            }),
        ]);
        clearTimeout(timer);
        if (timedOut) {
            Logger.warn(
                LogCategory.Base,
                'Shutdown waited %dms for in-flight work; closing remaining connections.',
                this.requestTimeout,
            );
            httpServer?.closeAllConnections();
        }
    }
}

/**
 * The cron triggers this runner fires: `scheduled.triggers`, or by default
 * every cron expression a registered executable is registered against.
 * None when no executables are registered or the run config sets
 * `scheduled: false`.
 */
function scheduledTriggers(
    configuration: BaseConfiguration,
    enabled: boolean | undefined,
): string[] {
    const scheduled = configuration.scheduled;
    if (!scheduled || enabled === false) {
        return [];
    }
    const triggers =
        scheduled.triggers ??
        getBaseMetadata().scheduled.getTriggersFor(scheduled.executables);
    for (const trigger of triggers) {
        if (trigger === CRON_ANY_TRIGGER || !cronExpressionIsValid(trigger)) {
            throw new Error(
                `BaseWorkerNodeRunner.start() - scheduled.triggers has '${trigger}', which isn't a cron expression the runner can schedule.`,
            );
        }
    }
    if (triggers.length === 0) {
        Logger.warn(
            LogCategory.Scheduled,
            'Scheduled executables are registered, but no cron trigger fires them. Set scheduled.triggers to fire CRON_ANY_TRIGGER executables on Node.',
        );
    }
    return triggers;
}

/**
 * The event Cloudflare's cron service would deliver, for a trigger the
 * runner fires itself. `noRetry()` is a no-op: Node never retries a run.
 */
function nodeScheduledEvent(
    cron: string,
    scheduledTime: number,
): ScheduledEvent {
    return {
        type: 'scheduled',
        cron,
        scheduledTime,
        noRetry: () => {},
    } as unknown as ScheduledEvent;
}

/**
 * Serves `/__scheduled?cron=<expression>` in local mode under `base
 * develop --test-scheduled`, as `wrangler dev --test-scheduled` does:
 * fires the trigger now and answers once it completes.
 */
async function runTestScheduled(url: URL, run: CronRun): Promise<Response> {
    const cron = url.searchParams.get('cron');
    if (!cron) {
        return new Response(
            'Name the trigger to fire: /__scheduled?cron=<expression>',
            { status: 400 },
        );
    }
    try {
        await run(cron, Date.now());
        return new Response('Ran scheduled event');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return new Response(`Scheduled event failed: ${message}`, {
            status: 500,
        });
    }
}

/**
 * Formats a bound server address as a URL, marking a wildcard bind as
 * listening on every interface.
 */
function formatListenAddress(address: AddressInfo): string {
    const host =
        address.family === 'IPv6' ? `[${address.address}]` : address.address;
    const isWildcard =
        address.address === '::' || address.address === '0.0.0.0';
    return `http://${host}:${address.port}${isWildcard ? ' (all interfaces)' : ''}`;
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
    await Promise.all([..._runners].map((runner) => runner.stop()));
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
