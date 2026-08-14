// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsIP } from './VerifyIsIP';

describe('VerifyIsIP', () => {
    describe('default (any version)', () => {
        test('accepts an IPv4 address', () => {
            expect(VerifyIsIP.check('192.168.1.1')).toBe(true);
        });

        test('accepts an IPv6 address', () => {
            expect(VerifyIsIP.check('2001:db8::1')).toBe(true);
        });

        test('rejects a garbage string', () => {
            expect(VerifyIsIP.check('not-an-ip')).toBe(false);
        });

        test('rejects a non-string', () => {
            expect(VerifyIsIP.check(42)).toBe(false);
        });
    });

    describe('IPv4 only', () => {
        test('accepts a valid IPv4', () => {
            expect(VerifyIsIP.check('10.0.0.1', '4')).toBe(true);
        });

        test('rejects an out-of-range IPv4 octet', () => {
            expect(VerifyIsIP.check('999.0.0.1', '4')).toBe(false);
        });

        test('rejects an IPv6 when v4 requested', () => {
            expect(VerifyIsIP.check('2001:db8::1', '4')).toBe(false);
        });
    });

    describe('IPv6 only', () => {
        test('accepts a full IPv6', () => {
            expect(
                VerifyIsIP.check(
                    '2001:0db8:0000:0000:0000:0000:0000:0001',
                    '6',
                ),
            ).toBe(true);
        });

        test('accepts loopback ::1', () => {
            expect(VerifyIsIP.check('::1', '6')).toBe(true);
        });

        test('rejects an IPv4 when v6 requested', () => {
            expect(VerifyIsIP.check('192.168.1.1', '6')).toBe(false);
        });
    });
});
