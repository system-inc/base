// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Properties decorated with one of the new `@Orm*` column-family decorators
 * must use the `declare` keyword.
 *
 * Reason: with `useDefineForClassFields: true` (TS class field semantics),
 * a class field initializer overwrites whatever the decorator wrote into
 * the property metadata at construction. Marking the field `declare` tells
 * TypeScript "this property is set elsewhere" and skips the field
 * definition emit, so the decorator's behavior is preserved at runtime.
 */

const COLUMN_DECORATORS = new Set([
    'OrmColumn',
    'OrmPrimaryKey',
    'OrmPrimaryAutoColumn',
    'OrmCreateDateColumn',
    'OrmUpdateDateColumn',
    'OrmColumnIndex',
    'OrmColumnUnique',
    'OrmColumnUniqueIndex',
]);

function getDecoratorName(decoratorNode) {
    const expr = decoratorNode.expression;
    if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
        return expr.callee.name;
    }
    if (expr.type === 'Identifier') {
        return expr.name;
    }
    return null;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Properties decorated with @Orm* column decorators must use `declare`',
            recommended: true,
        },
        messages: {
            missingDeclare:
                "Property '{{name}}' decorated with @{{decoratorName}}() must use 'declare' (e.g. `declare {{name}}: ...`)",
        },
        schema: [],
    },
    create(context) {
        return {
            PropertyDefinition(node) {
                if (!node.decorators || node.decorators.length === 0) return;
                if (node.declare === true) return;

                let triggeringDecorator = null;
                for (const dec of node.decorators) {
                    const name = getDecoratorName(dec);
                    if (name && COLUMN_DECORATORS.has(name)) {
                        triggeringDecorator = name;
                        break;
                    }
                }
                if (!triggeringDecorator) return;

                const name =
                    node.key.type === 'Identifier'
                        ? node.key.name
                        : '<computed>';
                context.report({
                    node: node.key,
                    messageId: 'missingDeclare',
                    data: {
                        name,
                        decoratorName: triggeringDecorator,
                    },
                });
            },
        };
    },
};
