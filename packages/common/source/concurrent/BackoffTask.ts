// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '../logging/LogCategory';
import { Logger } from '../logging/Logger';

const DEFAULT_INITIAL_BACKOFF = 1000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_BACKOFF = 3 * 60 * 1000; // 3 minutes

export type BackoffTaskType<T> = () => Promise<T>;
export type BackoffTaskLogLevel = 'debug' | 'error';

export interface BackoffTaskOptions {
    taskId?: string;
    maxBackoff?: number;
    maxAttempts?: number;
    initialBackoff?: number;
    logLevel?: BackoffTaskLogLevel;
}

interface BackoffTaskDelay {
    readonly timeoutId: ReturnType<typeof setTimeout>;
    readonly resolve: (value: void | PromiseLike<void>) => void;
}

export class BackoffTask<T = unknown> {
    static run<T = unknown>(
        task: BackoffTaskType<T>,
        options?: BackoffTaskOptions,
    ): Promise<T> {
        return new BackoffTask(task, options).run();
    }

    readonly taskId: string;

    private readonly task: BackoffTaskType<T>;
    private readonly maxBackoff: number;
    private readonly maxAttempts: number;
    private readonly initialBackoff: number;
    private readonly logLevel: BackoffTaskLogLevel;

    private isRunning: boolean = false;
    private isInterrupted: boolean = false;
    private attemptCount: number = 0;
    private currentDelay: BackoffTaskDelay | null = null;

    constructor(task: BackoffTaskType<T>, options?: BackoffTaskOptions) {
        this.task = task;
        this.taskId = options?.taskId ?? crypto.randomUUID();
        this.maxBackoff = options?.maxBackoff ?? DEFAULT_MAX_BACKOFF;
        this.maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        this.initialBackoff =
            options?.initialBackoff ?? DEFAULT_INITIAL_BACKOFF;
        this.logLevel = options?.logLevel ?? 'error';
    }

    public async run(): Promise<T> {
        if (this.isRunning) {
            throw new Error('Task is already running');
        }

        // ensure we can't run the task again
        this.isRunning = true;

        // set the initial state
        this.attemptCount = 0;
        this.isInterrupted = false;
        let backoff = this.initialBackoff;

        while (!this.isInterrupted && this.attemptCount < this.maxAttempts) {
            if (this.attemptCount === 0) {
                backoff = this.initialBackoff;
            }
            this.attemptCount = this.attemptCount + 1;
            try {
                this.log('debug', `Running`);
                const result = await this.task();
                this.log('debug', `Task completed`);
                return result;
            } catch (error) {
                this.log('error', `Task failed: `, error);
                if (this.attemptCount >= this.maxAttempts) {
                    throw error;
                }
            }

            backoff = Math.min(this.maxBackoff, this.attemptCount * backoff);
            this.log('debug', `Waiting for ${backoff}ms before retrying`);
            await this.delay(backoff);
        }

        this.isRunning = false;

        // if we reached this point the task either failed or was interrupted
        if (this.isInterrupted) {
            throw new Error(`Task was interrupted: ${this.taskId}`);
        } else {
            throw new Error(`Task failed to complete: ${this.taskId}`);
        }
    }

    public resetAttempts(): void {
        this.attemptCount = 0;
    }

    public interrupt() {
        this.isInterrupted = true;
        // end the current delay if one exists
        if (this.currentDelay) {
            clearTimeout(this.currentDelay.timeoutId);
            this.currentDelay.resolve();
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                this.currentDelay = null;
                resolve();
            }, ms);
            this.currentDelay = { timeoutId, resolve };
        });
    }

    private log(
        level: BackoffTaskLogLevel,
        message: string,
        ...optionalParams: unknown[]
    ): void {
        let shouldLog = false;
        switch (level) {
            case 'error':
                shouldLog = true;
                break;
            case 'debug':
                shouldLog = this.logLevel === 'debug';
                break;
        }

        if (!shouldLog) {
            return;
        }

        if (level === 'error') {
            Logger.error(
                LogCategory.Common,
                'Task: %s:%d %s',
                this.taskId,
                this.attemptCount,
                message,
                ...optionalParams,
            );
        } else {
            Logger.debug(
                LogCategory.Common,
                'Task: %s:%d %s',
                this.taskId,
                this.attemptCount,
                message,
                ...optionalParams,
            );
        }
    }
}
