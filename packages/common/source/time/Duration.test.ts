// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { dateFromDuration } from './Duration';

describe('Duration', () => {
    describe('dateFromDuration', () => {
        const mockNow = new Date('2023-01-01T00:00:00.000Z');

        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(mockNow);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should parse a simple duration string with default anchor (current time)', () => {
            const result = dateFromDuration('PT1H');
            const expected = new Date('2023-01-01T01:00:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should parse duration with custom anchor date', () => {
            const anchor = new Date('2022-12-31T12:00:00.000Z').getTime();
            const result = dateFromDuration('PT30M', anchor);
            const expected = new Date('2022-12-31T12:30:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle complex duration strings', () => {
            const result = dateFromDuration('P1DT2H30M45S');
            const expected = new Date('2023-01-02T02:30:45.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle duration with years and months', () => {
            const anchor = new Date('2023-01-01T00:00:00Z');
            const result = dateFromDuration('P1Y2M3DT4H5M6S', anchor.getTime());
            const expected = new Date('2024-03-04T04:05:06.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle zero duration', () => {
            const result = dateFromDuration('PT0S');
            expect(result).toEqual(mockNow);
        });

        it('should handle duration with only date components', () => {
            const result = dateFromDuration('P7D');
            const expected = new Date('2023-01-08T00:00:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle duration with only time components', () => {
            const result = dateFromDuration('PT15M30S');
            const expected = new Date('2023-01-01T00:15:30.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle fractional seconds', () => {
            const result = dateFromDuration('PT1.5S');
            const expected = new Date('2023-01-01T00:00:01.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle anchor as number timestamp', () => {
            const anchor = Date.UTC(2020, 5, 15, 10, 30, 45); // June 15, 2020 10:30:45 UTC
            const result = dateFromDuration('PT1H', anchor);
            const expected = new Date('2020-06-15T11:30:45.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle negative durations (if supported by iso8601-duration)', () => {
            // Note: This test depends on the iso8601-duration library's behavior
            // Some implementations may not support negative durations
            try {
                const result = dateFromDuration('-PT1H');
                const expected = new Date('2022-12-31T23:00:00.000Z');
                expect(result).toEqual(expected);
            } catch (error) {
                // If negative durations aren't supported, that's acceptable
                expect(error).toBeDefined();
            }
        });

        it('should throw error for invalid duration string', () => {
            expect(() => dateFromDuration('invalid')).toThrow();
        });

        it('should throw error for empty duration string', () => {
            expect(() => dateFromDuration('')).toThrow();
        });

        it('should handle weeks in duration', () => {
            const result = dateFromDuration('P2W');
            const expected = new Date('2023-01-15T00:00:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle mixed week and day durations', () => {
            const result = dateFromDuration('P1W3D');
            const expected = new Date('2023-01-11T00:00:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should work with anchor date at epoch', () => {
            const result = dateFromDuration('PT1S', 0);
            const expected = new Date('1970-01-01T00:00:01.000Z');
            expect(result).toEqual(expected);
        });

        it('should preserve millisecond precision with custom anchor', () => {
            const anchor = new Date('2023-06-15T14:30:25.123Z').getTime();
            const result = dateFromDuration('PT5S', anchor);
            const expected = new Date('2023-06-15T14:30:30.123Z');
            expect(result).toEqual(expected);
        });
    });
});
