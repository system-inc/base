// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Decimal } from 'decimal.js';

import { MonetaryDecimal, MonetaryDecimalTransformer } from './MonetaryDecimal';

describe('MonetaryDecimal', () => {
    describe('constructor', () => {
        it('should correctly initialize from various types', () => {
            expect(new MonetaryDecimal(100).toNumber()).toBe(100);
            expect(new MonetaryDecimal('200').toNumber()).toBe(200);
            expect(
                new MonetaryDecimal(new MonetaryDecimal(300)).toNumber(),
            ).toBe(300);
        });

        it('should handle zero values', () => {
            expect(new MonetaryDecimal(0).toNumber()).toBe(0);
            expect(new MonetaryDecimal('0').toNumber()).toBe(0);
        });

        it('should handle negative values', () => {
            expect(new MonetaryDecimal(-100).toNumber()).toBe(-100);
            expect(new MonetaryDecimal('-150').toNumber()).toBe(-150);
        });

        it('should handle Decimal input', () => {
            const decimal = new Decimal(500);
            expect(new MonetaryDecimal(decimal).toNumber()).toBe(500);
        });

        it('should handle large integer values', () => {
            const largeValue = 999999999;
            expect(new MonetaryDecimal(largeValue).toNumber()).toBe(largeValue);
        });

        it('should throw an error for non-integer values', () => {
            expect(() => new MonetaryDecimal(123.45)).toThrow(
                'MonetaryDecimal can only accept integer[cent] values',
            );
            expect(() => new MonetaryDecimal('123.45')).toThrow(
                'MonetaryDecimal can only accept integer[cent] values',
            );
            expect(() => new MonetaryDecimal(new Decimal(123.45))).toThrow(
                'MonetaryDecimal can only accept integer[cent] values',
            );
        });
    });

    describe('arithmetic operations', () => {
        it('should correctly add values', () => {
            const base = new MonetaryDecimal(100);
            expect(base.plus(new MonetaryDecimal(50)).toNumber()).toBe(150);
            expect(base.plus(new MonetaryDecimal(0)).toNumber()).toBe(100);
            expect(base.plus(new MonetaryDecimal(-25)).toNumber()).toBe(75);
        });

        it('should correctly subtract values', () => {
            const base = new MonetaryDecimal(100);
            expect(base.minus(new MonetaryDecimal(30)).toNumber()).toBe(70);
            expect(base.minus(new MonetaryDecimal(0)).toNumber()).toBe(100);
            expect(base.minus(new MonetaryDecimal(150)).toNumber()).toBe(-50);
        });

        it('should correctly multiply values', () => {
            const base = new MonetaryDecimal(100);
            expect(base.times(2).toNumber()).toBe(200);
            expect(base.times(0.333).toNumber()).toBe(33); // Should floor the result
            expect(base.times(0).toNumber()).toBe(0);
            expect(base.times(-1).toNumber()).toBe(-100);
        });

        it('should correctly divide values', () => {
            const base = new MonetaryDecimal(100);
            expect(base.div(2).toNumber()).toBe(50);
            expect(base.div(3).toNumber()).toBe(33); // Should floor the result
            expect(base.div(-2).toNumber()).toBe(-50);
        });

        it('should floor multiplication results', () => {
            const base = new MonetaryDecimal(100);
            expect(base.times(1.99).toNumber()).toBe(199); // 199.0 floored
            expect(base.times(1.01).toNumber()).toBe(101); // 101.0 floored
        });

        it('should floor division results', () => {
            const base = new MonetaryDecimal(100);
            expect(base.div(3).toNumber()).toBe(33); // 33.33... floored to 33
            expect(base.div(7).toNumber()).toBe(14); // 14.28... floored to 14
        });
    });

    describe('comparison methods', () => {
        it('should compare values correctly with equals', () => {
            const value1 = new MonetaryDecimal(100);
            const value2 = new MonetaryDecimal(100);
            const value3 = new MonetaryDecimal(200);
            expect(value1.equals(value2)).toBeTruthy();
            expect(value1.equals(value3)).toBeFalsy();
        });

        it('should compare with different types', () => {
            const monetary = new MonetaryDecimal(100);
            expect(monetary.equals(100)).toBeTruthy();
            expect(monetary.equals(new Decimal(100))).toBeTruthy();
            expect(monetary.equals(new MonetaryDecimal(100))).toBeTruthy();
        });

        it('should handle notEquals correctly', () => {
            const value1 = new MonetaryDecimal(100);
            const value2 = new MonetaryDecimal(100);
            const value3 = new MonetaryDecimal(200);
            expect(value1.notEquals(value2)).toBeFalsy();
            expect(value1.notEquals(value3)).toBeTruthy();
        });

        it('should handle zero and negative comparisons', () => {
            const zero = new MonetaryDecimal(0);
            const positive = new MonetaryDecimal(100);
            const negative = new MonetaryDecimal(-100);

            expect(zero.equals(0)).toBeTruthy();
            expect(positive.notEquals(negative)).toBeTruthy();
            expect(negative.equals(-100)).toBeTruthy();
        });
    });

    describe('toString method', () => {
        it('should convert to string correctly', () => {
            expect(new MonetaryDecimal(100).toString()).toBe('100');
            expect(new MonetaryDecimal(0).toString()).toBe('0');
            expect(new MonetaryDecimal(-50).toString()).toBe('-50');
            expect(new MonetaryDecimal(12345).toString()).toBe('12345');
        });
    });

    describe('toDollarAmount method', () => {
        it('should handle decimals', () => {
            const base = new MonetaryDecimal(360);
            expect(base.div(100).toNumber()).toBe(3);
            expect(base.toDollarAmount()).toBe(3.6);
        });

        it('should convert cents to dollar amounts correctly', () => {
            expect(new MonetaryDecimal(100).toDollarAmount()).toBe(1.0);
            expect(new MonetaryDecimal(123).toDollarAmount()).toBe(1.23);
            expect(new MonetaryDecimal(50).toDollarAmount()).toBe(0.5);
            expect(new MonetaryDecimal(1).toDollarAmount()).toBe(0.01);
            expect(new MonetaryDecimal(0).toDollarAmount()).toBe(0.0);
        });

        it('should handle negative amounts', () => {
            expect(new MonetaryDecimal(-100).toDollarAmount()).toBe(-1.0);
            expect(new MonetaryDecimal(-123).toDollarAmount()).toBe(-1.23);
        });

        it('should handle large amounts', () => {
            expect(new MonetaryDecimal(123456).toDollarAmount()).toBe(1234.56);
            expect(new MonetaryDecimal(1000000).toDollarAmount()).toBe(10000.0);
        });

        it('should round to 2 decimal places', () => {
            // Test that it properly formats to 2 decimal places
            expect(new MonetaryDecimal(100).toDollarAmount()).toBe(1.0);
            expect(new MonetaryDecimal(105).toDollarAmount()).toBe(1.05);
        });
    });

    describe('static methods', () => {
        describe('max', () => {
            it('should return the maximum value', () => {
                const values = [
                    new MonetaryDecimal(100),
                    new MonetaryDecimal(200),
                    new MonetaryDecimal(50),
                ];
                const result = MonetaryDecimal.max(...values);
                expect(result.toNumber()).toBe(200);
            });

            it('should handle negative values', () => {
                const values = [
                    new MonetaryDecimal(-100),
                    new MonetaryDecimal(-200),
                    new MonetaryDecimal(-50),
                ];
                const result = MonetaryDecimal.max(...values);
                expect(result.toNumber()).toBe(-50);
            });

            it('should handle single value', () => {
                const result = MonetaryDecimal.max(new MonetaryDecimal(42));
                expect(result.toNumber()).toBe(42);
            });

            it('should handle mixed positive and negative', () => {
                const values = [
                    new MonetaryDecimal(-100),
                    new MonetaryDecimal(200),
                    new MonetaryDecimal(-50),
                ];
                const result = MonetaryDecimal.max(...values);
                expect(result.toNumber()).toBe(200);
            });
        });

        describe('min', () => {
            it('should return the minimum value', () => {
                const values = [
                    new MonetaryDecimal(100),
                    new MonetaryDecimal(200),
                    new MonetaryDecimal(50),
                ];
                const result = MonetaryDecimal.min(...values);
                expect(result.toNumber()).toBe(50);
            });

            it('should handle negative values', () => {
                const values = [
                    new MonetaryDecimal(-100),
                    new MonetaryDecimal(-200),
                    new MonetaryDecimal(-50),
                ];
                const result = MonetaryDecimal.min(...values);
                expect(result.toNumber()).toBe(-200);
            });

            it('should handle single value', () => {
                const result = MonetaryDecimal.min(new MonetaryDecimal(42));
                expect(result.toNumber()).toBe(42);
            });

            it('should handle mixed positive and negative', () => {
                const values = [
                    new MonetaryDecimal(-100),
                    new MonetaryDecimal(200),
                    new MonetaryDecimal(50),
                ];
                const result = MonetaryDecimal.min(...values);
                expect(result.toNumber()).toBe(-100);
            });
        });

        describe('clamp', () => {
            it('should clamp value within range', () => {
                const value = new MonetaryDecimal(150);
                const min = new MonetaryDecimal(100);
                const max = new MonetaryDecimal(200);
                const result = MonetaryDecimal.clamp(value, min, max);
                expect(result.toNumber()).toBe(150);
            });

            it('should clamp value to minimum', () => {
                const value = new MonetaryDecimal(50);
                const min = new MonetaryDecimal(100);
                const max = new MonetaryDecimal(200);
                const result = MonetaryDecimal.clamp(value, min, max);
                expect(result.toNumber()).toBe(100);
            });

            it('should clamp value to maximum', () => {
                const value = new MonetaryDecimal(250);
                const min = new MonetaryDecimal(100);
                const max = new MonetaryDecimal(200);
                const result = MonetaryDecimal.clamp(value, min, max);
                expect(result.toNumber()).toBe(200);
            });

            it('should handle negative ranges', () => {
                const value = new MonetaryDecimal(-150);
                const min = new MonetaryDecimal(-200);
                const max = new MonetaryDecimal(-100);
                const result = MonetaryDecimal.clamp(value, min, max);
                expect(result.toNumber()).toBe(-150);
            });

            it('should clamp to negative minimum', () => {
                const value = new MonetaryDecimal(-250);
                const min = new MonetaryDecimal(-200);
                const max = new MonetaryDecimal(-100);
                const result = MonetaryDecimal.clamp(value, min, max);
                expect(result.toNumber()).toBe(-200);
            });
        });
    });

    describe('edge cases', () => {
        it('should handle zero operations', () => {
            const zero = new MonetaryDecimal(0);
            const hundred = new MonetaryDecimal(100);

            expect(zero.plus(hundred).toNumber()).toBe(100);
            expect(hundred.plus(zero).toNumber()).toBe(100);
            expect(hundred.minus(zero).toNumber()).toBe(100);
            expect(zero.times(100).toNumber()).toBe(0);
        });

        it('should handle very large numbers', () => {
            const large1 = new MonetaryDecimal(Number.MAX_SAFE_INTEGER);
            const large2 = new MonetaryDecimal(Number.MAX_SAFE_INTEGER);

            expect(large1.equals(large2)).toBeTruthy();
            expect(large1.toString()).toBe(Number.MAX_SAFE_INTEGER.toString());
        });

        it('should maintain immutability', () => {
            const original = new MonetaryDecimal(100);
            const added = original.plus(new MonetaryDecimal(50));

            expect(original.toNumber()).toBe(100); // Original unchanged
            expect(added.toNumber()).toBe(150); // New instance created
        });
    });
});

describe('MonetaryDecimalTransformer', () => {
    let transformer: MonetaryDecimalTransformer;

    beforeEach(() => {
        transformer = new MonetaryDecimalTransformer();
    });

    describe('to method (marshal to database)', () => {
        it('should convert MonetaryDecimal to string', () => {
            const monetary = new MonetaryDecimal(12345);
            const result = transformer.to(monetary);

            expect(result).toBe('12345');
            expect(typeof result).toBe('string');
        });

        it('should handle zero values', () => {
            const monetary = new MonetaryDecimal(0);
            const result = transformer.to(monetary);

            expect(result).toBe('0');
        });

        it('should handle negative values', () => {
            const monetary = new MonetaryDecimal(-500);
            const result = transformer.to(monetary);

            expect(result).toBe('-500');
        });

        it('should return null for undefined input', () => {
            const result = transformer.to(undefined);

            expect(result).toBeNull();
        });

        it('should handle large values', () => {
            const monetary = new MonetaryDecimal(999999999);
            const result = transformer.to(monetary);

            expect(result).toBe('999999999');
        });
    });

    describe('from method (unmarshal from database)', () => {
        it('should convert string to MonetaryDecimal', () => {
            const result = transformer.from('12345');

            expect(result).toBeInstanceOf(MonetaryDecimal);
            expect(result?.toNumber()).toBe(12345);
        });

        it('should handle zero strings', () => {
            const result = transformer.from('0');

            expect(result).toBeInstanceOf(MonetaryDecimal);
            expect(result?.toNumber()).toBe(0);
        });

        it('should handle negative value strings', () => {
            const result = transformer.from('-500');

            expect(result).toBeInstanceOf(MonetaryDecimal);
            expect(result?.toNumber()).toBe(-500);
        });

        it('should return null for null input', () => {
            const result = transformer.from(null);

            expect(result).toBeNull();
        });

        it('should return null for undefined input', () => {
            const result = transformer.from(undefined);

            expect(result).toBeNull();
        });

        it('should handle large number strings', () => {
            const result = transformer.from('999999999');

            expect(result).toBeInstanceOf(MonetaryDecimal);
            expect(result?.toNumber()).toBe(999999999);
        });

        it('should throw error for non-integer strings', () => {
            expect(() => transformer.from('123.45')).toThrow(
                'MonetaryDecimal can only accept integer[cent] values',
            );
        });

        it('should throw error for invalid strings', () => {
            expect(() => transformer.from('invalid')).toThrow();
            expect(() => transformer.from('abc123')).toThrow();
            expect(() => transformer.from('')).toThrow();
        });
    });

    describe('roundtrip transformation', () => {
        it('should maintain value through roundtrip', () => {
            const originalValue = '12345';
            const monetary = transformer.from(originalValue);
            const stringValue = transformer.to(monetary!);
            const roundtripMonetary = transformer.from(stringValue);

            expect(stringValue).toBe(originalValue);
            expect(roundtripMonetary?.toNumber()).toBe(12345);
        });

        it('should handle negative values in roundtrip', () => {
            const originalValue = '-500';
            const monetary = transformer.from(originalValue);
            const stringValue = transformer.to(monetary!);
            const roundtripMonetary = transformer.from(stringValue);

            expect(stringValue).toBe(originalValue);
            expect(roundtripMonetary?.toNumber()).toBe(-500);
        });

        it('should handle zero in roundtrip', () => {
            const originalValue = '0';
            const monetary = transformer.from(originalValue);
            const stringValue = transformer.to(monetary!);
            const roundtripMonetary = transformer.from(stringValue);

            expect(stringValue).toBe(originalValue);
            expect(roundtripMonetary?.toNumber()).toBe(0);
        });
    });

    describe('type compatibility', () => {
        it('should implement ValueTransformer interface', () => {
            expect(transformer.to).toBeDefined();
            expect(transformer.from).toBeDefined();
            expect(typeof transformer.to).toBe('function');
            expect(typeof transformer.from).toBe('function');
        });

        it('should return correct types', () => {
            const monetary = new MonetaryDecimal(100);
            const toResult = transformer.to(monetary);
            const fromResult = transformer.from('100');

            expect(typeof toResult).toBe('string');
            expect(fromResult).toBeInstanceOf(MonetaryDecimal);
        });

        it('should handle null returns correctly', () => {
            const toResult = transformer.to(undefined);
            const fromResult = transformer.from(null);

            expect(toResult).toBeNull();
            expect(fromResult).toBeNull();
        });
    });
});
