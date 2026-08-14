// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { EnvironmentType } from '../configuration/Environment';
import { PlatformType } from '../configuration/Platform';
import { BaseInjections } from '../dependency-injection/BaseInjections';
import { WorkerQueueService } from '../internal/queue/producer/WorkerQueueService';
import { DeferredExecutor } from '../internal/request/DeferredExecutor';
import { BaseWebSocket } from '../web-socket/WebSocketTypes';
import { BaseWorkerContext } from '../worker/BaseWorkerContext';
import { BaseWorkerDelegate } from '../worker/BaseWorkerDelegate';
import { Base } from './Base';

// A minimal delegate whose onInitialize hook is the controllable last
// async step of initialization (it runs just before router.bindRoutes()),
// letting a test hold init open or make it fail.
class TestDelegate implements BaseWorkerDelegate {
    calls = 0;
    barrier: Promise<void> | undefined;
    failuresRemaining = 0;

    async onInitialize(): Promise<void> {
        this.calls++;
        if (this.failuresRemaining > 0) {
            this.failuresRemaining--;
            throw new Error('onInitialize failed');
        }
        if (this.barrier) {
            await this.barrier;
        }
    }
}

function makeBase(delegate: TestDelegate): Base {
    // A fake worker context sufficient to drive the real initialize():
    // CLI mode selects the no-op DummyRouter, Node platform selects the
    // no-op NodePlatformDelegate, and empty graphql/rpc/webSocket/modules
    // make every init sub-step a no-op except the delegate hook.
    class TestDelegateClass {}
    const configuration = {
        runtime: {
            platform: { type: PlatformType.Node },
            mode: { isCommandLine: true },
            environment: { type: EnvironmentType.Development },
            toString: () => 'test-runtime',
        },
        modules: [],
        graphql: undefined,
        rpcServer: undefined,
        webSocket: undefined,
        eventBus: undefined,
        logging: { requestLog: true },
        router: { services: [], cors: undefined },
        delegate: TestDelegateClass,
        getVersionInfo: () => ({}),
    };
    const context = {
        configuration,
        container: {
            resolve: () => delegate,
        },
    } as unknown as BaseWorkerContext;
    return new Base(context);
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
        resolve = r;
    });
    return { promise: promise, resolve: resolve };
}

describe('Base.initialize', () => {
    it('does not mark initialized until the async init has fully completed', async () => {
        const delegate = new TestDelegate();
        const barrier = deferred();
        delegate.barrier = barrier.promise;
        const base = makeBase(delegate);

        const initializing = base.initialize();

        // init is parked inside onInitialize (before bindRoutes) — the flag
        // must not be set yet, or a concurrent event would dispatch against
        // an unbound router.
        await Promise.resolve();
        expect(base.isInitialized).toBe(false);

        barrier.resolve();
        await initializing;
        expect(base.isInitialized).toBe(true);
    });

    it('runs initialization once for concurrent callers', async () => {
        const delegate = new TestDelegate();
        const barrier = deferred();
        delegate.barrier = barrier.promise;
        const base = makeBase(delegate);

        const first = base.initialize();
        const second = base.initialize();

        barrier.resolve();
        await Promise.all([first, second]);

        expect(delegate.calls).toBe(1);
        expect(base.isInitialized).toBe(true);
    });

    it('does not latch as initialized when init fails, and retries on the next call', async () => {
        const delegate = new TestDelegate();
        delegate.failuresRemaining = 1;
        const base = makeBase(delegate);

        await expect(base.initialize()).rejects.toThrow('onInitialize failed');
        expect(base.isInitialized).toBe(false);

        // a later event must be able to re-attempt, not stay wedged forever
        await base.initialize();
        expect(base.isInitialized).toBe(true);
        expect(delegate.calls).toBe(2);
    });
});

describe('Base websocket deferred actions', () => {
    // Wires a Base with a stubbed websocket service + the shared @websocket
    // container so we can observe that each socket event drains its deferred
    // actions (queue publishes, deferred event-bus publishes) — the behaviour
    // the HTTP/queue/scheduled handlers already have via runDeferredActions.
    function makeWebSocketBase() {
        const base = makeBase(new TestDelegate());
        const deferredExecutor = new DeferredExecutor();
        const queueService = { drain: jest.fn(async () => {}) };
        const container = {
            resolve: (token: unknown) => {
                if (token === BaseInjections.DeferredActions.toString()) {
                    return deferredExecutor;
                }
                if (token === WorkerQueueService) {
                    return queueService;
                }
                return undefined;
            },
        };
        // a delegate hook that defers work while handling the event
        const ran: string[] = [];
        const webSocketService = {
            webSocketMessage: jest.fn(async () => {
                deferredExecutor.append(async () => {
                    ran.push('message');
                });
            }),
            webSocketClose: jest.fn(async () => {
                deferredExecutor.append(async () => {
                    ran.push('close');
                });
            }),
            webSocketError: jest.fn(async () => {
                deferredExecutor.append(async () => {
                    ran.push('error');
                });
            }),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.assign(base as any, {
            _isInitialized: true,
            _webSocketService: webSocketService,
            _webSocketContainer: container,
        });
        return { base, webSocketService, queueService, ran };
    }

    const socket = {} as BaseWebSocket;

    it('drains work deferred while handling a message, and drains the queue', async () => {
        const { base, ran, queueService } = makeWebSocketBase();

        await base.webSocketMessage(socket, 'hello');

        // before the fix the appended action sat on a never-drained container
        expect(ran).toEqual(['message']);
        expect(queueService.drain).toHaveBeenCalledTimes(1);
    });

    it('drains once per event without replaying a prior event', async () => {
        const { base, ran, queueService } = makeWebSocketBase();

        await base.webSocketMessage(socket, 'first');
        await base.webSocketClose(socket);

        // each event runs only its own deferred action — no re-run of 'message'
        expect(ran).toEqual(['message', 'close']);
        expect(queueService.drain).toHaveBeenCalledTimes(2);
    });

    it('still drains when the handler throws', async () => {
        const { base, webSocketService, queueService } = makeWebSocketBase();
        webSocketService.webSocketError.mockRejectedValueOnce(
            new Error('handler boom'),
        );

        await expect(
            base.webSocketError(socket, new Error('x')),
        ).rejects.toThrow('handler boom');

        // the finally still drained the queue despite the handler failure
        expect(queueService.drain).toHaveBeenCalledTimes(1);
    });
});

describe('Base.runDeferredActions scope behavior', () => {
    function makeDeferredHarness(scope: string) {
        const deferredExecutor = new DeferredExecutor();
        const queueService = { drain: jest.fn(async () => {}) };
        const dispose = jest.fn(async () => {});
        const container = {
            scope,
            resolve: (token: unknown) => {
                if (token === BaseInjections.DeferredActions.toString()) {
                    return deferredExecutor;
                }
                if (token === WorkerQueueService) {
                    return queueService;
                }
                return undefined;
            },
            dispose,
        };
        const waitUntil = jest.fn((p: Promise<unknown>) => p);
        const executionContext = { waitUntil };
        const base = makeBase(new TestDelegate());
        const run = () =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (base as any).runDeferredActions(executionContext, container);
        return { deferredExecutor, queueService, dispose, waitUntil, run };
    }

    it('backgrounds deferred work through waitUntil for a @request', async () => {
        const { waitUntil, queueService, dispose, run } =
            makeDeferredHarness('@request');
        await run();
        expect(waitUntil).toHaveBeenCalledTimes(1);
        expect(queueService.drain).toHaveBeenCalledTimes(1);
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('runs the drain inline (no waitUntil) for a @queue', async () => {
        const { waitUntil, queueService, dispose, run } =
            makeDeferredHarness('@queue');
        await run();
        // never backgrounded past the batch ack
        expect(waitUntil).not.toHaveBeenCalled();
        expect(queueService.drain).toHaveBeenCalledTimes(1);
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('runs the drain inline for a @scheduled', async () => {
        const { waitUntil, queueService, run } =
            makeDeferredHarness('@scheduled');
        await run();
        expect(waitUntil).not.toHaveBeenCalled();
        expect(queueService.drain).toHaveBeenCalledTimes(1);
    });

    it('does not throw (fail the batch) when a deferred action fails', async () => {
        const { deferredExecutor, dispose, run } =
            makeDeferredHarness('@queue');
        deferredExecutor.append(async () => {
            throw new Error('publish failed');
        });
        // a drain/publish failure must not reject — that would retry the whole
        // queue batch and re-run already-processed messages
        await expect(run()).resolves.toBeUndefined();
        expect(dispose).toHaveBeenCalledTimes(1);
    });
});
