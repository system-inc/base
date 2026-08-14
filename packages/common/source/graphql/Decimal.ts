// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Decimal } from 'decimal.js';
import { GraphQLScalarType, Kind } from 'graphql';

import { MonetaryDecimal } from '../database/MonetaryDecimal';

export const DecimalScalar = new GraphQLScalarType({
    name: 'Decimal',
    description: 'Decimal custom scalar type',
    serialize(value: unknown): string {
        // Check type of value
        if (!(value instanceof Decimal)) {
            throw new Error('DecimalScalar can only serialize Decimal values');
        }
        return value.toString();
    },
    parseValue(value: unknown): Decimal {
        // Check type of value
        if (typeof value !== 'string') {
            throw new Error('DecimalScalar can only parse string values');
        }
        return new Decimal(value);
    },
    parseLiteral(ast): Decimal {
        // Check type of value
        if (ast.kind !== Kind.STRING) {
            throw new Error('DecimalScalar can only parse string values');
        }
        return new Decimal(ast.value);
    },
});

export const MonetaryDecimalScalar = new GraphQLScalarType({
    name: 'MonetaryDecimal',
    description:
        'Monetary decimal custom scalar type, we stored and operate the value in cents, and this scalar will convert the value to dollar when read and convert the value to cents when write.',
    serialize(value: unknown): string {
        // Check type of value
        if (!(value instanceof MonetaryDecimal)) {
            throw new Error('DecimalScalar can only serialize Decimal values');
        }
        return new Decimal(value.toNumber()).div(100).toString();
    },
    parseValue(value: unknown): MonetaryDecimal {
        // Check type of value
        if (typeof value !== 'string') {
            throw new Error('DecimalScalar can only parse string values');
        }
        const inputValue = new MonetaryDecimal(new Decimal(value).times(100));
        return inputValue;
    },
    parseLiteral(ast): MonetaryDecimal {
        // Check type of value
        if (ast.kind !== Kind.STRING) {
            throw new Error('DecimalScalar can only parse string values');
        }
        const inputValue = new MonetaryDecimal(
            new Decimal(ast.value).times(100),
        );
        return inputValue;
    },
});
