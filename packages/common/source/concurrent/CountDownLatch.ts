// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A synchronization aid that allows one or more threads to wait until
 * a set of operations being performed in other threads completes.
 */
export class CountdownLatch {
    private count: number;
    private resolveFunction: () => void;
    private promise: Promise<void>;

    constructor(initialCount: number) {
        this.count = initialCount;
        this.resolveFunction = () => {};
        this.promise = new Promise<void>((resolve) => {
            this.resolveFunction = resolve;
        });
        // A latch that starts already satisfied (count <= 0) must resolve
        // immediately — waiting for zero operations completes at once.
        // Otherwise wait() hangs forever: countDown only resolves on the
        // count reaching exactly 0, which a zero/negative start never hits.
        if (this.count <= 0) {
            this.resolveFunction();
        }
    }

    public async wait(): Promise<void> {
        await this.promise;
    }

    public countDown(): void {
        this.count--;

        if (this.count === 0) {
            this.resolveFunction();
        }
    }

    public getCount(): number {
        return this.count;
    }
}
