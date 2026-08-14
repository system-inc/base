// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * ESLint rule to enforce that GqlArgument arguments of type PaginationInput
 * are named "pagination" (or end with "Pagination" for multi-paginator queries
 * that need to disambiguate, e.g. "prefixPagination").
 */
export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'PaginationInput arguments must be named "pagination" or end with "Pagination"',
            category: 'Possible Errors',
            recommended: true,
        },
        messages: {
            invalidName:
                'A GqlArgument of PaginationInput type must be named "pagination" (or end with "Pagination" when disambiguating multiple paginators)',
        },
    },
    create(context) {
        // The decorated parameter node (Identifier / defaulted / constructor
        // property) that a @GqlArgument decorator sits on.
        function decoratedParameter(decoratorNode) {
            const parent = decoratorNode.parent;
            if (!parent) return null;
            if (
                parent.type === 'Identifier' ||
                parent.type === 'AssignmentPattern' ||
                parent.type === 'TSParameterProperty'
            ) {
                return parent;
            }
            return null;
        }

        function parameterIdentifier(param) {
            if (!param) return null;
            if (param.type === 'Identifier') return param;
            if (param.type === 'AssignmentPattern') {
                return param.left.type === 'Identifier' ? param.left : null;
            }
            if (param.type === 'TSParameterProperty' && param.parameter) {
                const inner = param.parameter;
                if (inner.type === 'Identifier') return inner;
                if (inner.type === 'AssignmentPattern') {
                    return inner.left.type === 'Identifier' ? inner.left : null;
                }
            }
            return null;
        }

        function typeReferenceName(id) {
            const annotation =
                id && id.typeAnnotation && id.typeAnnotation.typeAnnotation;
            if (
                annotation &&
                annotation.type === 'TSTypeReference' &&
                annotation.typeName.type === 'Identifier'
            ) {
                return annotation.typeName.name;
            }
            return null;
        }

        const isPaginationName = (name) =>
            typeof name === 'string' && /PaginationInput$/.test(name);

        return {
            Decorator(node) {
                if (
                    node.expression.type !== 'CallExpression' ||
                    node.expression.callee.type !== 'Identifier' ||
                    node.expression.callee.name !== 'GqlArgument'
                ) {
                    return;
                }

                const args = node.expression.arguments;
                const param = decoratedParameter(node);
                const paramId = parameterIdentifier(param);

                // A PaginationInput argument can be recognized two ways: an
                // explicit type thunk `() => PaginationInput` on the decorator,
                // OR — for the inferred-type / options-only forms the rule used
                // to miss (`@GqlArgument('p') x: PaginationInput`,
                // `@GqlArgument({ ... }) x: PaginationInput`) — the parameter's
                // own type annotation. Both match the base type and its
                // `@PaginationInputFor` subclasses by name.
                const explicitType = args.find(
                    (arg) =>
                        arg.type === 'ArrowFunctionExpression' &&
                        arg.body.type === 'Identifier' &&
                        isPaginationName(arg.body.name),
                );
                const isPaginationInput =
                    !!explicitType ||
                    isPaginationName(typeReferenceName(paramId));
                if (!isPaginationInput) return;

                // The GraphQL argument name is the first string-literal
                // argument when given, otherwise the parameter's own name.
                const nameLiteral =
                    args[0] &&
                    args[0].type === 'Literal' &&
                    typeof args[0].value === 'string'
                        ? args[0]
                        : null;
                const name = nameLiteral ? nameLiteral.value : paramId?.name;
                if (typeof name !== 'string') return;

                const valid = name === 'pagination' || /Pagination$/.test(name);
                if (!valid) {
                    context.report({
                        node: nameLiteral ?? paramId ?? node,
                        messageId: 'invalidName',
                    });
                }
            },
        };
    },
};
