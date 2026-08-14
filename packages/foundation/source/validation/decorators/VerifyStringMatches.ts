// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

const rule = registerRule<RegExp>({
    name: 'StringMatches',
    check: (value, pattern) => typeof value === 'string' && pattern.test(value),
    defaultMessage: ({ property, options }) =>
        `${property} must match ${options}`,
});

// Strip the `g`/`y` flags: the rule stores one RegExp in long-lived metadata
// and calls .test() on it, which is stateful (mutates lastIndex) with those
// flags — so successive validations of the same input would alternate
// pass/fail. They have no meaning for a whole-value match anyway.
function stripStatefulFlags(flags: string): string {
    return flags.replace(/[gy]/g, '');
}

function toRegExp(pattern: RegExp | string, modifiers?: string): RegExp {
    if (typeof pattern === 'string') {
        return new RegExp(pattern, stripStatefulFlags(modifiers ?? ''));
    }
    if (/[gy]/.test(pattern.flags)) {
        return new RegExp(pattern.source, stripStatefulFlags(pattern.flags));
    }
    return pattern;
}

/**
 * Regex match against a string value. Accepts either a {@link RegExp}
 * or a pattern string; strings are promoted to `new RegExp(pattern,
 * modifiers)`.
 *
 * @example
 * ```ts
 * @VerifyStringMatches(/^[a-z0-9-]+$/)
 * slug: string;
 * ```
 */
export const VerifyStringMatches = Object.assign(
    (pattern: RegExp | string, modifiers?: string) =>
        rule(toRegExp(pattern, modifiers)),
    {
        check: (
            value: unknown,
            pattern: RegExp | string,
            modifiers?: string,
        ): boolean => rule.check(value, toRegExp(pattern, modifiers)),
    },
);
