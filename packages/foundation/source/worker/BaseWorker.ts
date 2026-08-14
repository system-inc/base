// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Base } from '../base/Base';
import { BaseSettings } from '../base/BaseSettings';
import { BaseConfiguration } from '../configuration/BaseConfiguration';
import { EnvironmentVariables } from '../configuration/EnvironmentVariables';
import { BaseInjectionContainer } from '../dependency-injection/BaseInjectionContainer';
import { createWorkerContainer } from '../internal/dependency-injection/InjectionContainers';
import { BaseExecutionContext } from '../internal/execution-context/BaseExecutionContext';
import { WorkerQueueMessage } from '../queue/WorkerQueueMessage';
import { BaseWorkerContext } from './BaseWorkerContext';

/**
 * Base class for a Worker that uses Base.
 */
export class BaseWorker {
    /**
     * Create a new instance of a BaseWorker.
     *
     * @param settings The settings for the Base application.
     */
    static create(settings: BaseSettings): BaseWorker {
        return new BaseWorker(settings);
    }

    private _container: BaseInjectionContainer | null = null;
    get container(): BaseInjectionContainer {
        if (!this._container) {
            this._container = createWorkerContainer();
        }
        return this._container;
    }

    /**
     * Get the Base instance.
     *
     * @param environmentVariables
     * @returns
     */
    getBase(environmentVariables: EnvironmentVariables): Base {
        if (!this._base) {
            const context = new BaseWorkerContext(
                environmentVariables,
                this.settings,
                this.container,
            );
            this.container.registerInstance(BaseWorkerContext, context);
            this.container.registerInstance(
                BaseConfiguration,
                context.configuration,
            );
            this._base = new Base(context);
        }
        return this._base;
    }
    private _base: Base | null = null;

    /**
     * Create a new instance of a BaseWorker.
     *
     * @param settings The settings for the Base application.
     */
    // use a private constructor to prevent subclassing
    private constructor(readonly settings: BaseSettings) {}

    get name(): string {
        return this.settings.name;
    }

    fetch = (
        request: Request,
        environmentVariables: EnvironmentVariables,
        executionContext?: ExecutionContext,
    ): Promise<Response> => {
        const startTime = performance.now();
        return this.getBase(environmentVariables).handleRequest(
            request,
            new BaseExecutionContext(startTime, executionContext),
        );
    };

    queue = (
        messageBatch: MessageBatch<WorkerQueueMessage>,
        environmentVariables: EnvironmentVariables,
    ): Promise<void> => {
        const startTime = performance.now();
        return this.getBase(environmentVariables).handleMessages(
            messageBatch.messages,
            new BaseExecutionContext(startTime),
        );
    };

    scheduled = (
        scheduledEvent: ScheduledEvent,
        environmentVariables: EnvironmentVariables,
        executionContext?: ExecutionContext,
    ): Promise<void> => {
        const startTime = performance.now();
        return this.getBase(environmentVariables).handleScheduled(
            scheduledEvent,
            new BaseExecutionContext(startTime, executionContext),
        );
    };
}
