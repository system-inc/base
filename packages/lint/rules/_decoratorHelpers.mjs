// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import ts from 'typescript';

export const RELATION_DECORATORS = new Set([
    'OrmManyToOne',
    'OrmOneToMany',
    'OrmOneToOne',
]);

export function hasRelationDecorator(node) {
    if (!node || !node.decorators) return false;
    return node.decorators.some((dec) => {
        if (dec.expression.type !== 'CallExpression') return false;
        if (dec.expression.callee.type !== 'Identifier') return false;
        return RELATION_DECORATORS.has(dec.expression.callee.name);
    });
}

const NULLABLE_FLAGS =
    ts.TypeFlags.Null |
    ts.TypeFlags.Undefined |
    ts.TypeFlags.Any |
    ts.TypeFlags.Unknown |
    ts.TypeFlags.Void;

export function isNullableType(type) {
    if ((type.flags & NULLABLE_FLAGS) !== 0) return true;
    if (type.isUnion && type.isUnion()) {
        return type.types.some(isNullableType);
    }
    return false;
}

const UNDEFINED_FLAGS =
    ts.TypeFlags.Undefined | ts.TypeFlags.Any | ts.TypeFlags.Unknown;

export function typeIncludesUndefined(type) {
    if ((type.flags & UNDEFINED_FLAGS) !== 0) return true;
    if (type.isUnion && type.isUnion()) {
        return type.types.some(typeIncludesUndefined);
    }
    return false;
}

/**
 * Look for a boolean option (e.g. `nullable: true`) in any ObjectExpression
 * argument of the decorator's call expression. Returns:
 *   - true / false: literal boolean
 *   - null: the option was set to a non-boolean (e.g. 'items') — caller should skip
 *   - false (default): the option was not present at all
 */
export function getBooleanOption(callExpr, keyName) {
    for (const arg of callExpr.arguments) {
        if (arg.type !== 'ObjectExpression') continue;
        for (const prop of arg.properties) {
            if (
                prop.type !== 'Property' ||
                prop.key.type !== 'Identifier' ||
                prop.key.name !== keyName
            ) {
                continue;
            }
            if (prop.value.type === 'Literal') {
                const v = prop.value.value;
                if (typeof v === 'boolean') return v;
            }
            return null;
        }
    }
    return false;
}

/**
 * Returns true if any ObjectExpression argument has a property named keyName,
 * regardless of value. Useful for detecting "has defaultValue".
 */
export function hasOption(callExpr, keyName) {
    for (const arg of callExpr.arguments) {
        if (arg.type !== 'ObjectExpression') continue;
        for (const prop of arg.properties) {
            if (
                prop.type === 'Property' &&
                prop.key.type === 'Identifier' &&
                prop.key.name === keyName
            ) {
                return true;
            }
        }
    }
    return false;
}
