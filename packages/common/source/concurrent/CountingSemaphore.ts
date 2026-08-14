// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A synchronization primitive that can be used to limit the number of concurrent operations.
 */
export class CountingSemaphore {
    private count: number;
    private queue: (() => void)[] = [];

    constructor(initialCount: number) {
        this.count = initialCount;
    }

    public async acquire(): Promise<void> {
        if (this.count > 0) {
            this.count--;
            return;
        }

        await new Promise<void>((resolve) => {
            this.queue.push(resolve);
        });
    }

    public release(): void {
        if (this.queue.length > 0) {
            // A waiting task takes the slot instead of incrementing the count
            const nextTask = this.queue.shift();
            nextTask?.();
        } else {
            // Only increment if there are no waiting tasks
            this.count++;
        }
    }

    public getCount(): number {
        return this.count;
    }
}
