// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Decimal } from 'decimal.js';
import { FloatValueNode, IntValueNode, Kind, StringValueNode } from 'graphql';

import { MonetaryDecimal } from '../database/MonetaryDecimal';
import { DecimalScalar, MonetaryDecimalScalar } from './Decimal';

describe('Decimal GraphQL Scalars', () => {
    describe('DecimalScalar', () => {
        describe('serialize', () => {
            it('should serialize Decimal values to string', () => {
                const decimal = new Decimal('123.456');
                const result = DecimalScalar.serialize(decimal);
                expect(result).toBe('123.456');
            });

            it('should serialize integer Decimal values to string', () => {
                const decimal = new Decimal(100);
                const result = DecimalScalar.serialize(decimal);
                expect(result).toBe('100');
            });

            it('should serialize zero Decimal values to string', () => {
                const decimal = new Decimal(0);
                const result = DecimalScalar.serialize(decimal);
                expect(result).toBe('0');
            });

            it('should serialize negative Decimal values to string', () => {
                const decimal = new Decimal('-45.67');
                const result = DecimalScalar.serialize(decimal);
                expect(result).toBe('-45.67');
            });

            it('should throw error for non-Decimal values', () => {
                expect(() => DecimalScalar.serialize('123')).toThrow(
                    'DecimalScalar can only serialize Decimal values',
                );
            });

            it('should throw error for number values', () => {
                expect(() => DecimalScalar.serialize(123)).toThrow(
                    'DecimalScalar can only serialize Decimal values',
                );
            });

            it('should throw error for null values', () => {
                expect(() => DecimalScalar.serialize(null)).toThrow(
                    'DecimalScalar can only serialize Decimal values',
                );
            });

            it('should throw error for undefined values', () => {
                expect(() => DecimalScalar.serialize(undefined)).toThrow(
                    'DecimalScalar can only serialize Decimal values',
                );
            });
        });

        describe('parseValue', () => {
            it('should parse string values to Decimal', () => {
                const result = DecimalScalar.parseValue('123.456');
                expect(result).toBeInstanceOf(Decimal);
                expect(result.toString()).toBe('123.456');
            });

            it('should parse integer string values to Decimal', () => {
                const result = DecimalScalar.parseValue('100');
                expect(result).toBeInstanceOf(Decimal);
                expect(result.toString()).toBe('100');
            });

            it('should parse zero string values to Decimal', () => {
                const result = DecimalScalar.parseValue('0');
                expect(result).toBeInstanceOf(Decimal);
                expect(result.toString()).toBe('0');
            });

            it('should parse negative string values to Decimal', () => {
                const result = DecimalScalar.parseValue('-45.67');
                expect(result).toBeInstanceOf(Decimal);
                expect(result.toString()).toBe('-45.67');
            });

            it('should parse scientific notation string values to Decimal', () => {
                const result = DecimalScalar.parseValue('1.23e-4');
                expect(result).toBeInstanceOf(Decimal);
                expect(result.toString()).toBe('0.000123');
            });

            it('should throw error for non-string values', () => {
                expect(() => DecimalScalar.parseValue(123)).toThrow(
                    'DecimalScalar can only parse string values',
                );
            });

            it('should throw error for null values', () => {
                expect(() => DecimalScalar.parseValue(null)).toThrow(
                    'DecimalScalar can only parse string values',
                );
            });

            it('should throw error for undefined values', () => {
                expect(() => DecimalScalar.parseValue(undefined)).toThrow(
                    'DecimalScalar can only parse string values',
                );
            });

            it('should throw error for invalid string values', () => {
                expect(() => DecimalScalar.parseValue('invalid')).toThrow();
            });
        });

        describe('parseLiteral', () => {
            it('should parse STRING AST nodes to Decimal', () => {
                const ast: StringValueNode = {
                    kind: Kind.STRING,
                    value: '123.456',
                };
                const result = DecimalScalar.parseLiteral(ast);
                expect(result).toBeInstanceOf(Decimal);
                expect(result.toString()).toBe('123.456');
            });

            it('should parse integer STRING AST nodes to Decimal', () => {
                const ast: StringValueNode = {
                    kind: Kind.STRING,
                    value: '100',
                };
                const result = DecimalScalar.parseLiteral(ast);
                expect(result).toBeInstanceOf(Decimal);
                expect(result.toString()).toBe('100');
            });

            it('should parse negative STRING AST nodes to Decimal', () => {
                const ast: StringValueNode = {
                    kind: Kind.STRING,
                    value: '-45.67',
                };
                const result = DecimalScalar.parseLiteral(ast);
                expect(result).toBeInstanceOf(Decimal);
                expect(result.toString()).toBe('-45.67');
            });

            it('should throw error for non-STRING AST nodes', () => {
                const ast: IntValueNode = {
                    kind: Kind.INT,
                    value: '123',
                };
                expect(() => DecimalScalar.parseLiteral(ast)).toThrow(
                    'DecimalScalar can only parse string values',
                );
            });

            it('should throw error for FLOAT AST nodes', () => {
                const ast: FloatValueNode = {
                    kind: Kind.FLOAT,
                    value: '123.456',
                };
                expect(() => DecimalScalar.parseLiteral(ast)).toThrow(
                    'DecimalScalar can only parse string values',
                );
            });

            it('should throw error for invalid string values in AST', () => {
                const ast: StringValueNode = {
                    kind: Kind.STRING,
                    value: 'invalid',
                };
                expect(() => DecimalScalar.parseLiteral(ast)).toThrow();
            });
        });
    });

    describe('MonetaryDecimalScalar', () => {
        describe('serialize', () => {
            it('should serialize MonetaryDecimal values to dollar string', () => {
                const monetaryDecimal = new MonetaryDecimal(12345); // 123.45 dollars in cents
                const result = MonetaryDecimalScalar.serialize(monetaryDecimal);
                expect(result).toBe('123.45');
            });

            it('should serialize whole dollar MonetaryDecimal values', () => {
                const monetaryDecimal = new MonetaryDecimal(10000); // 100.00 dollars in cents
                const result = MonetaryDecimalScalar.serialize(monetaryDecimal);
                expect(result).toBe('100');
            });

            it('should serialize zero MonetaryDecimal values', () => {
                const monetaryDecimal = new MonetaryDecimal(0); // 0.00 dollars in cents
                const result = MonetaryDecimalScalar.serialize(monetaryDecimal);
                expect(result).toBe('0');
            });

            it('should serialize single cent MonetaryDecimal values', () => {
                const monetaryDecimal = new MonetaryDecimal(1); // 0.01 dollars in cents
                const result = MonetaryDecimalScalar.serialize(monetaryDecimal);
                expect(result).toBe('0.01');
            });

            it('should serialize negative MonetaryDecimal values', () => {
                const monetaryDecimal = new MonetaryDecimal(-12345); // -123.45 dollars in cents
                const result = MonetaryDecimalScalar.serialize(monetaryDecimal);
                expect(result).toBe('-123.45');
            });

            it('should throw error for non-MonetaryDecimal values', () => {
                expect(() => MonetaryDecimalScalar.serialize('123')).toThrow(
                    'DecimalScalar can only serialize Decimal values',
                );
            });

            it('should throw error for Decimal values', () => {
                const decimal = new Decimal('123.45');
                expect(() => MonetaryDecimalScalar.serialize(decimal)).toThrow(
                    'DecimalScalar can only serialize Decimal values',
                );
            });

            it('should throw error for number values', () => {
                expect(() => MonetaryDecimalScalar.serialize(123)).toThrow(
                    'DecimalScalar can only serialize Decimal values',
                );
            });

            it('should throw error for null values', () => {
                expect(() => MonetaryDecimalScalar.serialize(null)).toThrow(
                    'DecimalScalar can only serialize Decimal values',
                );
            });
        });

        describe('parseValue', () => {
            it('should parse string dollar values to MonetaryDecimal in cents', () => {
                const result = MonetaryDecimalScalar.parseValue('123.45');
                expect(result).toBeInstanceOf(MonetaryDecimal);
                expect(result.toString()).toBe('12345'); // stored as cents
            });

            it('should parse whole dollar string values to MonetaryDecimal', () => {
                const result = MonetaryDecimalScalar.parseValue('100');
                expect(result).toBeInstanceOf(MonetaryDecimal);
                expect(result.toString()).toBe('10000'); // stored as cents
            });

            it('should parse zero string values to MonetaryDecimal', () => {
                const result = MonetaryDecimalScalar.parseValue('0');
                expect(result).toBeInstanceOf(MonetaryDecimal);
                expect(result.toString()).toBe('0'); // stored as cents
            });

            it('should parse small decimal values to MonetaryDecimal', () => {
                const result = MonetaryDecimalScalar.parseValue('0.01');
                expect(result).toBeInstanceOf(MonetaryDecimal);
                expect(result.toString()).toBe('1'); // stored as cents
            });

            it('should parse negative dollar values to MonetaryDecimal', () => {
                const result = MonetaryDecimalScalar.parseValue('-123.45');
                expect(result).toBeInstanceOf(MonetaryDecimal);
                expect(result.toString()).toBe('-12345'); // stored as cents
            });

            it('should throw error for values with fractional cents', () => {
                expect(() => MonetaryDecimalScalar.parseValue('1.234')).toThrow(
                    'MonetaryDecimal can only accept integer[cent] values',
                );
            });

            it('should throw error for non-string values', () => {
                expect(() => MonetaryDecimalScalar.parseValue(123)).toThrow(
                    'DecimalScalar can only parse string values',
                );
            });

            it('should throw error for null values', () => {
                expect(() => MonetaryDecimalScalar.parseValue(null)).toThrow(
                    'DecimalScalar can only parse string values',
                );
            });

            it('should throw error for undefined values', () => {
                expect(() =>
                    MonetaryDecimalScalar.parseValue(undefined),
                ).toThrow('DecimalScalar can only parse string values');
            });

            it('should throw error for invalid string values', () => {
                expect(() =>
                    MonetaryDecimalScalar.parseValue('invalid'),
                ).toThrow();
            });
        });

        describe('parseLiteral', () => {
            it('should parse STRING AST nodes with dollar values to MonetaryDecimal', () => {
                const ast: StringValueNode = {
                    kind: Kind.STRING,
                    value: '123.45',
                };
                const result = MonetaryDecimalScalar.parseLiteral(ast);
                expect(result).toBeInstanceOf(MonetaryDecimal);
                expect(result.toString()).toBe('12345'); // stored as cents
            });

            it('should parse whole dollar STRING AST nodes to MonetaryDecimal', () => {
                const ast: StringValueNode = {
                    kind: Kind.STRING,
                    value: '100',
                };
                const result = MonetaryDecimalScalar.parseLiteral(ast);
                expect(result).toBeInstanceOf(MonetaryDecimal);
                expect(result.toString()).toBe('10000'); // stored as cents
            });

            it('should parse zero STRING AST nodes to MonetaryDecimal', () => {
                const ast: StringValueNode = {
                    kind: Kind.STRING,
                    value: '0',
                };
                const result = MonetaryDecimalScalar.parseLiteral(ast);
                expect(result).toBeInstanceOf(MonetaryDecimal);
                expect(result.toString()).toBe('0'); // stored as cents
            });

            it('should parse negative STRING AST nodes to MonetaryDecimal', () => {
                const ast: StringValueNode = {
                    kind: Kind.STRING,
                    value: '-123.45',
                };
                const result = MonetaryDecimalScalar.parseLiteral(ast);
                expect(result).toBeInstanceOf(MonetaryDecimal);
                expect(result.toString()).toBe('-12345'); // stored as cents
            });

            it('should throw error for non-STRING AST nodes', () => {
                const ast: IntValueNode = {
                    kind: Kind.INT,
                    value: '123',
                };
                expect(() => MonetaryDecimalScalar.parseLiteral(ast)).toThrow(
                    'DecimalScalar can only parse string values',
                );
            });

            it('should throw error for FLOAT AST nodes', () => {
                const ast: FloatValueNode = {
                    kind: Kind.FLOAT,
                    value: '123.45',
                };
                expect(() => MonetaryDecimalScalar.parseLiteral(ast)).toThrow(
                    'DecimalScalar can only parse string values',
                );
            });

            it('should throw error for invalid string values in AST', () => {
                const ast: StringValueNode = {
                    kind: Kind.STRING,
                    value: 'invalid',
                };
                expect(() => MonetaryDecimalScalar.parseLiteral(ast)).toThrow();
            });
        });
    });

    describe('Scalar metadata', () => {
        it('should have correct name and description for DecimalScalar', () => {
            expect(DecimalScalar.name).toBe('Decimal');
            expect(DecimalScalar.description).toBe(
                'Decimal custom scalar type',
            );
        });

        it('should have correct name and description for MonetaryDecimalScalar', () => {
            expect(MonetaryDecimalScalar.name).toBe('MonetaryDecimal');
            expect(MonetaryDecimalScalar.description).toBe(
                'Monetary decimal custom scalar type, we stored and operate the value in cents, and this scalar will convert the value to dollar when read and convert the value to cents when write.',
            );
        });
    });
});
