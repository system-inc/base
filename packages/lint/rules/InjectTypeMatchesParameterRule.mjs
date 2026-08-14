// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ESLintUtils } from '@typescript-eslint/utils';

/**
 * Type-aware rule: ensure typed-inject decorators resolve to a type
 * assignable to the decorated parameter's TypeScript type.
 *
 * The contract lives on the decorator's *call* return type via the
 * `TypedParameterDecorator<TResolved>` brand:
 *
 *   type TypedParameterDecorator<TResolved> = ParameterDecorator & {
 *       readonly __resolvedType?: TResolved;
 *   };
 *
 * Any decorator factory that returns this branded type implicitly opts
 * into the check — the rule reads `__resolvedType` off the call's
 * return type and verifies the parameter accepts it. Decorators that
 * return a plain `ParameterDecorator` are skipped (no contract to check).
 *
 * The brand is purely phantom — `__resolvedType` is never present at
 * runtime. The rule operates entirely through the type checker.
 */
export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                "Ensure a typed inject decorator's resolved type matches the decorated parameter's type",
            recommended: true,
            requiresTypeChecking: true,
        },
        messages: {
            mismatch:
                "@{{decoratorName}} resolves to '{{resolvedType}}' but parameter is typed as '{{paramType}}'",
        },
        schema: [],
    },
    create(context) {
        const services = ESLintUtils.getParserServices(context);
        const checker = services.program.getTypeChecker();

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
         * Pull `__resolvedType` off the decorator value's type. The
         * property is declared as optional on the brand, so the symbol
         * may report itself optional — we still treat it as present.
         */
        function getResolvedType(decoratorType) {
            const symbol = decoratorType.getProperty('__resolvedType');
            if (!symbol) return null;
            const type = checker.getTypeOfSymbol(symbol);
            // Strip `undefined` introduced by the optional brand field
            // so we compare against the actual resolved type.
            if (type.isUnion && type.isUnion()) {
                const nonUndefined = type.types.filter(
                    (t) => (t.flags & 32768) === 0, // ts.TypeFlags.Undefined
                );
                if (nonUndefined.length === 1) return nonUndefined[0];
                if (nonUndefined.length > 1) {
                    return checker.getUnionType
                        ? checker.getUnionType(nonUndefined)
                        : type;
                }
            }
            return type;
        }

        return {
            Decorator(node) {
                const paramNode = resolveParamNode(node);
                if (!paramNode) return;

                // Type of the decorator value being applied. For a call
                // like `@Inject(token)`, this is the return type of the
                // factory; for a bare `@Foo`, this is `Foo` itself.
                const decoratorType = services.getTypeAtLocation(
                    node.expression,
                );
                const resolvedType = getResolvedType(decoratorType);
                if (!resolvedType) {
                    return; // not a TypedParameterDecorator — nothing to check
                }

                // ts.TypeFlags.Any = 1, ts.TypeFlags.Unknown = 2. When the
                // brand's T resolves to either, it means the decorator
                // didn't carry a concrete contract (e.g. a bare-string
                // `@Inject` site that hasn't been migrated to a
                // TypedInjectionKey). Skip — the check would noise on
                // every legacy site.
                if ((resolvedType.flags & 3) !== 0) {
                    return;
                }

                const paramType = services.getTypeAtLocation(paramNode);

                if (!checker.isTypeAssignableTo(resolvedType, paramType)) {
                    context.report({
                        node: paramNode,
                        messageId: 'mismatch',
                        data: {
                            decoratorName: getDecoratorName(node),
                            resolvedType: checker.typeToString(resolvedType),
                            paramType: checker.typeToString(paramType),
                        },
                    });
                }
            },
        };
    },
};
