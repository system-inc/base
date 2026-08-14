// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * Type-aware rule: ensure a typed method-decorator's declared expected
 * return type accepts the decorated method's actual return type.
 *
 * The contract lives on the decorator's *call* return type via the
 * `TypedMethodDecorator<TExpectedReturn>` brand:
 *
 *   type TypedMethodDecorator<TExpectedReturn> = MethodDecorator & {
 *       readonly __expectedReturnType?: TExpectedReturn;
 *   };
 *
 * Any decorator factory that returns this branded type implicitly opts
 * into the check — the rule reads `__expectedReturnType` off the call's
 * return type and verifies the method's declared return type is
 * assignable to it. Decorators that return a plain `MethodDecorator`
 * are skipped (no contract to check).
 *
 * The brand is purely phantom — `__expectedReturnType` is never present
 * at runtime. The rule operates entirely through the type checker.
 */
export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                "Ensure a typed method decorator's expected return type accepts the decorated method's return type",
            recommended: true,
            requiresTypeChecking: true,
        },
        messages: {
            mismatch:
                "@{{decoratorName}} expects return type assignable to '{{expectedType}}' but method returns '{{returnType}}'",
        },
        schema: [],
    },
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

        function resolveMethodNode(decoratorNode) {
            const parent = decoratorNode.parent;
            if (!parent) return null;
            if (parent.type !== 'MethodDefinition') return null;
            // value is the FunctionExpression whose call signature
            // carries the return type.
            return parent.value ?? null;
        }

        function getDecoratorName(decoratorNode) {
            const expr = decoratorNode.expression;
            if (expr.type === 'CallExpression') {
                if (expr.callee.type === 'Identifier') {
                    return expr.callee.name;
                }
                if (
                    expr.callee.type === 'MemberExpression' &&
                    expr.callee.property.type === 'Identifier'
                ) {
                    return expr.callee.property.name;
                }
            }
            if (expr.type === 'Identifier') {
                return expr.name;
            }
            return '<decorator>';
        }

        /**
         * Pull `__expectedReturnType` off the decorator value's type.
         * Unlike the parameter rule, we do *not* strip `undefined` from
         * the resulting union — `Provider<T>`'s brand intrinsically
         * includes `undefined` (the opt-out path) and stripping it
         * would reject every valid `X | undefined` provider.
         */
        function getExpectedReturnType(decoratorType) {
            const symbol = decoratorType.getProperty('__expectedReturnType');
            if (!symbol) return null;
            return checker.getTypeOfSymbol(symbol);
        }

        function getMethodReturnType(methodValueNode) {
            const fnType = services.getTypeAtLocation(methodValueNode);
            const signatures = fnType.getCallSignatures();
            if (!signatures || signatures.length === 0) return null;
            return signatures[0].getReturnType();
        }

        return {
            Decorator(node) {
                const methodValueNode = resolveMethodNode(node);
                if (!methodValueNode) return;

                // Type of the decorator value being applied. For a call
                // like `@Provider(token)`, this is the return type of
                // the factory; for a bare `@Foo`, this is `Foo` itself.
                const decoratorType = services.getTypeAtLocation(
                    node.expression,
                );
                const expectedType = getExpectedReturnType(decoratorType);
                if (!expectedType) {
                    return; // not a TypedMethodDecorator — nothing to check
                }

                // ts.TypeFlags.Any = 1, ts.TypeFlags.Unknown = 2. When
                // the brand's T resolves to either, the decorator
                // didn't carry a concrete contract — skip.
                if ((expectedType.flags & 3) !== 0) {
                    return;
                }

                const returnType = getMethodReturnType(methodValueNode);
                if (!returnType) return;

                if (!checker.isTypeAssignableTo(returnType, expectedType)) {
                    context.report({
                        node: methodValueNode,
                        messageId: 'mismatch',
                        data: {
                            decoratorName: getDecoratorName(node),
                            expectedType: checker.typeToString(expectedType),
                            returnType: checker.typeToString(returnType),
                        },
                    });
                }
            },
        };
    },
};
