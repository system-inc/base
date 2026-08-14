// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A class to measure different time intervals.
 */
export class StopWatch {
    private startTime: number = 0;
    private stopTime: number = 0;
    private splits: { name: string; time: number }[] = [];
    private lastSplit: string = 'end';

    /**
     * Creates a new instance of a StopWatch.
     * @param startTime Optional start time for the StopWatch.
     */
    constructor(startTime?: number) {
        if (startTime) {
            this.startTime = startTime;
        }
    }

    /**
     * Starts the StopWatch.
     * This method isn't required if you pass in a start time in the constructor.
     * You can optionally pass in a start time to override the current start time.
     * @param startTime
     */
    start(startTime?: number) {
        if (!startTime) {
            this.startTime = performance.now();
        } else {
            this.startTime = startTime;
        }
    }

    /**
     * Stops the StopWatch.
     * You can optionally pass in a stop time to override the current stop time.
     * @param stopTime
     */
    stop(name: string, stopTime?: number) {
        this.lastSplit = name;
        if (!stopTime) {
            this.stopTime = performance.now();
        } else {
            this.stopTime = stopTime;
        }
    }

    /**
     * Adds a split to the StopWatch.
     * @param name The name of the split.
     * @param time An optional time to override the current time.
     */
    split(name: string, time: number = performance.now()): void {
        this.splits.push({ name, time });
    }

    /**
     * Get the duration of a split by comparing it to the previous split.
     * @param name The name of the split.
     * @returns
     */
    getSplitDuration(name: string): number {
        const splitIndex = this.splits.findIndex(
            (split) => split.name === name,
        );
        if (splitIndex === -1) {
            throw new Error(`No split named '${name}'.`);
        }
        // duration is measured from the immediately preceding split (or the
        // start time for the first split)
        const previousTime =
            splitIndex === 0
                ? this.startTime
                : this.splits[splitIndex - 1].time;
        return this.splits[splitIndex].time - previousTime;
    }

    /**
     * Get the duration between two splits.
     *
     * @param startSplit The name of the start split.
     * @param endSplit The name of the end split.
     * @returns
     */
    getDurationBetweenSplits(startSplit: string, endSplit: string): number {
        let startSplitIndex = 0;
        let endSplitIndex = 0;
        for (let i = 0; i < this.splits.length; i++) {
            if (this.splits[i].name === startSplit) {
                startSplitIndex = i;
            }
            if (this.splits[i].name === endSplit) {
                endSplitIndex = i;
            }
        }
        return (
            this.splits[endSplitIndex].time - this.splits[startSplitIndex].time
        );
    }

    /**
     * Get the total elapsed time to a split.
     * @param name The name of the split.
     * @returns
     */
    getElapsedTimeToSplit(name: string): number {
        for (let i = 0; i < this.splits.length; i++) {
            if (this.splits[i].name === name) {
                return this.splits[i].time - this.startTime;
            }
        }
        return 0;
    }

    /**
     * Get the total elapsed time.
     * @returns
     */
    getTotalElapsedTime(): number {
        return this.stopTime - this.startTime;
    }

    toString(): string {
        let result = 'StopWatch {\n';
        for (let i = 0; i < this.splits.length; i++) {
            const split = this.splits[i];
            if (i === 0) {
                result += `    ${split.name}: ${split.time - this.startTime} ms\n`;
            } else if (i <= this.splits.length - 1) {
                result += `    ${split.name}: ${
                    split.time - this.splits[i - 1].time
                } ms\n`;
            }
        }
        result += `    ${this.lastSplit}: ${this.stopTime - this.splits[this.splits.length - 1].time} ms\n`;
        result += `} Total Duration: ${this.stopTime - this.startTime} ms\n`;
        return result;
    }
}
