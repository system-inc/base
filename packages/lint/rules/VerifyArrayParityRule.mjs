// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * Type-aware rule: an array-typed property whose validation includes
 * value-level `@Verify*` rules must also carry an array-level rule
 * (`@VerifyIsArray`, `@VerifyArrayMinSize`, …).
 *
 * Rationale: the validation engine applies a value-level rule per element
 * ONLY when the property declares an array-level rule; otherwise the rule
 * evaluates the whole value, so an array is rejected. Without this pairing a
 * value-level rule on a `T[]` property would fail every legitimate array, and
 * (before the engine fix) an array sent for a scalar property silently
 * bypassed validation. Declaring `@VerifyIsArray()` once per array property
 * covers all of its value-level rules.
 *
 * Properties that are not array-typed, or that carry no value-level `@Verify*`
 * rule, fall outside this rule's scope.
 */

const ARRAY_LEVEL_DECORATORS = new Set([
    'VerifyIsArray',
    'VerifyArrayMinSize',
    'VerifyArrayMaxSize',
    'VerifyArrayUnique',
    // Emptiness is a whole-container check, so IsNotEmpty is array-level: on an
    // array-typed property it evaluates the array itself (rejecting []), and it
    // satisfies array parity on its own.
    'VerifyIsNotEmpty',
]);

// The built-in value-level rules — the ones that auto-iterate array elements.
// We only flag when one of THESE is present, so a custom VerifyBy rule (whose
// operatesOn we can't read statically, and which may well be array-level)
// never triggers a false positive.
const KNOWN_VALUE_LEVEL_DECORATORS = new Set([
    'VerifyIsBoolean',
    'VerifyIsCountryCode',
    'VerifyIsDate',
    'VerifyIsDefined',
    'VerifyIsDomain',
    'VerifyIsEmail',
    'VerifyIsEnum',
    'VerifyIsInt',
    'VerifyIsIP',
    'VerifyIsLocale',
    'VerifyIsNumber',
    'VerifyIsObject',
    'VerifyIsPhoneNumber',
    'VerifyIsString',
    'VerifyIsTimeZone',
    'VerifyIsUrl',
    'VerifyIsUUID',
    'VerifyLength',
    'VerifyMax',
    'VerifyMaxDate',
    'VerifyMaxLength',
    'VerifyMin',
    'VerifyMinDate',
    'VerifyMinLength',
    'VerifyStringMatches',
]);

// Decorators that don't count as value-level element rules: array-level rules,
// the optional sentinel, and the custom-rule factory.
const KNOWN_NON_VALUE_DECORATORS = new Set([
    ...ARRAY_LEVEL_DECORATORS,
    'VerifyIsOptional',
    'VerifyBy',
]);

function verifyDecoratorName(decorator) {
    if (decorator.expression.type !== 'CallExpression') return null;
    if (decorator.expression.callee.type !== 'Identifier') return null;
    const name = decorator.expression.callee.name;
    return name.startsWith('Verify') ? name : null;
}

function typeIsArray(checker, type) {
    if (type.isUnion && type.isUnion()) {
        return type.types.some((member) => typeIsArray(checker, member));
    }
    if (checker.isArrayType && checker.isArrayType(type)) return true;
    if (checker.isTupleType && checker.isTupleType(type)) return true;
    const symbol = type.getSymbol && type.getSymbol();
    const name = symbol && symbol.getName();
    return name === 'Array' || name === 'ReadonlyArray';
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'an array-typed property with value-level @Verify rules must also declare an array-level rule',
            recommended: true,
            requiresTypeChecking: true,
        },
        messages: {
            missingArrayRule:
                "Array-typed property '{{name}}' has value-level @Verify rules but no array-level rule — add @VerifyIsArray() (or @VerifyArrayMinSize/…) so the value rules validate each element",
        },
        schema: [],
    },
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        function checkNode(node, key) {
            if (!node.decorators || node.decorators.length === 0) return;

            let hasKnownValueRule = false;
            // Suppress when an array-level rule is present, or when any
            // unrecognized custom Verify* decorator is present (it may be an
            // array-level rule declared via VerifyBy, which we can't inspect).
            let suppressed = false;
            for (const decorator of node.decorators) {
                const name = verifyDecoratorName(decorator);
                if (!name) continue;
                if (ARRAY_LEVEL_DECORATORS.has(name)) {
                    suppressed = true;
                } else if (KNOWN_VALUE_LEVEL_DECORATORS.has(name)) {
                    hasKnownValueRule = true;
                } else if (!KNOWN_NON_VALUE_DECORATORS.has(name)) {
                    // an unknown custom Verify* rule — could be array-level
                    suppressed = true;
                }
            }

            if (!hasKnownValueRule || suppressed) return;

            const type = services.getTypeAtLocation(key);
            if (!typeIsArray(checker, type)) return;

            context.report({
                node: key,
                messageId: 'missingArrayRule',
                data: { name: key.name },
            });
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
