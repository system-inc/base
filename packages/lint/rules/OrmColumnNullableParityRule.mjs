// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ESLintUtils } from '@typescript-eslint/utils';

import {
    getBooleanOption,
    hasRelationDecorator,
    isNullableType,
} from './_decoratorHelpers.mjs';

/**
 * Type-aware rule: when a column decorator declares `nullable: true`, the
 * TypeScript type must include `null` or `undefined`. Otherwise a row loaded
 * with a NULL value will hand back `null` typed as a non-null value, leading
 * to runtime TypeErrors.
 *
 * Only fires in the column-NULL → TS-non-null direction. The opposite
 * (TS includes null/undefined but column is non-nullable) is intentionally
 * permitted because of the common pre-insert pattern (`id?: string` for
 * generated keys, properties set later by lifecycle hooks, etc.).
 *
 * Properties co-located with an ORM relation decorator are skipped — the
 * `relation-must-be-optional` rule owns those.
 */

const COLUMN_DECORATORS = new Set([
    'OrmColumn',
    'TimestampColumn',
    'OrmJoinColumn',
]);

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                "Column decorator 'nullable: true' must be reflected in the TypeScript type",
            recommended: true,
            requiresTypeChecking: true,
        },
        messages: {
            columnNullableButTypeNot:
                "Column declares 'nullable: true' but the type '{{typeText}}' does not include null/undefined — a NULL row value will not match this type",
        },
        schema: [],
    },
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        return {
            Decorator(node) {
                if (
                    node.expression.type !== 'CallExpression' ||
                    node.expression.callee.type !== 'Identifier'
                ) {
                    return;
                }
                if (!COLUMN_DECORATORS.has(node.expression.callee.name)) {
                    return;
                }

                const declaredNullable = getBooleanOption(
                    node.expression,
                    'nullable',
                );
                if (declaredNullable !== true) return;

                const parent = node.parent;
                if (
                    !parent ||
                    (parent.type !== 'PropertyDefinition' &&
                        parent.type !== 'AccessorProperty')
                ) {
                    return;
                }
                if (hasRelationDecorator(parent)) return;
                if (parent.key.type !== 'Identifier') return;

                const type = services.getTypeAtLocation(parent.key);
                if (isNullableType(type)) return;

                context.report({
                    node: parent.key,
                    messageId: 'columnNullableButTypeNot',
                    data: { typeText: checker.typeToString(type) },
                });
            },
        };
    },
};
