// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Named Unicode constants built from code points so source stays readable

import { sanitizeUserText } from './SanitizeUserText';

// and lint-friendly. These are the characters the sanitizer should strip.
const BIDI_RLO = String.fromCharCode(0x202e); // Right-to-left override
const BIDI_LRE = String.fromCharCode(0x202a); // Left-to-right embedding
const BIDI_PDF = String.fromCharCode(0x202c); // Pop directional formatting
const ISOLATE_LRI = String.fromCharCode(0x2066);
const ISOLATE_RLI = String.fromCharCode(0x2067);
const ISOLATE_FSI = String.fromCharCode(0x2068);
const ISOLATE_PDI = String.fromCharCode(0x2069);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const LRM = String.fromCharCode(0x200e);
const RLM = String.fromCharCode(0x200f);
const BOM = String.fromCharCode(0xfeff);

describe('sanitizeUserText', () => {
    describe('null and empty handling', () => {
        test('returns null for null input', () => {
            expect(sanitizeUserText(null)).toBe(null);
        });

        test('returns null for empty string', () => {
            expect(sanitizeUserText('')).toBe(null);
        });

        test('returns null for whitespace-only string', () => {
            expect(sanitizeUserText('   \t\n  ')).toBe(null);
        });
    });

    describe('clean input passthrough', () => {
        test('leaves normal text untouched', () => {
            expect(sanitizeUserText('Happy birthday!')).toBe('Happy birthday!');
        });

        test('preserves multi-line content with LF', () => {
            expect(sanitizeUserText('line one\nline two')).toBe(
                'line one\nline two',
            );
        });

        test('preserves tabs', () => {
            expect(sanitizeUserText('col1\tcol2')).toBe('col1\tcol2');
        });

        test('is idempotent on already-clean input', () => {
            const clean = 'Enjoy the gift!\nLove,\nBill';
            expect(sanitizeUserText(sanitizeUserText(clean))).toBe(clean);
        });
    });

    describe('CRLF normalization', () => {
        test('converts CRLF to LF', () => {
            expect(sanitizeUserText('line1\r\nline2')).toBe('line1\nline2');
        });

        test('converts standalone CR to LF', () => {
            expect(sanitizeUserText('line1\rline2')).toBe('line1\nline2');
        });

        test('handles mixed CRLF and LF', () => {
            expect(sanitizeUserText('a\r\nb\nc\rd')).toBe('a\nb\nc\nd');
        });
    });

    describe('ASCII control character stripping', () => {
        test('strips NUL byte', () => {
            expect(sanitizeUserText('hi\x00world')).toBe('hiworld');
        });

        test('strips ANSI escape sequence introducer', () => {
            expect(sanitizeUserText('msg\x1B[31mred')).toBe('msg[31mred');
        });

        test('strips DEL (0x7F)', () => {
            expect(sanitizeUserText('hi\x7Fworld')).toBe('hiworld');
        });

        test('strips BEL (0x07)', () => {
            expect(sanitizeUserText('alert\x07here')).toBe('alerthere');
        });

        test('preserves TAB (0x09) and LF (0x0A)', () => {
            expect(sanitizeUserText('a\tb\nc')).toBe('a\tb\nc');
        });
    });

    describe('Unicode bidi / format character stripping', () => {
        test('strips RTL override (U+202E)', () => {
            // Classic "filename spoof" character.
            expect(sanitizeUserText(`normal${BIDI_RLO}evil`)).toBe(
                'normalevil',
            );
        });

        test('strips LRE (U+202A) and PDF (U+202C)', () => {
            expect(sanitizeUserText(`a${BIDI_LRE}b${BIDI_PDF}c`)).toBe('abc');
        });

        test('strips isolate controls (U+2066–U+2069)', () => {
            expect(
                sanitizeUserText(
                    `a${ISOLATE_LRI}b${ISOLATE_RLI}c${ISOLATE_FSI}d${ISOLATE_PDI}e`,
                ),
            ).toBe('abcde');
        });

        test('strips zero-width space (U+200B)', () => {
            expect(sanitizeUserText(`hello${ZERO_WIDTH_SPACE}world`)).toBe(
                'helloworld',
            );
        });

        test('strips LRM/RLM (U+200E, U+200F)', () => {
            expect(sanitizeUserText(`a${LRM}b${RLM}c`)).toBe('abc');
        });

        test('strips BOM (U+FEFF)', () => {
            expect(sanitizeUserText(`${BOM}header`)).toBe('header');
        });
    });

    describe('whitespace trimming', () => {
        test('trims outer whitespace', () => {
            expect(sanitizeUserText('   hello   ')).toBe('hello');
        });

        test('trims trailing whitespace on each line', () => {
            expect(sanitizeUserText('line1   \nline2\t\nline3')).toBe(
                'line1\nline2\nline3',
            );
        });

        test('preserves leading whitespace mid-content (e.g. indented paragraphs)', () => {
            expect(sanitizeUserText('line1\n    line2')).toBe(
                'line1\n    line2',
            );
        });
    });

    describe('unicode preservation (legitimate content)', () => {
        test('preserves non-ASCII letters (CJK, accents, emoji)', () => {
            expect(sanitizeUserText('生日快乐 🎉 café')).toBe(
                '生日快乐 🎉 café',
            );
        });

        test('preserves punctuation and symbols', () => {
            expect(sanitizeUserText('Wow — "amazing" gift!')).toBe(
                'Wow — "amazing" gift!',
            );
        });
    });

    describe('combined threats', () => {
        test('strips a classic multi-vector payload', () => {
            // Invisible BOM + RTL override + CRLF + NUL. Header-injection
            // prevention is the email-worker's job; this helper just makes
            // sure the residue is body-safe text.
            const attack = `${BOM}Happy birthday${BIDI_RLO}\r\nBcc: attacker@evil.com\x00`;
            expect(sanitizeUserText(attack)).toBe(
                'Happy birthday\nBcc: attacker@evil.com',
            );
        });
    });
});
