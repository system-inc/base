// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsUrl } from './VerifyIsUrl';

describe('VerifyIsUrl', () => {
    test('accepts http URL', () => {
        expect(VerifyIsUrl.check('http://example.com')).toBe(true);
    });

    test('accepts https URL with path and query', () => {
        expect(VerifyIsUrl.check('https://example.com/path?x=1#frag')).toBe(
            true,
        );
    });

    test('rejects non-http(s) protocols', () => {
        expect(VerifyIsUrl.check('ftp://example.com')).toBe(false);
    });

    test('rejects a malformed URL', () => {
        expect(VerifyIsUrl.check('not a url')).toBe(false);
    });

    test('rejects an empty string', () => {
        expect(VerifyIsUrl.check('')).toBe(false);
    });

    test('rejects a non-string', () => {
        expect(VerifyIsUrl.check(42)).toBe(false);
    });
});
