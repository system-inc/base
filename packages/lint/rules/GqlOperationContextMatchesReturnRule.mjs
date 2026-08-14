// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ESLintUtils } from '@typescript-eslint/utils';
import ts from 'typescript';

/**
 * Type-aware rule: ensure the generic argument on a parameter typed as
 * `GqlOperationContext<T>` and decorated with `@InjectGqlOperationContext`
 * matches the GraphQL operation method's return type (Promise unwrapped).
 *
 * The other ledger of correctness — that the param's *base* type is a
 * `GqlOperationContext` at all — is enforced by
 * `inject-type-matches-parameter` via the decorator's branded
 * `__resolvedType`. This rule fills the cross-decorator gap that the
 * existing rule cannot see.
 *
 * Caught:
 * ```ts
 * @GqlQuery(() => OpContextResult)
 * async opContext(
 *     @InjectGqlOperationContext()
 *     ctx: GqlOperationContext<RcMiddleResult>, // ← mismatch reported
 * ): Promise<OpContextResult>
 * ```
 */

const GQL_OPERATION_DECORATORS = new Set([
    'GqlQuery',
    'GqlMutation',
    'GqlFieldResolver',
]);

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                "Ensure @InjectGqlOperationContext parameter's generic matches the method's return type",
            recommended: true,
            requiresTypeChecking: true,
        },
        messages: {
            mismatch:
                "@InjectGqlOperationContext parameter is GqlOperationContext<{{paramGeneric}}> but the method returns '{{returnType}}'",
            wrongBaseType:
                "Parameter decorated with @InjectGqlOperationContext must be typed as GqlOperationContext<...>, got '{{paramType}}'",
        },
        schema: [],
    },
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        /**
         * Strips wrappers that don't change the GraphQL selection-set
         * element type: `Promise<T>`, `Readonly<T>`, arrays, and
         * nullable union members. The `GqlSelectionSet<K>` type
         * recursively unwraps arrays internally and `keyof Readonly<T>`
         * equals `keyof T`, so the generic argument is intended to name
         * the bare element type.
         */
        function unwrapToElementType(type) {
            // Promise<T>
            const symbol = type.getSymbol();
            if (symbol && symbol.getName() === 'Promise') {
                const args = checker.getTypeArguments(type);
                if (args && args.length > 0) {
                    return unwrapToElementType(args[0]);
                }
            }
            // Readonly<T> — represented via aliasSymbol since it's a
            // mapped type in lib.es5.d.ts.
            if (
                type.aliasSymbol &&
                type.aliasSymbol.getName() === 'Readonly' &&
                type.aliasTypeArguments &&
                type.aliasTypeArguments.length > 0
            ) {
                return unwrapToElementType(type.aliasTypeArguments[0]);
            }
            // T | null | undefined → T
            if (type.isUnion && type.isUnion()) {
                const nullishMask = ts.TypeFlags.Null | ts.TypeFlags.Undefined;
                const nonNullable = type.types.filter(
                    (t) => (t.flags & nullishMask) === 0,
                );
                if (nonNullable.length === 1) {
                    return unwrapToElementType(nonNullable[0]);
                }
            }
            // T[] / ReadonlyArray<T>
            if (symbol) {
                const name = symbol.getName();
                if (name === 'Array' || name === 'ReadonlyArray') {
                    const args = checker.getTypeArguments(type);
                    if (args && args.length > 0) {
                        return unwrapToElementType(args[0]);
                    }
                }
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
                (parent.type === 'Identifier' ||
                    parent.type === 'AssignmentPattern') &&
                parent.parent &&
                Array.isArray(parent.parent.params) &&
                parent.parent.params.includes(parent)
            ) {
                return parent;
            }
            return null;
        }

        function findEnclosingMethod(node) {
            let cur = node.parent;
            while (cur && cur.type !== 'MethodDefinition') {
                cur = cur.parent;
            }
            return cur && cur.type === 'MethodDefinition' ? cur : null;
        }

        function methodHasOperationDecorator(methodDef) {
            if (!methodDef.decorators) return false;
            return methodDef.decorators.some((dec) => {
                if (dec.expression.type !== 'CallExpression') return false;
                if (dec.expression.callee.type !== 'Identifier') return false;
                return GQL_OPERATION_DECORATORS.has(dec.expression.callee.name);
            });
        }

        return {
            Decorator(node) {
                if (
                    node.expression.type !== 'CallExpression' ||
                    node.expression.callee.type !== 'Identifier' ||
                    node.expression.callee.name !== 'InjectGqlOperationContext'
                ) {
                    return;
                }

                const paramNode = resolveParamNode(node);
                if (!paramNode) return;

                const methodDef = findEnclosingMethod(paramNode);
                if (!methodDef) return;
                if (!methodHasOperationDecorator(methodDef)) {
                    // Decorator used outside a GraphQL operation method —
                    // out of this rule's scope.
                    return;
                }

                const paramType = services.getTypeAtLocation(paramNode);
                const paramSymbol = paramType.getSymbol();
                if (
                    !paramSymbol ||
                    paramSymbol.getName() !== 'GqlOperationContext'
                ) {
                    context.report({
                        node: paramNode,
                        messageId: 'wrongBaseType',
                        data: {
                            paramType: checker.typeToString(paramType),
                        },
                    });
                    return;
                }

                const paramTypeArgs = checker.getTypeArguments(paramType);
                if (!paramTypeArgs || paramTypeArgs.length === 0) return;
                const paramGenericType = unwrapToElementType(paramTypeArgs[0]);

                const fnType = services.getTypeAtLocation(methodDef.value);
                const sigs = fnType.getCallSignatures();
                if (sigs.length === 0) return;
                const returnType = unwrapToElementType(sigs[0].getReturnType());

                // Bidirectional assignability — strict equality.
                const matches =
                    checker.isTypeAssignableTo(paramGenericType, returnType) &&
                    checker.isTypeAssignableTo(returnType, paramGenericType);
                if (matches) return;

                context.report({
                    node: paramNode,
                    messageId: 'mismatch',
                    data: {
                        paramGeneric: checker.typeToString(paramGenericType),
                        returnType: checker.typeToString(returnType),
                    },
                });
            },
        };
    },
};
