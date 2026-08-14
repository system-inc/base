// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsUUID } from './VerifyIsUUID';

describe('VerifyIsUUID', () => {
    describe('default (all versions)', () => {
        test('accepts a v4 UUID', () => {
            expect(
                VerifyIsUUID.check('550e8400-e29b-41d4-a716-446655440000'),
            ).toBe(true);
        });

        test('accepts a v1 UUID', () => {
            expect(
                VerifyIsUUID.check('c232ab00-9414-11ec-b3c8-9f6bdeced846'),
            ).toBe(true);
        });

        test('rejects a malformed UUID', () => {
            expect(VerifyIsUUID.check('not-a-uuid')).toBe(false);
        });

        test('rejects a non-string', () => {
            expect(VerifyIsUUID.check(42)).toBe(false);
        });

        test('rejects an empty string', () => {
            expect(VerifyIsUUID.check('')).toBe(false);
        });

        test('accepts the nil UUID (RFC 9562 §5.9)', () => {
            expect(
                VerifyIsUUID.check('00000000-0000-0000-0000-000000000000'),
            ).toBe(true);
        });

        test('accepts the max UUID (RFC 9562 §5.10)', () => {
            expect(
                VerifyIsUUID.check('ffffffff-ffff-ffff-ffff-ffffffffffff'),
            ).toBe(true);
        });

        test('accepts a v7 UUID (RFC 9562)', () => {
            expect(
                VerifyIsUUID.check('018f1d25-b7ca-7a7e-9a8e-f3b8c0e1d2f4'),
            ).toBe(true);
        });
    });

    describe('version 4', () => {
        test('accepts a v4 UUID', () => {
            expect(
                VerifyIsUUID.check('550e8400-e29b-41d4-a716-446655440000', '4'),
            ).toBe(true);
        });

        test('rejects a v1 UUID when v4 requested', () => {
            expect(
                VerifyIsUUID.check('c232ab00-9414-11ec-b3c8-9f6bdeced846', '4'),
            ).toBe(false);
        });
    });

    describe('version 1', () => {
        test('accepts a v1 UUID', () => {
            expect(
                VerifyIsUUID.check('c232ab00-9414-11ec-b3c8-9f6bdeced846', '1'),
            ).toBe(true);
        });

        test('rejects a v4 UUID when v1 requested', () => {
            expect(
                VerifyIsUUID.check('550e8400-e29b-41d4-a716-446655440000', '1'),
            ).toBe(false);
        });
    });
});
