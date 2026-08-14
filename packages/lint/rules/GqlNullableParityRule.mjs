// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ESLintUtils } from '@typescript-eslint/utils';

import {
    getBooleanOption,
    hasRelationDecorator,
    isNullableType,
} from './_decoratorHelpers.mjs';

/**
 * Type-aware rule: ensure `nullable: true|false` on @GqlArgument / @GqlField /
 * @GqlQuery / @GqlMutation / @GqlFieldResolver matches the TypeScript type of
 * the parameter / property / method return.
 *
 * For methods, `Promise<T>` is unwrapped before the nullability check.
 * `nullable: 'items' | 'itemsAndList'` (list cases) are skipped.
 *
 * Properties co-located with an ORM relation decorator are skipped — that's
 * the `relation-must-be-optional` rule's territory; the schema declares the
 * business contract while TS reflects the load-state.
 */

const TARGET_DECORATORS = new Set([
    'GqlArgument',
    'GqlField',
    'GqlQuery',
    'GqlMutation',
    'GqlFieldResolver',
]);

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'GraphQL decorator nullability must match the TypeScript type',
            recommended: true,
            requiresTypeChecking: true,
        },
        messages: {
            decoratorNullableButTypeNot:
                "Decorator declares 'nullable: true' but the type '{{typeText}}' is not nullable",
            typeNullableButDecoratorNot:
                "Type '{{typeText}}' is nullable but the decorator does not have 'nullable: true'",
        },
        schema: [],
    },
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        function unwrapPromise(type) {
            const symbol = type.getSymbol();
            if (symbol && symbol.getName() === 'Promise') {
                const args = checker.getTypeArguments(type);
                if (args && args.length > 0) return args[0];
            }
            return type;
        }

        function resolveParamNode(decoratorNode) {
            const parent = decoratorNode.parent;
            if (!parent) return null;
            if (parent.type === 'TSParameterProperty') {
                return parent.parameter;
            }
            if (
                parent.type === 'Identifier' &&
                parent.parent &&
                Array.isArray(parent.parent.params) &&
                parent.parent.params.includes(parent)
            ) {
                return parent;
            }
            // A defaulted parameter (`@Dec() x: T = default`) is an
            // AssignmentPattern that owns the decorator; the typed identifier
            // is its `left`. Without this the rule silently skipped every
            // decorated parameter that carried a default value.
            if (
                parent.type === 'AssignmentPattern' &&
                parent.left.type === 'Identifier' &&
                parent.parent &&
                Array.isArray(parent.parent.params) &&
                parent.parent.params.includes(parent)
            ) {
                return parent.left;
            }
            return null;
        }

        function checkNullability(reportNode, declaredNullable, actualType) {
            const typeIsNullable = isNullableType(actualType);
            const typeText = checker.typeToString(actualType);
            if (declaredNullable && !typeIsNullable) {
                context.report({
                    node: reportNode,
                    messageId: 'decoratorNullableButTypeNot',
                    data: { typeText },
                });
            } else if (!declaredNullable && typeIsNullable) {
                context.report({
                    node: reportNode,
                    messageId: 'typeNullableButDecoratorNot',
                    data: { typeText },
                });
            }
        }

        return {
            Decorator(node) {
                if (
                    node.expression.type !== 'CallExpression' ||
                    node.expression.callee.type !== 'Identifier'
                ) {
                    return;
                }
                const name = node.expression.callee.name;
                if (!TARGET_DECORATORS.has(name)) return;

                const declaredNullable = getBooleanOption(
                    node.expression,
                    'nullable',
                );
                if (declaredNullable === null) return;

                const parent = node.parent;
                if (!parent) return;

                if (name === 'GqlArgument') {
                    const paramNode = resolveParamNode(node);
                    if (!paramNode) return;
                    const type = services.getTypeAtLocation(paramNode);
                    checkNullability(paramNode, declaredNullable, type);
                    return;
                }

                if (name === 'GqlField') {
                    if (hasRelationDecorator(parent)) return;
                    if (
                        parent.type === 'PropertyDefinition' ||
                        parent.type === 'AccessorProperty'
                    ) {
                        const type = services.getTypeAtLocation(parent.key);
                        checkNullability(parent.key, declaredNullable, type);
                    } else if (parent.type === 'MethodDefinition') {
                        // @GqlField is also valid on a getter or method
                        // (type-graphql's Field is MethodAndPropDecorator) —
                        // check its call-signature return type, like GqlQuery.
                        const fnType = services.getTypeAtLocation(parent.value);
                        const sigs = fnType.getCallSignatures();
                        if (sigs.length === 0) return;
                        const returnType = unwrapPromise(
                            sigs[0].getReturnType(),
                        );
                        checkNullability(
                            parent.key,
                            declaredNullable,
                            returnType,
                        );
                    }
                    return;
                }

                if (
                    name === 'GqlQuery' ||
                    name === 'GqlMutation' ||
                    name === 'GqlFieldResolver'
                ) {
                    if (parent.type !== 'MethodDefinition') return;
                    const fnType = services.getTypeAtLocation(parent.value);
                    const sigs = fnType.getCallSignatures();
                    if (sigs.length === 0) return;
                    const returnType = unwrapPromise(sigs[0].getReturnType());
                    checkNullability(parent.key, declaredNullable, returnType);
                }
            },
        };
    },
};
