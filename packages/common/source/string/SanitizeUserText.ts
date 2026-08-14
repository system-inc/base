// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Defensive sanitizer for user-supplied free-text that will land in
 * persisted records (CommerceOrder metadata, EmailLog templateProperties,
 * etc.) and/or be rendered in emails. Safe to apply at multiple layers —
 * the function is idempotent on already-clean input.
 *
 * What it does:
 * - Normalizes CRLF to LF (defense against CRLF header injection if the
 *   text ever flows into a header field).
 * - Strips ASCII control characters except `\n` and `\t` (no legitimate
 *   user-typed free text contains NUL, BEL, ANSI escapes, etc.).
 * - Strips Unicode bidi / zero-width / BOM formatting characters used for
 *   visual spoofing in email clients:
 *   - U+202A–U+202E (LRE/RLE/PDF/LRO/RLO)
 *   - U+2066–U+2069 (LRI/RLI/FSI/PDI)
 *   - U+200B–U+200F (zero-width spaces, LRM/RLM)
 *   - U+FEFF (BOM / zero-width no-break space)
 * - Trims trailing whitespace per line and outer whitespace.
 *
 * What it does NOT do:
 * - HTML escaping — the email template is React Email (JSX), which
 *   auto-escapes interpolations like `{customMessage}`. Template authors
 *   must NOT use `dangerouslySetInnerHTML` or place this value inside
 *   `href` / `src` / `style` attributes without their own validation.
 * - SQL escaping — TypeORM parameterized writes handle that.
 * - Length limits — enforce at the validation layer
 *   (e.g. `@VerifyMaxLength`) before calling this.
 */

// Regex built via `new RegExp` from an escape-sequence string so the
// source code stays readable and lint-friendly. Character classes cover
// the bidi / zero-width / BOM ranges documented above.
const UNICODE_FORMAT_CHARS = new RegExp(
    '[\\u202A-\\u202E\\u2066-\\u2069\\u200B-\\u200F\\uFEFF]',
    'g',
);

export function sanitizeUserText(input: string | null): string | null {
    if (input === null) {
        return null;
    }
    let cleaned = input;
    // CRLF normalization. Defensive against CRLF header injection if the
    // value ever flows into a header field.
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Strip C0 control chars except \n (0x0A) and \t (0x09), plus DEL (0x7F).
    // eslint-disable-next-line no-control-regex
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Strip Unicode bidi / zero-width / BOM format chars.
    cleaned = cleaned.replace(UNICODE_FORMAT_CHARS, '');
    // Trim trailing whitespace per line, then outer whitespace.
    cleaned = cleaned
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trim();
    return cleaned.length > 0 ? cleaned : null;
}
