// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ESLintUtils } from '@typescript-eslint/utils';

import { isNullableType } from './_decoratorHelpers.mjs';

/**
 * Type-aware rule: align `@VerifyIsOptional()` presence with TypeScript
 * type optionality on validated properties.
 *
 * Rationale: `@VerifyIsOptional()` is a sentinel that tells the validation
 * engine to skip every other rule on a property when the value is null or
 * undefined. The TypeScript type and the validator must agree:
 *
 * - If `@VerifyIsOptional()` is present → TS type must include null/undefined.
 *   Otherwise TS forbids the very values the validator is configured to
 *   tolerate.
 * - If TS type is nullable AND the property has at least one other
 *   `@Verify*` rule → `@VerifyIsOptional()` must also be present. Otherwise
 *   passing undefined fails validation despite TS allowing it.
 *
 * Properties with no `@Verify*` decorators at all are not validated and
 * fall outside this rule's scope.
 */

const VERIFY_IS_OPTIONAL = 'VerifyIsOptional';

function isVerifyDecorator(decorator) {
    if (decorator.expression.type !== 'CallExpression') return false;
    if (decorator.expression.callee.type !== 'Identifier') return false;
    return decorator.expression.callee.name.startsWith('Verify');
}

function isVerifyIsOptionalDecorator(decorator) {
    if (decorator.expression.type !== 'CallExpression') return false;
    if (decorator.expression.callee.type !== 'Identifier') return false;
    return decorator.expression.callee.name === VERIFY_IS_OPTIONAL;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                '@VerifyIsOptional presence must align with TypeScript type optionality',
            recommended: true,
            requiresTypeChecking: true,
        },
        messages: {
            optionalButTypeNot:
                "@VerifyIsOptional() is present but type '{{typeText}}' does not include null/undefined — TS forbids values the validator tolerates",
            typeOptionalButNoVerify:
                "Type '{{typeText}}' is nullable but @VerifyIsOptional() is missing — undefined values will fail validation",
        },
        schema: [],
    },
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        function checkNode(node, key) {
            if (!node.decorators || node.decorators.length === 0) return;
            const verifyDecorators = node.decorators.filter(isVerifyDecorator);
            if (verifyDecorators.length === 0) return;

            const hasIsOptional = verifyDecorators.some(
                isVerifyIsOptionalDecorator,
            );
            const hasOtherVerify = verifyDecorators.some(
                (d) => !isVerifyIsOptionalDecorator(d),
            );

            const type = services.getTypeAtLocation(key);
            const typeIsNullable = isNullableType(type);
            const typeText = checker.typeToString(type);

            if (hasIsOptional && !typeIsNullable) {
                context.report({
                    node: key,
                    messageId: 'optionalButTypeNot',
                    data: { typeText },
                });
                return;
            }

            if (typeIsNullable && !hasIsOptional && hasOtherVerify) {
                context.report({
                    node: key,
                    messageId: 'typeOptionalButNoVerify',
                    data: { typeText },
                });
            }
        }

        return {
            PropertyDefinition(node) {
                if (node.key.type !== 'Identifier') return;
                checkNode(node, node.key);
            },
            TSParameterProperty(node) {
                const param = node.parameter;
                if (!param || param.type !== 'Identifier') return;
                checkNode(node, param);
            },
        };
    },
};
