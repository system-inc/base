// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { backoffNext } from './Backoff';

describe('backoffNext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock Math.random to return predictable values
        jest.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('parameter validation', () => {
        it('should throw error for attempt number less than 1', () => {
            expect(() => backoffNext(0)).toThrow(
                'Attempt number must be at least 1.',
            );
            expect(() => backoffNext(-1)).toThrow(
                'Attempt number must be at least 1.',
            );
        });

        it('should throw error when minMs is greater than maxMs', () => {
            expect(() => backoffNext(1, 5000, 1000)).toThrow(
                'Minimum delay must be less than or equal to maximum delay.',
            );
        });
    });

    describe('exponential backoff calculation', () => {
        it('should calculate correct backoff for attempt 1', () => {
            const result = backoffNext(1, 1000, 10000, false);
            expect(result).toBe(1000);
        });

        it('should calculate correct backoff for attempt 2', () => {
            const result = backoffNext(2, 1000, 10000, false);
            expect(result).toBe(2000);
        });

        it('should calculate correct backoff for attempt 3', () => {
            const result = backoffNext(3, 1000, 10000, false);
            expect(result).toBe(4000);
        });

        it('should cap backoff at maxMs', () => {
            const result = backoffNext(10, 1000, 5000, false);
            expect(result).toBe(5000);
        });
    });

    describe('jitter application', () => {
        it('should apply jitter when enabled (default)', () => {
            // Math.random returns 0.5, so jitter should be 0.5 + 0.5 * 0.5 = 0.75
            // Backoff for attempt 2 is 2000, with jitter: Math.floor(2000 * 0.75) = 1500
            const result = backoffNext(2, 1000, 10000);
            expect(result).toBe(1500);
        });

        it('should not apply jitter when disabled', () => {
            const result = backoffNext(2, 1000, 10000, false);
            expect(result).toBe(2000);
        });

        it('should ensure jittered value is at least minMs', () => {
            // Mock Math.random to return 0 (minimum jitter)
            jest.spyOn(Math, 'random').mockReturnValue(0);
            const result = backoffNext(1, 1000, 10000);
            expect(result).toBe(1000);
        });

        it('should ensure jittered value does not exceed maxMs', () => {
            // Test with a scenario where jitter could exceed maxMs
            // Attempt 10 gives 1000 * 2^9 = 512000, capped at 2000, then jittered to Math.floor(2000 * 0.75) = 1500
            const result = backoffNext(10, 1000, 2000);
            expect(result).toBe(1500);
        });
    });

    describe('default parameters', () => {
        it('should use default values when not provided', () => {
            const result = backoffNext(1);
            // Default: attempt 1, min=1000, max=180000
            // Backoff = 1000 * 2^0 = 1000, jittered = Math.floor(1000 * 0.75) = 750, clamped to min=1000
            expect(result).toBe(1000);
        });

        it('should use default maxMs when not provided', () => {
            const result = backoffNext(1, 2000);
            // attempt 1, min=2000, max=180000 (default)
            // Backoff = 2000 * 2^0 = 2000, jittered = Math.floor(2000 * 0.75) = 1500, clamped to min=2000
            expect(result).toBe(2000);
        });
    });

    describe('edge cases', () => {
        it('should handle minMs equal to maxMs', () => {
            const result = backoffNext(5, 1000, 1000, false);
            expect(result).toBe(1000);
        });

        it('should handle very large attempt numbers', () => {
            const result = backoffNext(20, 100, 5000, false);
            expect(result).toBe(5000);
        });

        it('should handle small delay values', () => {
            const result = backoffNext(1, 1, 10, false);
            expect(result).toBe(1);
        });
    });

    describe('randomness verification', () => {
        it('should produce different jittered values with different random values', () => {
            // First call with Math.random = 0.2
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.2);
            const result1 = backoffNext(2, 1000, 10000);
            // Backoff = 2000, jitter = 0.5 + 0.2 * 0.5 = 0.6, result = Math.floor(2000 * 0.6) = 1200
            expect(result1).toBe(1200);

            // Second call with Math.random = 0.8
            jest.spyOn(Math, 'random').mockReturnValueOnce(0.8);
            const result2 = backoffNext(2, 1000, 10000);
            // Backoff = 2000, jitter = 0.5 + 0.8 * 0.5 = 0.9, result = Math.floor(2000 * 0.9) = 1800
            expect(result2).toBe(1800);
        });
    });
});
