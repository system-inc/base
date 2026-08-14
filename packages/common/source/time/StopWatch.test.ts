// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { StopWatch } from './StopWatch';

describe('StopWatch', () => {
    describe('constructor', () => {
        test('should create a StopWatch without start time', () => {
            const stopWatch = new StopWatch();
            expect(stopWatch).toBeDefined();
            expect(stopWatch.getTotalElapsedTime()).toBe(0);
        });

        test('should create a StopWatch with provided start time', () => {
            const startTime = 1000;
            const stopWatch = new StopWatch(startTime);
            expect(stopWatch).toBeDefined();
        });
    });

    describe('start', () => {
        test('should set start time using performance.now() when no time provided', () => {
            const stopWatch = new StopWatch();
            stopWatch.start();
            const afterStart = performance.now();

            stopWatch.stop('test', afterStart + 100);
            const totalTime = stopWatch.getTotalElapsedTime();

            expect(totalTime).toBeGreaterThan(90);
            expect(totalTime).toBeLessThan(200);
        });

        test('should set start time to provided value', () => {
            const stopWatch = new StopWatch();
            const customStartTime = 5000;
            stopWatch.start(customStartTime);
            stopWatch.stop('test', 6000);

            expect(stopWatch.getTotalElapsedTime()).toBe(1000);
        });

        test('should override constructor start time', () => {
            const stopWatch = new StopWatch(1000);
            stopWatch.start(2000);
            stopWatch.stop('test', 3000);

            expect(stopWatch.getTotalElapsedTime()).toBe(1000);
        });
    });

    describe('stop', () => {
        test('should set stop time using performance.now() when no time provided', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);

            const beforeStop = performance.now();
            stopWatch.stop('end');
            const afterStop = performance.now();

            const totalTime = stopWatch.getTotalElapsedTime();
            expect(totalTime).toBeGreaterThan(beforeStop - 1100);
            expect(totalTime).toBeLessThan(afterStop - 900);
        });

        test('should set stop time to provided value', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.stop('end', 2500);

            expect(stopWatch.getTotalElapsedTime()).toBe(1500);
        });

        test('should set last split name', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('checkpoint', 1500);
            stopWatch.stop('custom-end', 2000);

            const toStringOutput = stopWatch.toString();
            expect(toStringOutput).toContain('custom-end');
        });
    });

    describe('split', () => {
        test('should add split with current performance.now() time', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);

            const beforeSplit = performance.now();
            stopWatch.split('checkpoint');
            const afterSplit = performance.now();

            const elapsedTime = stopWatch.getElapsedTimeToSplit('checkpoint');
            expect(elapsedTime).toBeGreaterThan(beforeSplit - 1100);
            expect(elapsedTime).toBeLessThan(afterSplit - 900);
        });

        test('should add split with provided time', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('checkpoint', 1500);

            expect(stopWatch.getElapsedTimeToSplit('checkpoint')).toBe(500);
        });

        test('should add multiple splits', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('split1', 1200);
            stopWatch.split('split2', 1400);
            stopWatch.split('split3', 1600);

            expect(stopWatch.getElapsedTimeToSplit('split1')).toBe(200);
            expect(stopWatch.getElapsedTimeToSplit('split2')).toBe(400);
            expect(stopWatch.getElapsedTimeToSplit('split3')).toBe(600);
        });
    });

    describe('getSplitDuration', () => {
        test('should return duration from start time for first split', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('first', 1300);

            expect(stopWatch.getSplitDuration('first')).toBe(300);
        });

        test('should return duration for first split from start time', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('first', 1200);
            stopWatch.split('second', 1500);

            expect(stopWatch.getSplitDuration('first')).toBe(200);
        });

        test('should measure each split from the immediately preceding one', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(0);
            stopWatch.split('parse', 100);
            stopWatch.split('validate', 150);
            stopWatch.split('persist', 400);

            // measured from the previous split, not two splits back or the start
            expect(stopWatch.getSplitDuration('validate')).toBe(50);
            expect(stopWatch.getSplitDuration('persist')).toBe(250);
        });

        test('should throw for a non-existent split name', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('existing', 1200);

            expect(() => stopWatch.getSplitDuration('non-existent')).toThrow();
        });
    });

    describe('getDurationBetweenSplits', () => {
        test('should return duration between two splits', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('start', 1200);
            stopWatch.split('middle', 1500);
            stopWatch.split('end', 1800);

            expect(stopWatch.getDurationBetweenSplits('start', 'end')).toBe(
                600,
            );
            expect(stopWatch.getDurationBetweenSplits('start', 'middle')).toBe(
                300,
            );
            expect(stopWatch.getDurationBetweenSplits('middle', 'end')).toBe(
                300,
            );
        });

        test('should handle same split name for start and end', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('same', 1500);

            expect(stopWatch.getDurationBetweenSplits('same', 'same')).toBe(0);
        });

        test('should handle non-existent split names', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('existing', 1200);

            expect(
                stopWatch.getDurationBetweenSplits('non-existent', 'existing'),
            ).toBe(0);
            expect(
                stopWatch.getDurationBetweenSplits('existing', 'non-existent'),
            ).toBe(0);
        });
    });

    describe('getElapsedTimeToSplit', () => {
        test('should return elapsed time from start to split', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('checkpoint1', 1300);
            stopWatch.split('checkpoint2', 1700);

            expect(stopWatch.getElapsedTimeToSplit('checkpoint1')).toBe(300);
            expect(stopWatch.getElapsedTimeToSplit('checkpoint2')).toBe(700);
        });

        test('should return 0 for non-existent split', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('existing', 1200);

            expect(stopWatch.getElapsedTimeToSplit('non-existent')).toBe(0);
        });
    });

    describe('getTotalElapsedTime', () => {
        test('should return total elapsed time from start to stop', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.stop('end', 2500);

            expect(stopWatch.getTotalElapsedTime()).toBe(1500);
        });

        test('should work with constructor start time', () => {
            const stopWatch = new StopWatch(500);
            stopWatch.stop('end', 1200);

            expect(stopWatch.getTotalElapsedTime()).toBe(700);
        });

        test('should return 0 when not started or stopped', () => {
            const stopWatch = new StopWatch();
            expect(stopWatch.getTotalElapsedTime()).toBe(0);
        });
    });

    describe('toString', () => {
        test('should return formatted string with no splits', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('dummy', 1200);
            stopWatch.stop('end', 1500);

            const result = stopWatch.toString();
            expect(result).toContain('StopWatch {');
            expect(result).toContain('end:');
            expect(result).toContain('Total Duration: 500 ms');
        });

        test('should return formatted string with single split', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('checkpoint', 1300);
            stopWatch.stop('end', 1600);

            const result = stopWatch.toString();
            expect(result).toContain('StopWatch {');
            expect(result).toContain('checkpoint: 300 ms');
            expect(result).toContain('end: 300 ms');
            expect(result).toContain('Total Duration: 600 ms');
        });

        test('should return formatted string with multiple splits', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('split1', 1200);
            stopWatch.split('split2', 1500);
            stopWatch.split('split3', 1700);
            stopWatch.stop('final', 2000);

            const result = stopWatch.toString();
            expect(result).toContain('StopWatch {');
            expect(result).toContain('split1: 200 ms');
            expect(result).toContain('split2: 300 ms');
            expect(result).toContain('split3: 200 ms');
            expect(result).toContain('final: 300 ms');
            expect(result).toContain('Total Duration: 1000 ms');
        });

        test('should handle minimal splits', () => {
            const stopWatch = new StopWatch();
            stopWatch.start(1000);
            stopWatch.split('single', 1300);
            stopWatch.stop('end', 1500);

            const result = stopWatch.toString();
            expect(result).toContain('StopWatch {');
            expect(result).toContain('single: 300 ms');
            expect(result).toContain('Total Duration: 500 ms');
        });
    });

    describe('integration tests', () => {
        test('should handle complete workflow with multiple operations', () => {
            const stopWatch = new StopWatch();

            stopWatch.start(1000);
            stopWatch.split('phase1', 1200);
            stopWatch.split('phase2', 1600);
            stopWatch.split('phase3', 1800);
            stopWatch.stop('complete', 2200);

            expect(stopWatch.getSplitDuration('phase1')).toBe(200);

            expect(stopWatch.getDurationBetweenSplits('phase1', 'phase3')).toBe(
                600,
            );
            expect(stopWatch.getElapsedTimeToSplit('phase2')).toBe(600);
            expect(stopWatch.getTotalElapsedTime()).toBe(1200);

            const stringOutput = stopWatch.toString();
            expect(stringOutput).toContain('phase1: 200 ms');
            expect(stringOutput).toContain('phase2: 400 ms');
            expect(stringOutput).toContain('phase3: 200 ms');
            expect(stringOutput).toContain('complete: 400 ms');
            expect(stringOutput).toContain('Total Duration: 1200 ms');
        });

        test('should work with constructor start time and custom times', () => {
            const stopWatch = new StopWatch(500);

            stopWatch.split('early', 800);
            stopWatch.split('middle', 1200);
            stopWatch.stop('done', 1500);

            expect(stopWatch.getElapsedTimeToSplit('early')).toBe(300);
            expect(stopWatch.getElapsedTimeToSplit('middle')).toBe(700);
            expect(stopWatch.getDurationBetweenSplits('early', 'middle')).toBe(
                400,
            );
            expect(stopWatch.getTotalElapsedTime()).toBe(1000);
        });
    });
});
