// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ESLintUtils } from '@typescript-eslint/utils';

import {
    getBooleanOption,
    hasOption,
    isNullableType,
} from './_decoratorHelpers.mjs';

/**
 * Type-aware rule: ensure `optional: true|false` on @SerializableField
 * matches whether the TypeScript type includes null/undefined.
 *
 * - `optional: true` → property type must include null/undefined; otherwise
 *   deserializing input that omits the field produces `undefined` typed as
 *   a non-null value → runtime TypeError.
 * - `optional: false` (default) → property type must NOT include
 *   null/undefined; otherwise validation passes for missing values that
 *   downstream code treats as required.
 *
 * Skip when `defaultValue` is set — the field is hydrated to a known value
 * after deserialize, so non-optional TS is correct even if the serialized
 * form may omit it.
 */

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                "@SerializableField 'optional' must match the TypeScript type",
            recommended: true,
            requiresTypeChecking: true,
        },
        messages: {
            decoratorOptionalButTypeNot:
                "@SerializableField declares 'optional: true' but type '{{typeText}}' does not include null/undefined",
            typeOptionalButDecoratorNot:
                "Type '{{typeText}}' is nullable but @SerializableField does not declare 'optional: true'",
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
                    node.expression.callee.type !== 'Identifier' ||
                    node.expression.callee.name !== 'SerializableField'
                ) {
                    return;
                }

                if (hasOption(node.expression, 'defaultValue')) return;

                const declaredOptional = getBooleanOption(
                    node.expression,
                    'optional',
                );
                if (declaredOptional === null) return;

                const parent = node.parent;
                if (
                    !parent ||
                    (parent.type !== 'PropertyDefinition' &&
                        parent.type !== 'AccessorProperty')
                ) {
                    return;
                }
                if (parent.key.type !== 'Identifier') return;

                const type = services.getTypeAtLocation(parent.key);
                const typeIsNullable = isNullableType(type);
                const typeText = checker.typeToString(type);

                if (declaredOptional && !typeIsNullable) {
                    context.report({
                        node: parent.key,
                        messageId: 'decoratorOptionalButTypeNot',
                        data: { typeText },
                    });
                } else if (!declaredOptional && typeIsNullable) {
                    context.report({
                        node: parent.key,
                        messageId: 'typeOptionalButDecoratorNot',
                        data: { typeText },
                    });
                }
            },
        };
    },
};
