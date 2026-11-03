// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

const rule = registerRule<RegExp>({
    name: 'StringMatches',
    check: (value, pattern) => typeof value === 'string' && pattern.test(value),
    jsonSchema: (pattern) => {
        const source = jsonSchemaPatternSource(pattern);
        return source === undefined
            ? { type: 'string' }
            : { type: 'string', pattern: source };
    },
    defaultMessage: ({ property, options }) =>
        `${property} must match ${options}`,
});

/**
 * The pattern's source when a JSON Schema validator would accept exactly
 * what the RegExp does, else `undefined`. JSON Schema patterns carry no
 * flags, so a pattern with any (`i`, `m`, `s`, `u`, …) is left out —
 * dropping `i` would make the schema stricter. Validators commonly compile
 * patterns with the `u` flag, which matches by code point instead of code
 * unit; that changes the result only through constructs that can match
 * half of a surrogate pair (`.`, a negated class, `\S`, `\D`, `\W`), so a
 * pattern using one is left out too, as is one `u` won't compile.
 */
function jsonSchemaPatternSource(pattern: RegExp): string | undefined {
    if (pattern.flags !== '') {
        return undefined;
    }
    try {
        new RegExp(pattern.source, 'u');
    } catch {
        return undefined;
    }
    let inClass = false;
    for (let i = 0; i < pattern.source.length; i++) {
        const char = pattern.source[i];
        if (char === '\\') {
            if ('SDW'.includes(pattern.source[i + 1] ?? '')) {
                return undefined;
            }
            i++;
        } else if (inClass) {
            inClass = char !== ']';
        } else if (char === '[') {
            if (pattern.source[i + 1] === '^') {
                return undefined;
            }
            inClass = true;
        } else if (char === '.') {
            return undefined;
        }
    }
    return pattern.source;
}

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
