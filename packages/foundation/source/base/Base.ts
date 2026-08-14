// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type GraphQLSchema } from 'graphql';
import { Router as IttyRouter, type Route, type RouterType } from 'itty-router';
import { instanceCachingFactory } from 'tsyringe';

import { HttpMethod } from '@system-inc/base-common/http/HttpMethod';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { LogLevel } from '@system-inc/base-common/logging/LogLevel';
import { DefaultRpcEndpoint } from '@system-inc/base-common/rpc/protocol/DefaultRpcEndpoint';
import { stringConcat } from '@system-inc/base-common/string/Utilities';
import { StopWatch } from '@system-inc/base-common/time/StopWatch';
import { BaseConfiguration } from '../configuration/BaseConfiguration';
import { PlatformType } from '../configuration/Platform';
import {
    BaseInjectionContainer,
    BaseInjectionContainerScope,
} from '../dependency-injection/BaseInjectionContainer';
import { BaseInjections } from '../dependency-injection/BaseInjections';
import { BaseEventBus } from '../event/BaseEventBus';
import {
    UnhandledExceptionEvent,
    UnhandledExceptionEventName,
} from '../event/UnhandledExceptionEvent';
import { type GqlServerProvider } from '../graphql/GqlServerProvider';
import { CloudflarePlatformDelegate } from '../internal/cloudflare/CloudflarePlatformDelegate';
import { createWorkerChildContainer } from '../internal/dependency-injection/InjectionContainers';
import { BaseExecutionContext } from '../internal/execution-context/BaseExecutionContext';
import { GqlDispatcher } from '../internal/graphql/GqlDispatcher';
import { NodePlatformDelegate } from '../internal/node/NodePlatformDelegate';
import { WorkerQueueConsumer } from '../internal/queue/consumer/WorkerQueueConsumer';
import { WorkerQueueService } from '../internal/queue/producer/WorkerQueueService';
import {
    BASE_REQUEST_BRAND,
    BaseRequest,
} from '../internal/request/BaseRequest';
import { BaseRequestContext } from '../internal/request/BaseRequestContext';
import { DeferredExecutor } from '../internal/request/DeferredExecutor';
import { RequestTimings } from '../internal/request/RequestTimings';
import { BaseRouter } from '../internal/router/BaseRouter';
import { DummyRouter } from '../internal/router/DummyRouter';
import { RpcDispatcher } from '../internal/rpc/RpcDispatcher';
import { ScheduledRunner } from '../internal/scheduled/ScheduledRunner';
import { WebSocketService } from '../internal/web-socket/WebSocketService';
import { WorkerQueueProcessorMessage } from '../queue/WorkerQueueMessage';
import { ScheduledExecutableContext } from '../scheduled/ScheduledExecutableContext';
import {
    BaseWebSocket,
    WebSocketInfo,
    WebSocketInfoRequestContextKey,
} from '../web-socket/WebSocketTypes';
import { BaseWorkerContext } from '../worker/BaseWorkerContext';
import { BaseWorkerDelegate } from '../worker/BaseWorkerDelegate';
import { BaseWorkerPlatformDelegate } from '../worker/BaseWorkerPlatformDelegate';

/**
 * The engine of a worker. Initializes the app from its
 * {@link BaseConfiguration} — binding GraphQL, RPC, WebSocket, and HTTP
 * routes — and turns each platform event (request, queue message, scheduled
 * run, WebSocket event) into work on a freshly scoped child container of the
 * worker's dependency-injection container.
 *
 * Applications don't construct this directly: `BaseWorker.create(settings)`
 * builds one lazily on the first event and drives it from the platform's
 * `fetch`/`queue`/`scheduled` handlers.
 */
export class Base {
    //region Public Properties

    get configuration(): BaseConfiguration {
        return this.context.configuration;
    }

    /**
     * Indicates whether Base has been initialized.
     *
     * @returns true if Base has been initialized, false otherwise.
     */
    get isInitialized(): boolean {
        return this._isInitialized;
    }
    private _isInitialized: boolean = false;

    // The in-flight initialization, shared by every concurrent caller so
    // they all await the *same* completion rather than racing ahead on a
    // prematurely-set flag. Cleared on failure so a later event can retry.
    private _initializePromise: Promise<void> | null = null;

    /**
     * The delegate for the Worker. Receives events from the Worker.
     */
    get delegate(): BaseWorkerDelegate | null {
        // check if we have a delegate specified and create it
        if (!this._delegate && this.configuration.delegate) {
            this._delegate = this.context.container.resolve(
                this.configuration.delegate,
            );
        }
        return this._delegate;
    }
    private _delegate: BaseWorkerDelegate | null = null;

    /**
     * The platform delegate for the Worker. Handles platform specific operations.
     */
    get platformDelegate(): BaseWorkerPlatformDelegate {
        // this isn't ideal, but it works for simple cases
        if (!this._platformDelegate) {
            const platform = this.configuration.runtime.platform;
            switch (platform.type) {
                case PlatformType.CloudflareWorker:
                case PlatformType.CloudflareDurableObject:
                    this._platformDelegate = new CloudflarePlatformDelegate();
                    break;
                case PlatformType.Node:
                    this._platformDelegate = new NodePlatformDelegate();
                    break;
                default:
                    throw new Error(
                        `Unsupported platform type: ${platform.type}`,
                    );
            }
        }
        return this._platformDelegate!;
    }
    private _platformDelegate: BaseWorkerPlatformDelegate | null = null;

    //endregion
    //region Private Properties

    /**
     * The router for the Base application.
     */
    private get router(): BaseRouter {
        if (!this._router) {
            // create the router implementation we will use
            // NOTE: if we are running on the cli we don't want to use the actual IttyRouter which
            // causes the cli to crash, so we just use a dummy object.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const router: RouterType<Route, any> = this.configuration.runtime
                .mode.isCommandLine
                ? DummyRouter()
                : IttyRouter();
            this._router = new BaseRouter(router, this.configuration);
        }
        return this._router;
    }
    private _router: BaseRouter | undefined = undefined;

    /**
     * The GraphQL service for the Base application. Lazily initialized when the first GraphQL request is received.
     */
    private _gqlDispatcher: GqlDispatcher | null = null;

    /**
     * The RPC handler for the Base application. May not be available if the Worker does not have RPC configured.
     * Lazily initialized when the first RPC request is received.
     */
    private _rpcDispatcher: RpcDispatcher | null = null;

    private get webSocketService(): WebSocketService {
        if (!this._webSocketService) {
            // Create the container the websocket service (and its delegates)
            // resolve from. Unlike the request/queue/scheduled containers this
            // one is long-lived — the socket delegates are stable singletons
            // that hold per-connection state across events — so it is drained
            // (not disposed) after each event, see drainWebSocketDeferredActions.
            this._webSocketContainer = this.createChildContainer('@websocket');

            Logger.info(
                LogCategory.Base,
                'Initializing websocket service.',
                this.configuration.webSocket?.delegates,
            );

            // attach each of the delegates to the websocket server
            this._webSocketService = new WebSocketService(
                this,
                {
                    delegates: this.configuration.webSocket?.delegates || [],
                    // pass the module-aggregated context mappings through, or
                    // WebSocketService.buildWebSocketInfo sees an empty list
                    // and never populates WebSocketInfo.context
                    mappings: this.configuration.webSocket?.mappings,
                },
                this._webSocketContainer,
            );
        }
        return this._webSocketService;
    }
    private _webSocketService: WebSocketService | null = null;
    private _webSocketContainer: BaseInjectionContainer | null = null;

    //endregion
    //region Public Methods

    constructor(readonly context: BaseWorkerContext) {}

    /**
     * Initializes this Base instance.
     * Base cannot be used until it has been initialized.
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        // A concurrent caller that arrives while the first initialization is
        // still awaiting must wait for that same run to finish — not skip
        // ahead against half-bound routes and uninitialized modules. And a
        // run that throws must not leave the instance permanently wedged;
        // clearing the promise lets the next event re-attempt.
        if (!this._initializePromise) {
            this._initializePromise = this.performInitialization().then(
                () => {
                    this._isInitialized = true;
                },
                (error) => {
                    this._initializePromise = null;
                    throw error;
                },
            );
        }
        return this._initializePromise;
    }

    private async performInitialization(): Promise<void> {
        // logging first so everything after it — including this boot log —
        // respects the configured threshold
        this.initializeLogging();

        Logger.info(
            LogCategory.Base,
            'Initializing Base with runtime: %s',
            this.configuration.runtime.toString(),
        );

        this.initializeGql();
        this.initializeWebSocketRoutes(); // sockets must be initialized before rpc
        this.initializeRpcRoute();

        // initialize all the modules, this gives all modules a chance to do some work before we start
        await this.initializeModules();

        // initialize the platform
        await this.platformDelegate.initializePlatform(this.configuration);

        // call the delegate initialization hook if it exists
        if (this.delegate?.onInitialize) {
            await this.delegate.onInitialize(this);
        }

        // bind the routes to finalize the initialization
        this.router.bindRoutes();
    }

    /**
     * Applies the logging configuration: the settings-level default and
     * per-category thresholds first, then the `LOG_LEVEL` environment
     * directive so a deploy-time override always wins where it speaks
     * (including per-category entries like `warn,rpc=debug`). Also
     * caches the request-log switch read on every request.
     */
    private initializeLogging(): void {
        const logging = this.configuration.logging;
        if (logging.level !== undefined) {
            Logger.setLevel(logging.level);
        }
        if (logging.categories !== undefined) {
            for (const [category, level] of Object.entries(
                logging.categories,
            )) {
                Logger.setLevel(level, category);
            }
        }
        if (logging.directive !== undefined) {
            Logger.configure(logging.directive);
        }
        this.requestLogEnabled = logging.requestLog;
    }

    /**
     * Cached `logging.requestLog` — read per request, so not worth a
     * configuration-getter allocation each time.
     */
    private requestLogEnabled = true;

    //#region Handlers

    /**
     * Initialize the worker and handle the request.
     *
     * @param request The incoming platform request.
     * @param executionContext The execution context for the event.
     * @param webSocketInfo WebSocket connection info when the request arrives
     * over an established WebSocket.
     * @returns The response produced by the router.
     */
    async handleRequest(
        request: Request,
        executionContext: BaseExecutionContext,
        webSocketInfo?: WebSocketInfo,
    ): Promise<Response> {
        await this.initialize();
        executionContext.stopWatch.split(RequestTimings.Init);

        // if we have rewrite rules in place then we need to rewrite the request
        if (this.configuration.router.rewrite) {
            request = this.rewriteRequest(
                request,
                this.configuration.router.rewrite,
            );
        }

        // create the container for the request and the request object
        const container = this.createChildContainer('@request');
        const baseRequest = await this.createBaseRequest(
            container,
            executionContext.stopWatch,
            request,
            webSocketInfo,
        );

        executionContext.stopWatch.split(RequestTimings.RequestInit);

        try {
            const response = await this.router.handleRequest(baseRequest);
            executionContext.stopWatch.stop(RequestTimings.ResponseInit);
            if (
                this.requestLogEnabled &&
                Logger.isEnabled(LogCategory.Base, LogLevel.Info)
            ) {
                Logger.info(
                    LogCategory.Base,
                    `${baseRequest.method} ${baseRequest.route} ${
                        response.status
                    } ${response.statusText} (${baseRequest.context.stopWatch.getTotalElapsedTime()}ms) ${
                        baseRequest.context.graphql
                            ? 'GraphQL: ' +
                              stringConcat(
                                  baseRequest.context.graphql.operations,
                              )
                            : baseRequest.context.rpc
                              ? 'RPC: ' + baseRequest.context.rpc
                              : ''
                    }`,
                );
            }
            if (Logger.isEnabled(LogCategory.Base, LogLevel.Debug)) {
                Logger.debug(
                    LogCategory.Base,
                    executionContext.stopWatch.toString(),
                );
            }
            return response;
        } catch (e) {
            Logger.error(LogCategory.Base, 'Error handling request', e);
            // anything escaping the router here is unhandled by definition
            // (the router converts handler errors to responses itself) — the
            // deferred drain in the finally below still delivers the event
            // even though the error rethrows
            baseRequest.context.eventBus.defer<UnhandledExceptionEvent>({
                name: UnhandledExceptionEventName,
                error: e,
                surface: 'http',
                requestId: baseRequest.context.requestId,
                ipAddress: baseRequest.context.ipAddress,
                userAgent: baseRequest.context.userAgent,
                detail: `${baseRequest.method} ${baseRequest.route}`,
            });
            throw e;
        } finally {
            await this.runDeferredActions(executionContext, container);
        }
    }

    /**
     * Initialize the worker and handle the message (queue).
     *
     * @param messages The batch of queue messages to process.
     * @param executionContext The execution context for the event.
     */
    async handleMessages(
        messages: ReadonlyArray<Readonly<WorkerQueueProcessorMessage>>,
        executionContext: BaseExecutionContext,
    ): Promise<void> {
        await this.initialize();

        const queueContainer = this.createChildContainer('@queue');
        const queueConsumer = new WorkerQueueConsumer(
            queueContainer,
            this.configuration.queue?.processors ?? [],
        );

        try {
            await queueConsumer.processMessages(messages);
        } catch (e) {
            Logger.error(LogCategory.Base, 'Error handling message batch', e);
            throw e;
        } finally {
            await this.runDeferredActions(executionContext, queueContainer);
        }
    }

    /**
     * Initialize the worker and run the ScheduledExecutable(s).
     *
     * @param scheduledEvent The platform scheduled event (cron or alarm).
     * @param executionContext The execution context for the event.
     */
    async handleScheduled(
        scheduledEvent: ScheduledEvent,
        executionContext: BaseExecutionContext,
    ): Promise<void> {
        await this.initialize();

        const scheduledContainer = this.createChildContainer('@scheduled');

        try {
            // if we don't have a cron handler yet then create one
            const runner = new ScheduledRunner(
                scheduledContainer,
                this.configuration.scheduled?.executables || [],
                this.configuration.scheduled?.concurrency,
            );
            await runner.runScheduled(
                ScheduledExecutableContext.create(
                    scheduledEvent,
                    scheduledContainer,
                ),
                scheduledEvent.cron,
            );
        } catch (e) {
            // Rethrow like handleMessages does: a scheduled failure must
            // reach the platform so a cron run is reported failed and a
            // Durable Object alarm (CfDurableObject.alarm) is retried by
            // workerd, rather than swallowed as a false success.
            Logger.error(LogCategory.Base, 'Error handling scheduled event', e);
            throw e;
        } finally {
            await this.runDeferredActions(executionContext, scheduledContainer);
        }
    }

    //endregion
    //#region Web Socket Handlers

    async webSocketMessage(
        webSocket: BaseWebSocket,
        message: string | ArrayBuffer,
    ): Promise<void> {
        await this.initialize();
        try {
            await this.webSocketService.webSocketMessage(webSocket, message);
        } finally {
            await this.drainWebSocketDeferredActions();
        }
    }

    async webSocketClose(webSocket: BaseWebSocket): Promise<void> {
        await this.initialize();
        try {
            await this.webSocketService.webSocketClose(webSocket);
        } finally {
            await this.drainWebSocketDeferredActions();
        }
    }

    async webSocketError(
        webSocket: BaseWebSocket,
        error: unknown,
    ): Promise<void> {
        await this.initialize();
        try {
            await this.webSocketService.webSocketError(webSocket, error);
        } finally {
            await this.drainWebSocketDeferredActions();
        }
    }

    /**
     * Register a web socket with the web socket service.
     * Only called in Node environments.
     *
     * @param webSocket
     * @param webSocketInfo
     */
    async webSocketRegister(
        webSocket: BaseWebSocket,
        webSocketInfo: WebSocketInfo,
    ): Promise<void> {
        await this.initialize();
        this.webSocketService.webSocketRegister(webSocket, webSocketInfo);
    }

    /**
     * Unregister a web socket from the web socket service.
     * Only called in Node environments.
     *
     * @param webSocketInfo
     */
    async webSocketUnregister(webSocketInfo: WebSocketInfo): Promise<void> {
        await this.initialize();
        this.webSocketService.webSocketUnregister(webSocketInfo);
    }

    getGqlSchema(): Promise<GraphQLSchema> {
        return this.getGqlDispatcher().getSchema();
    }

    //endregion
    //region Private Methods

    private async createBaseRequest(
        container: BaseInjectionContainer,
        stopWatch: StopWatch,
        request: Request,
        webSocketInfo?: WebSocketInfo,
    ): Promise<BaseRequest> {
        const url = new URL(request.url);
        const params: Record<string, string> = {};
        for (const key of url.searchParams.keys()) {
            const value = url.searchParams.get(key);
            if (value) {
                params[key] = value;
            }
        }

        const context = new BaseRequestContext({
            request,
            configuration: this.configuration,
            container,
            stopWatch,
            platformDelegate: this.platformDelegate,
        });
        context.set(WebSocketInfoRequestContextKey, webSocketInfo);

        // `satisfies` guarantees every field BaseRequest adds on top of Request
        // is populated here — add a field to BaseRequest and this fails to
        // compile until it's filled in. cookies are populated later by the
        // router's global middleware once headers have been parsed.
        const extensions = {
            [BASE_REQUEST_BRAND]: true,
            route: url.pathname,
            params,
            query: {},
            cookies: {},
            context,
        } satisfies Omit<BaseRequest, keyof Request>;

        Object.assign(request, extensions);
        return request as Request & typeof extensions;
    }

    private getGqlDispatcher(): GqlDispatcher {
        if (this._gqlDispatcher) {
            return this._gqlDispatcher;
        }

        const gqlConfig = this.configuration.graphql;
        if (!gqlConfig) {
            throw new Error(
                'No GraphQL configuration found in your worker settings!',
            );
        }

        // get the graphql provider
        const gqlProviderType = gqlConfig.type;
        if (!gqlProviderType) {
            throw new Error(
                'No GraphQL type defined in your worker settings!' +
                    ' See GqlSettings for more info.',
            );
        }
        Logger.info(
            LogCategory.Base,
            'Initializing GraphQL with provider: %s',
            gqlProviderType.name,
        );
        const gqlProvider = Object.create(
            gqlProviderType.prototype,
        ) as GqlServerProvider;

        this._gqlDispatcher = new GqlDispatcher(gqlProvider, gqlConfig);
        return this._gqlDispatcher;
    }

    private initializeGql() {
        const gqlConfig = this.configuration.graphql;
        if (!gqlConfig) {
            return;
        }

        const gqlRoute = gqlConfig.route;

        const gqlMethods: HttpMethod[] = [HttpMethod.POST];
        if (this.configuration.graphql.graphiql) {
            gqlMethods.push(HttpMethod.GET);
        }

        Logger.info(
            LogCategory.Base,
            'Running GraphQL on route: %s, methods: %s',
            gqlRoute,
            gqlMethods.join(', '),
        );
        this.router.createRoute(
            gqlMethods,
            gqlRoute,
            async (request: BaseRequest) => {
                return this.getGqlDispatcher().handleRequest(request);
            },
        );
    }

    private initializeWebSocketRoutes() {
        const webSocketDelegates =
            this.configuration.webSocket?.delegates || [];
        if (webSocketDelegates.length === 0) {
            return;
        }

        for (const webSocketDelegate of webSocketDelegates) {
            this.router.createRoute(
                'GET',
                webSocketDelegate.path,
                async (request: BaseRequest) => {
                    try {
                        return await this.webSocketService.connectSocket(
                            request,
                        );
                    } catch (error) {
                        Logger.warn(
                            LogCategory.Base,
                            'Error handling ws connect request: %s',
                            error,
                        );
                        throw error;
                    }
                },
            );
        }
    }

    private initializeRpcRoute() {
        // don't startup the rpc if we don't have any rpc settings
        if (!this.configuration.rpcServer) {
            return;
        }

        const rpcServiceSettings = this.configuration.rpcServer;

        // get the settings and determine the endpoint
        const rpcRoute =
            this.configuration.rpcServer.route ?? DefaultRpcEndpoint;

        const getRpcHandler = () => {
            if (!this._rpcDispatcher) {
                this._rpcDispatcher = new RpcDispatcher(
                    this.configuration.runtime,
                    rpcServiceSettings,
                );
            }
            return this._rpcDispatcher;
        };

        // most of the RPCs should only handle POST requests. But we will support GET for RPCs that supports building WebSocket.
        this.router.createRoute(
            ['POST'],
            rpcRoute,
            async (request: BaseRequest) => {
                return await getRpcHandler().handleRequest(request);
            },
        );
    }

    private async initializeModules() {
        if (
            this.configuration.modules &&
            this.configuration.modules.length > 0
        ) {
            // loop through all the prepared modules and initialize them
            // now that the system components are ready
            for (const module of this.configuration.modules) {
                await module.onInitialize(this.configuration);
            }
        }
    }

    /**
     * Set up a DI container with all the default providers.
     *
     * @param scope The event scope the child container is created for.
     */
    private createChildContainer(
        scope: Exclude<BaseInjectionContainerScope, '@global' | '@worker'>,
    ): BaseInjectionContainer {
        // create the dependency container for the websocket
        const container = createWorkerChildContainer(
            this.context.container,
            scope,
        );

        container.register(BaseInjections.DeferredActions.toString(), {
            useFactory: instanceCachingFactory(() => new DeferredExecutor()),
        });

        container.register(BaseEventBus, {
            useFactory: instanceCachingFactory(
                () =>
                    new BaseEventBus(
                        this.configuration.eventBus?.listeners || [],
                        container,
                    ),
            ),
        });

        return container;
    }

    private rewriteRequest(
        request: Request,
        rewriteRules: Record<string, string>,
    ): Request {
        const url = new URL(request.url);
        for (const [pattern, replacement] of Object.entries(rewriteRules)) {
            if (url.pathname.includes(pattern)) {
                url.pathname = url.pathname.replace(pattern, replacement);
                const rewriteRequest = new Request(url.toString(), request);
                Logger.debug(
                    LogCategory.Base,
                    'Rewritten request: %s',
                    rewriteRequest.url,
                );
                return rewriteRequest;
            }
        }
        return request;
    }

    /**
     * Drains deferred actions queued while handling a websocket event
     * (queue publishes, deferred event-bus publishes, etc.).
     *
     * The websocket container is shared and long-lived (its delegates are
     * stable singletons), so unlike {@link runDeferredActions} this drains it
     * in place without disposing — the drain-semantics of
     * {@link DeferredExecutor.execute} guarantee only newly-queued actions run
     * each event. There is no execution context on the websocket path (the
     * Cloudflare DO / Node ws server just await the handler), so the drain is
     * awaited inline rather than backgrounded via `waitUntil`.
     */
    private async drainWebSocketDeferredActions(): Promise<void> {
        const container = this._webSocketContainer;
        if (!container) {
            return;
        }

        const deferredExecutor = container.resolve<DeferredExecutor>(
            BaseInjections.DeferredActions.toString(),
        );

        // drain the worker queue for anything published during the event
        deferredExecutor.append(async () => {
            const queueService = container.resolve(WorkerQueueService);
            await queueService.drain();
        });

        await deferredExecutor.execute();
    }

    private async runDeferredActions(
        executionContext: BaseExecutionContext,
        container: BaseInjectionContainer,
    ): Promise<void> {
        // this method should only be called on child containers
        if (container.scope === '@global' || container.scope === '@worker') {
            throw new Error(
                'Cannot run deferred actions on global or worker container scopes.',
            );
        }

        // get the deferred action for this container — use the
        // concrete class here since we need `.execute()` which is
        // not on the public DeferredActions interface
        const deferredAction = container.resolve<DeferredExecutor>(
            BaseInjections.DeferredActions.toString(),
        );

        // add a deferred action to drain the worker queue
        deferredAction.append(async () => {
            const queueService = container.resolve(WorkerQueueService);
            await queueService.drain();
        });

        const runAndDispose = deferredAction.execute().finally(async () => {
            // dispose of the container after the deferred action completes
            try {
                await container.dispose();
            } catch (e) {
                Logger.error(
                    LogCategory.Base,
                    'Error disposing request container',
                    e,
                );
            }
        });

        // A @request backgrounds its deferred work through waitUntil so it
        // never delays the HTTP response. @queue/@scheduled have no client
        // response to protect, and backgrounding is exactly what loses work:
        // on Cloudflare waitUntil runs after the platform has already acked
        // the batch, so a failed drain (queue publish) is invisible and its
        // messages are dropped. Run it inline instead, so it completes before
        // the handler returns and the batch is acked.
        //
        // Note it still logs-not-throws (DeferredExecutor.execute swallows
        // per-action failures): a drain failure must NOT fail a queue batch,
        // which would redeliver every already-processed message and re-run
        // successful work.
        if (container.scope === '@request') {
            await executionContext.waitUntil(runAndDispose);
        } else {
            await runAndDispose;
        }
    }

    //endregion
}
