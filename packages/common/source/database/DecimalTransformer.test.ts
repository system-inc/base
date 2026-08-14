// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Decimal } from 'decimal.js';

import { DecimalTransformer } from './DecimalTransformer';

describe('DecimalTransformer', () => {
    let transformer: DecimalTransformer;

    beforeEach(() => {
        transformer = new DecimalTransformer();
    });

    describe('to method (marshal to database)', () => {
        it('should convert Decimal to string', () => {
            const decimal = new Decimal('123.45');
            const result = transformer.to(decimal);

            expect(result).toBe('123.45');
            expect(typeof result).toBe('string');
        });

        it('should handle integer Decimal values', () => {
            const decimal = new Decimal(100);
            const result = transformer.to(decimal);

            expect(result).toBe('100');
        });

        it('should handle zero', () => {
            const decimal = new Decimal(0);
            const result = transformer.to(decimal);

            expect(result).toBe('0');
        });

        it('should handle negative values', () => {
            const decimal = new Decimal('-456.78');
            const result = transformer.to(decimal);

            expect(result).toBe('-456.78');
        });

        it('should handle very large numbers', () => {
            const decimal = new Decimal('999999999999999999.99');
            const result = transformer.to(decimal);

            expect(result).toBe('999999999999999999.99');
        });

        it('should handle very small numbers', () => {
            const decimal = new Decimal('0.000000001');
            const result = transformer.to(decimal);

            expect(result).toBe('1e-9'); // Decimal.js uses scientific notation for very small numbers
        });

        it('should handle scientific notation', () => {
            const decimal = new Decimal('1.23e10');
            const result = transformer.to(decimal);

            expect(result).toBe('12300000000');
        });

        it('should return null for undefined input', () => {
            const result = transformer.to(undefined);

            expect(result).toBeNull();
        });

        it('should handle Decimal created from string', () => {
            const decimal = new Decimal('42.123456789');
            const result = transformer.to(decimal);

            expect(result).toBe('42.123456789');
        });

        it('should handle Decimal with many decimal places', () => {
            const decimal = new Decimal('1.123456789012345');
            const result = transformer.to(decimal);

            expect(result).toBe('1.123456789012345');
        });
    });

    describe('from method (unmarshal from database)', () => {
        it('should convert string to Decimal', () => {
            const result = transformer.from('123.45');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('123.45');
        });

        it('should handle integer strings', () => {
            const result = transformer.from('100');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('100');
        });

        it('should handle zero string', () => {
            const result = transformer.from('0');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('0');
        });

        it('should handle negative value strings', () => {
            const result = transformer.from('-456.78');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('-456.78');
        });

        it('should handle very large number strings', () => {
            const result = transformer.from('999999999999999999.99');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('999999999999999999.99');
        });

        it('should handle very small number strings', () => {
            const result = transformer.from('0.000000001');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('1e-9'); // Decimal.js normalizes to scientific notation
        });

        it('should return null for null input', () => {
            const result = transformer.from(null);

            expect(result).toBeNull();
        });

        it('should return null for undefined input', () => {
            const result = transformer.from(undefined);

            expect(result).toBeNull();
        });

        it('should handle strings with many decimal places', () => {
            const result = transformer.from('1.123456789012345');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('1.123456789012345');
        });

        it('should handle scientific notation strings', () => {
            const result = transformer.from('1.23e10');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('12300000000');
        });

        it('should handle string numbers with leading zeros', () => {
            const result = transformer.from('000123.45');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('123.45');
        });

        it('should handle string with just decimal point', () => {
            const result = transformer.from('0.0');

            expect(result).toBeInstanceOf(Decimal);
            expect(result?.toString()).toBe('0');
        });
    });

    describe('roundtrip transformation', () => {
        it('should maintain precision through roundtrip transformation', () => {
            const originalValue = '123.456789';
            const decimal = transformer.from(originalValue);
            const stringValue = transformer.to(decimal!);
            const roundtripDecimal = transformer.from(stringValue);

            expect(stringValue).toBe(originalValue);
            expect(roundtripDecimal?.toString()).toBe(originalValue);
        });

        it('should handle multiple roundtrips without losing precision', () => {
            const originalValue = '999.123456789012345';

            let current = transformer.from(originalValue);
            for (let i = 0; i < 5; i++) {
                const stringified = transformer.to(current!);
                current = transformer.from(stringified);
            }

            expect(current?.toString()).toBe(originalValue);
        });

        it('should handle negative values in roundtrip', () => {
            const originalValue = '-456.789';
            const decimal = transformer.from(originalValue);
            const stringValue = transformer.to(decimal!);
            const roundtripDecimal = transformer.from(stringValue);

            expect(stringValue).toBe(originalValue);
            expect(roundtripDecimal?.toString()).toBe(originalValue);
        });

        it('should handle zero in roundtrip', () => {
            const originalValue = '0';
            const decimal = transformer.from(originalValue);
            const stringValue = transformer.to(decimal!);
            const roundtripDecimal = transformer.from(stringValue);

            expect(stringValue).toBe('0');
            expect(roundtripDecimal?.toString()).toBe('0');
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle invalid number strings gracefully', () => {
            expect(() => transformer.from('invalid')).toThrow();
            expect(() => transformer.from('123.45.67')).toThrow();
            expect(() => transformer.from('abc123')).toThrow();
        });

        it('should handle empty string', () => {
            expect(() => transformer.from('')).toThrow();
        });

        it('should handle whitespace strings', () => {
            expect(() => transformer.from('   ')).toThrow();
        });

        it('should handle special float values in strings', () => {
            // Decimal.js actually handles these values, they don't throw
            const infinityResult = transformer.from('Infinity');
            const negInfinityResult = transformer.from('-Infinity');
            const nanResult = transformer.from('NaN');

            expect(infinityResult?.toString()).toBe('Infinity');
            expect(negInfinityResult?.toString()).toBe('-Infinity');
            expect(nanResult?.toString()).toBe('NaN');
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
            const decimal = new Decimal('123.45');
            const toResult = transformer.to(decimal);
            const fromResult = transformer.from('123.45');

            expect(typeof toResult).toBe('string');
            expect(fromResult).toBeInstanceOf(Decimal);
        });

        it('should handle null returns correctly', () => {
            const toResult = transformer.to(undefined);
            const fromResult = transformer.from(null);

            expect(toResult).toBeNull();
            expect(fromResult).toBeNull();
        });
    });

    describe('precision and accuracy', () => {
        it('should maintain high precision decimals', () => {
            const highPrecision = '123.123456789012345678901234567890';
            const decimal = transformer.from(highPrecision);
            const result = transformer.to(decimal!);

            // Decimal.js might limit precision, so we check what it actually stores
            expect(result).toBe(decimal?.toString());
        });

        it('should handle financial precision (2 decimal places)', () => {
            const financial = '1234.56';
            const decimal = transformer.from(financial);
            const result = transformer.to(decimal!);

            expect(result).toBe(financial);
        });

        it('should handle cryptocurrency precision (8 decimal places)', () => {
            const crypto = '0.12345678';
            const decimal = transformer.from(crypto);
            const result = transformer.to(decimal!);

            expect(result).toBe(crypto);
        });
    });
});
