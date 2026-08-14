// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * ESLint rule to disallow references to the function `getGlobalContainer`.
 */
export default {
    meta: {
        type: 'problem',
        docs: {
            description:
                "disallow references to the function 'getGlobalContainer'",
            category: 'Possible Errors',
            recommended: true,
        },
        messages: {
            noGlobalContainer: "Usage of 'getGlobalContainer' is not allowed.",
        },
    },
    create(context) {
        // A single Identifier visitor catches every reference — the call
        // itself, member access on its result, and even an import of the
        // name. Separate CallExpression/MemberExpression visitors would just
        // re-report the same usage, emitting duplicate diagnostics on one line.
        return {
            Identifier(node) {
                if (node.name === 'getGlobalContainer') {
                    context.report({
                        node,
                        messageId: 'noGlobalContainer',
                    });
                }
            },
        };
    },
};
