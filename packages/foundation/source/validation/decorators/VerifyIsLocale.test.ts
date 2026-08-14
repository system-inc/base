// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsLocale } from './VerifyIsLocale';

describe('VerifyIsLocale', () => {
    test.each([
        'en',
        'en-US',
        'fr-CA',
        'ja-JP',
        'zh-Hans-CN',
        'de-DE',
        'pt-BR',
        'en-GB-oxendict',
    ])('accepts valid BCP 47 tag %s', (tag) => {
        expect(VerifyIsLocale.check(tag)).toBe(true);
    });

    test.each([
        'en_US', // underscore, not hyphen
        '1-US', // digit where language belongs
        'en-', // trailing hyphen
        '!@#', // non-alphanumeric garbage
        '',
    ])('rejects malformed tag %s', (tag) => {
        expect(VerifyIsLocale.check(tag)).toBe(false);
    });

    test('rejects a non-string', () => {
        expect(VerifyIsLocale.check(42)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyIsLocale.check(null)).toBe(false);
    });
});
