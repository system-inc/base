// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * ESLint rule to disallow imports using the alias '@project' from files within 'libraries/base'.
 */
export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                "Disallow imports using the alias '@project' from files within 'libraries/base'.",
            category: 'Possible Errors',
            recommended: false,
        },
        messages: {
            forbiddenImport:
                "Importing from '@project' is not allowed within 'libraries/base'.",
        },
    },
    create(context) {
        const filePath = context.getFilename();

        // Normalize file path to always use forward slashes
        const normalizedPath = filePath.replace(/\\/g, '/');

        // Check if the file is within the 'libraries/base' directory
        const isInBaseLibrary = normalizedPath.includes('/libraries/base/');

        return {
            ImportDeclaration(node) {
                if (!isInBaseLibrary) return;

                const importSource = node.source.value;

                if (
                    typeof importSource === 'string' &&
                    importSource.startsWith('@project')
                ) {
                    context.report({
                        node,
                        messageId: 'forbiddenImport',
                    });
                }
            },
            CallExpression(node) {
                if (!isInBaseLibrary) return;

                if (
                    node.callee.type === 'Identifier' &&
                    node.callee.name === 'require'
                ) {
                    const argument = node.arguments[0];
                    if (
                        argument &&
                        argument.type === 'Literal' &&
                        typeof argument.value === 'string' &&
                        argument.value.startsWith('@project')
                    ) {
                        context.report({
                            node,
                            messageId: 'forbiddenImport',
                        });
                    }
                }
            },
            ImportExpression(node) {
                if (!isInBaseLibrary) return;

                const argument = node.source;
                if (
                    argument &&
                    argument.type === 'Literal' &&
                    typeof argument.value === 'string' &&
                    argument.value.startsWith('@project')
                ) {
                    context.report({
                        node,
                        messageId: 'forbiddenImport',
                    });
                }
            },
        };
    },
};
