// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { formatCurrency } from './FormatCurrency';

describe('FormatCurrency', () => {
    describe('formatCurrency', () => {
        describe('default behavior (en-US locale)', () => {
            it('should format whole numbers without decimals', () => {
                expect(formatCurrency(1000)).toBe('$1,000');
                expect(formatCurrency(2500)).toBe('$2,500');
                expect(formatCurrency(0)).toBe('$0');
                expect(formatCurrency(42)).toBe('$42');
            });

            it('should format decimal numbers with 2 decimal places', () => {
                expect(formatCurrency(1000.5)).toBe('$1,000.50');
                expect(formatCurrency(2500.25)).toBe('$2,500.25');
                expect(formatCurrency(0.99)).toBe('$0.99');
                expect(formatCurrency(42.01)).toBe('$42.01');
            });

            it('should handle large numbers with proper thousands separators', () => {
                expect(formatCurrency(1000000)).toBe('$1,000,000');
                expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
                expect(formatCurrency(999999999)).toBe('$999,999,999');
            });

            it('should handle small decimal amounts', () => {
                expect(formatCurrency(0.01)).toBe('$0.01');
                expect(formatCurrency(0.1)).toBe('$0.10');
                expect(formatCurrency(0.001)).toBe('$0.00'); // rounds to 2 decimal places
            });

            it('should handle negative amounts', () => {
                expect(formatCurrency(-1000)).toBe('-$1,000');
                expect(formatCurrency(-2500.5)).toBe('-$2,500.50');
                expect(formatCurrency(-0.99)).toBe('-$0.99');
            });

            it('should round to 2 decimal places when needed', () => {
                expect(formatCurrency(1000.999)).toBe('$1,001.00');
                expect(formatCurrency(2500.001)).toBe('$2,500.00');
                expect(formatCurrency(42.126)).toBe('$42.13');
                expect(formatCurrency(42.124)).toBe('$42.12');
            });
        });

        describe('with custom minDecimals option', () => {
            it('should force decimal places when minDecimals is specified', () => {
                expect(formatCurrency(1000, { minDecimals: 2 })).toBe(
                    '$1,000.00',
                );
                expect(formatCurrency(2500, { minDecimals: 2 })).toBe(
                    '$2,500.00',
                );
                expect(formatCurrency(0, { minDecimals: 2 })).toBe('$0.00');
            });

            it('should respect minDecimals even for whole numbers', () => {
                expect(formatCurrency(42, { minDecimals: 0 })).toBe('$42');
                expect(formatCurrency(42, { minDecimals: 1 })).toBe('$42.0');
                expect(formatCurrency(42, { minDecimals: 2 })).toBe('$42.00');
            });

            it('should still show decimals for decimal numbers regardless of minDecimals', () => {
                expect(formatCurrency(42.5, { minDecimals: 0 })).toBe('$42.5');
                expect(formatCurrency(42.25, { minDecimals: 1 })).toBe(
                    '$42.25',
                );
            });
        });

        describe('with different locales', () => {
            it('should format with German locale', () => {
                expect(formatCurrency(1234.56, { locale: 'de-DE' })).toBe(
                    '1.234,56\u00A0$',
                );
            });

            it('should format with French locale', () => {
                expect(formatCurrency(1234.56, { locale: 'fr-FR' })).toBe(
                    '1\u202F234,56\u00A0$US',
                );
            });

            it('should format with Japanese locale', () => {
                expect(formatCurrency(1234, { locale: 'ja-JP' })).toBe(
                    '$1,234',
                );
            });

            it('should handle custom locale with minDecimals', () => {
                expect(
                    formatCurrency(1000, { locale: 'de-DE', minDecimals: 2 }),
                ).toBe('1.000,00\u00A0$');
            });
        });

        describe('edge cases', () => {
            it('should handle very small numbers', () => {
                expect(formatCurrency(0.001)).toBe('$0.00');
                expect(formatCurrency(0.004)).toBe('$0.00');
                expect(formatCurrency(0.005)).toBe('$0.01');
                expect(formatCurrency(0.009)).toBe('$0.01');
            });

            it('should handle very large numbers', () => {
                expect(formatCurrency(Number.MAX_SAFE_INTEGER)).toContain('$');
                expect(formatCurrency(1e12)).toBe('$1,000,000,000,000');
            });

            it('should handle floating point precision issues', () => {
                expect(formatCurrency(0.1 + 0.2)).toBe('$0.30'); // 0.1 + 0.2 = 0.30000000000000004
                expect(formatCurrency(1.005)).toBe('$1.01'); // Rounding behavior
            });

            it('should handle zero with different options', () => {
                expect(formatCurrency(0)).toBe('$0');
                expect(formatCurrency(0, { minDecimals: 0 })).toBe('$0');
                expect(formatCurrency(0, { minDecimals: 2 })).toBe('$0.00');
                expect(formatCurrency(0, { locale: 'de-DE' })).toBe('0\u00A0$');
            });

            it('should handle negative zero', () => {
                expect(formatCurrency(-0)).toBe('-$0');
            });
        });

        describe('parameter validation', () => {
            it('should handle NaN gracefully', () => {
                const result = formatCurrency(NaN);
                expect(typeof result).toBe('string');
                expect(result).toContain('NaN');
            });

            it('should handle Infinity gracefully', () => {
                const resultPos = formatCurrency(Infinity);
                const resultNeg = formatCurrency(-Infinity);
                expect(typeof resultPos).toBe('string');
                expect(typeof resultNeg).toBe('string');
                expect(resultPos).toContain('∞');
                expect(resultNeg).toContain('∞');
            });

            it('should handle undefined options', () => {
                expect(formatCurrency(1000, undefined)).toBe('$1,000');
                expect(formatCurrency(1000.5, undefined)).toBe('$1,000.50');
            });

            it('should handle empty options object', () => {
                expect(formatCurrency(1000, {})).toBe('$1,000');
                expect(formatCurrency(1000.5, {})).toBe('$1,000.50');
            });
        });

        describe('consistency tests', () => {
            it('should produce consistent results for same input', () => {
                const amount = 1234.56;
                const options = { locale: 'en-US', minDecimals: 2 };
                const result1 = formatCurrency(amount, options);
                const result2 = formatCurrency(amount, options);
                expect(result1).toBe(result2);
            });

            it('should handle various decimal patterns consistently', () => {
                expect(formatCurrency(1.0)).toBe('$1');
                expect(formatCurrency(1.0)).toBe('$1');
                expect(formatCurrency(1.1)).toBe('$1.10');
                expect(formatCurrency(1.01)).toBe('$1.01');
            });
        });
    });
});
