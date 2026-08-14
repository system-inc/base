// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * ESLint rule requiring the repo's SPDX license header at the top of
 * every first-party source file:
 *
 *     // Copyright <year> System, Inc.
 *     // SPDX-License-Identifier: Apache-2.0
 *
 * Auto-fixable: inserts the header (with the current year) at the top of
 * the file, after a shebang when present. The year is matched as any four
 * digits so existing files don't churn at year rollover.
 *
 * Deliberately NOT enabled in baseJavaScriptAndTypeScriptRules: the header
 * is a licensing policy of the base repo itself, not of projects built on
 * base — consumers must never inherit a System, Inc. header requirement.
 * The repo's root eslint.config.mjs enables it explicitly.
 */
export default {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'require the SPDX license header at the top of first-party source files',
        },
        fixable: 'code',
        schema: [
            {
                type: 'object',
                properties: {
                    holder: { type: 'string' },
                    license: { type: 'string' },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            missingHeader:
                'File must start with the SPDX header: "// Copyright <year> {{holder}}" then "// SPDX-License-Identifier: {{license}}".',
        },
    },
    create(context) {
        const options = context.options[0] ?? {};
        const holder = options.holder ?? 'System, Inc.';
        const license = options.license ?? 'Apache-2.0';

        return {
            Program(node) {
                const text = context.sourceCode.text;
                if (text.trim().length === 0) {
                    return; // empty file — nothing to license
                }

                // The header must be the very first content, except that a
                // shebang line stays above it.
                let offset = 0;
                if (text.startsWith('#!')) {
                    const newline = text.indexOf('\n');
                    offset = newline === -1 ? text.length : newline + 1;
                }

                const escapeForRegExp = (value) =>
                    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const headerPattern = new RegExp(
                    `^// Copyright \\d{4} ${escapeForRegExp(holder)}\\r?\\n` +
                        `// SPDX-License-Identifier: ${escapeForRegExp(license)}\\r?\\n`,
                );
                if (headerPattern.test(text.slice(offset))) {
                    return;
                }

                const header =
                    `// Copyright ${new Date().getFullYear()} ${holder}\n` +
                    `// SPDX-License-Identifier: ${license}\n\n`;
                context.report({
                    node,
                    loc: {
                        start: { line: 1, column: 0 },
                        end: { line: 1, column: 0 },
                    },
                    messageId: 'missingHeader',
                    data: { holder, license },
                    fix: (fixer) =>
                        fixer.insertTextBeforeRange([offset, offset], header),
                });
            },
        };
    },
};
