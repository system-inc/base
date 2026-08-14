// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { randomSleep } from './RandomSleep';
import { sleep } from './Sleep';

// Mock the sleep function
jest.mock('./Sleep', () => ({
    sleep: jest.fn().mockResolvedValue(undefined),
}));

const mockSleep = sleep as jest.MockedFunction<typeof sleep>;

describe('randomSleep', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock Math.random to return predictable values
        jest.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('default parameters', () => {
        it('should use default min and max values', async () => {
            await randomSleep();

            // Default min: 100, max: 10000
            // Math.random() = 0.5, so duration = 0.5 * (10000 - 100) + 100 = 5050
            expect(mockSleep).toHaveBeenCalledWith(5050);
        });

        it('should use default max when only min provided', async () => {
            await randomSleep(200);

            // min: 200, max: 10000 (default)
            // Math.random() = 0.5, so duration = 0.5 * (10000 - 200) + 200 = 5100
            expect(mockSleep).toHaveBeenCalledWith(5100);
        });
    });

    describe('custom parameters', () => {
        it('should use provided min and max values', async () => {
            await randomSleep(1000, 2000);

            // min: 1000, max: 2000
            // Math.random() = 0.5, so duration = 0.5 * (2000 - 1000) + 1000 = 1500
            expect(mockSleep).toHaveBeenCalledWith(1500);
        });

        it('should handle equal min and max values', async () => {
            await randomSleep(500, 500);

            // min: 500, max: 500
            // Math.random() = 0.5, so duration = 0.5 * (500 - 500) + 500 = 500
            expect(mockSleep).toHaveBeenCalledWith(500);
        });

        it('should handle zero values', async () => {
            await randomSleep(0, 1000);

            // min: 0, max: 1000
            // Math.random() = 0.5, so duration = 0.5 * (1000 - 0) + 0 = 500
            expect(mockSleep).toHaveBeenCalledWith(500);
        });

        it('should handle very small ranges', async () => {
            await randomSleep(100, 101);

            // min: 100, max: 101
            // Math.random() = 0.5, so duration = 0.5 * (101 - 100) + 100 = 100.5
            expect(mockSleep).toHaveBeenCalledWith(100.5);
        });

        it('should handle large values', async () => {
            await randomSleep(60000, 120000);

            // min: 60000, max: 120000
            // Math.random() = 0.5, so duration = 0.5 * (120000 - 60000) + 60000 = 90000
            expect(mockSleep).toHaveBeenCalledWith(90000);
        });
    });

    describe('randomness calculation', () => {
        it('should calculate minimum duration when Math.random returns 0', async () => {
            jest.spyOn(Math, 'random').mockReturnValue(0);

            await randomSleep(1000, 2000);

            // duration = 0 * (2000 - 1000) + 1000 = 1000
            expect(mockSleep).toHaveBeenCalledWith(1000);
        });

        it('should calculate maximum duration when Math.random returns close to 1', async () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.9999999);

            await randomSleep(1000, 2000);

            // duration = 0.9999999 * (2000 - 1000) + 1000 = 1999.9999
            expect(mockSleep).toHaveBeenCalledWith(1999.9999);
        });

        it('should calculate different durations with different random values', async () => {
            // First call with Math.random = 0.2
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.2);
            await randomSleep(1000, 2000);
            expect(mockSleep).toHaveBeenCalledWith(1200); // 0.2 * 1000 + 1000

            jest.clearAllMocks();

            // Second call with Math.random = 0.8
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.8);
            await randomSleep(1000, 2000);
            expect(mockSleep).toHaveBeenCalledWith(1800); // 0.8 * 1000 + 1000
        });

        it('should handle fractional results correctly', async () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.333);

            await randomSleep(100, 200);

            // duration = 0.333 * (200 - 100) + 100 = 133.3
            expect(mockSleep).toHaveBeenCalledWith(133.3);
        });
    });

    describe('parameter validation and edge cases', () => {
        it('should handle negative min value', async () => {
            await randomSleep(-100, 100);

            // Math.random() = 0.5, so duration = 0.5 * (100 - (-100)) + (-100) = 0
            expect(mockSleep).toHaveBeenCalledWith(0);
        });

        it('should handle when min is greater than max', async () => {
            await randomSleep(2000, 1000);

            // This creates a negative range: 0.5 * (1000 - 2000) + 2000 = 1500
            expect(mockSleep).toHaveBeenCalledWith(1500);
        });

        it('should handle decimal input values', async () => {
            await randomSleep(100.5, 200.7);

            // Math.random() = 0.5, so duration = 0.5 * (200.7 - 100.5) + 100.5 = 150.6
            expect(mockSleep).toHaveBeenCalledWith(150.6);
        });

        it('should handle very large numbers', async () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.5);

            await randomSleep(1000000, 2000000);

            // duration = 0.5 * (2000000 - 1000000) + 1000000 = 1500000
            expect(mockSleep).toHaveBeenCalledWith(1500000);
        });

        it('should handle zero range', async () => {
            await randomSleep(1000, 1000);

            // duration = 0.5 * (1000 - 1000) + 1000 = 1000
            expect(mockSleep).toHaveBeenCalledWith(1000);
        });
    });

    describe('integration with sleep function', () => {
        it('should call sleep function once', async () => {
            await randomSleep(100, 200);

            expect(mockSleep).toHaveBeenCalledTimes(1);
        });

        it('should pass calculated duration to sleep', async () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.75);

            await randomSleep(400, 800);

            // duration = 0.75 * (800 - 400) + 400 = 700
            expect(mockSleep).toHaveBeenCalledWith(700);
        });

        it('should return the promise from sleep', async () => {
            const mockPromise = Promise.resolve();
            mockSleep.mockReturnValue(mockPromise);

            const result = randomSleep(100, 200);

            expect(result).toBe(mockPromise);
        });

        it('should handle sleep function rejection', async () => {
            const error = new Error('Sleep failed');
            mockSleep.mockRejectedValueOnce(error);

            await expect(randomSleep(100, 200)).rejects.toThrow('Sleep failed');
        });
    });

    describe('multiple calls', () => {
        it('should generate different durations on multiple calls', async () => {
            const randomValues = [0.1, 0.3, 0.7, 0.9];
            let callCount = 0;

            jest.spyOn(Math, 'random').mockImplementation(() => {
                return randomValues[callCount++] || 0.5;
            });

            await randomSleep(1000, 2000);
            expect(mockSleep).toHaveBeenNthCalledWith(1, 1100); // 0.1 * 1000 + 1000

            await randomSleep(1000, 2000);
            expect(mockSleep).toHaveBeenNthCalledWith(2, 1300); // 0.3 * 1000 + 1000

            await randomSleep(1000, 2000);
            expect(mockSleep).toHaveBeenNthCalledWith(3, 1700); // 0.7 * 1000 + 1000

            await randomSleep(1000, 2000);
            expect(mockSleep).toHaveBeenNthCalledWith(4, 1900); // 0.9 * 1000 + 1000
        });

        it('should work with concurrent calls', async () => {
            const randomValues = [0.2, 0.8, 0.5];
            let callCount = 0;

            jest.spyOn(Math, 'random').mockImplementation(() => {
                return randomValues[callCount++] || 0.5;
            });

            const promises = [
                randomSleep(100, 300),
                randomSleep(100, 300),
                randomSleep(100, 300),
            ];

            await Promise.all(promises);

            expect(mockSleep).toHaveBeenCalledTimes(3);
            expect(mockSleep).toHaveBeenNthCalledWith(1, 140); // 0.2 * 200 + 100
            expect(mockSleep).toHaveBeenNthCalledWith(2, 260); // 0.8 * 200 + 100
            expect(mockSleep).toHaveBeenNthCalledWith(3, 200); // 0.5 * 200 + 100
        });
    });

    describe('return value', () => {
        it('should return a promise', () => {
            const result = randomSleep(100, 200);
            expect(result).toBeInstanceOf(Promise);
        });

        it('should resolve to undefined', async () => {
            const result = await randomSleep(100, 200);
            expect(result).toBeUndefined();
        });
    });

    describe('real randomness verification', () => {
        beforeEach(() => {
            // Restore real Math.random for these tests
            jest.restoreAllMocks();
        });

        it('should produce values within expected range', async () => {
            const min = 1000;
            const max = 2000;
            const calls: number[] = [];

            // Mock sleep to capture the called values
            mockSleep.mockImplementation((duration: number) => {
                calls.push(duration);
                return Promise.resolve();
            });

            // Make multiple calls with real randomness
            for (let i = 0; i < 100; i++) {
                await randomSleep(min, max);
            }

            // All values should be within range
            calls.forEach((duration) => {
                expect(duration).toBeGreaterThanOrEqual(min);
                expect(duration).toBeLessThanOrEqual(max);
            });

            // Should have some variation (not all the same value)
            const uniqueValues = new Set(calls);
            expect(uniqueValues.size).toBeGreaterThan(10);
        });
    });
});
