// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsEnum } from './VerifyIsEnum';

describe('VerifyIsEnum', () => {
    describe('with numeric TS enum', () => {
        enum Role {
            Admin,
            User,
            Guest,
        }

        test('accepts a valid enum numeric member', () => {
            expect(VerifyIsEnum.check(Role.Admin, Role)).toBe(true);
            expect(VerifyIsEnum.check(0, Role)).toBe(true);
            expect(VerifyIsEnum.check(2, Role)).toBe(true);
        });

        test('rejects an out-of-range value', () => {
            expect(VerifyIsEnum.check(99, Role)).toBe(false);
        });

        test('rejects the reverse-mapping member name', () => {
            // Role compiles to { 0:'Admin', 1:'User', 2:'Guest', Admin:0, ... }.
            // The member NAME is not a valid value — only the numbers are.
            expect(VerifyIsEnum.check('Admin', Role)).toBe(false);
            expect(VerifyIsEnum.check('Guest', Role)).toBe(false);
        });
    });

    describe('with string TS enum', () => {
        enum Color {
            Red = 'red',
            Blue = 'blue',
        }

        test('accepts a valid enum string member', () => {
            expect(VerifyIsEnum.check(Color.Red, Color)).toBe(true);
        });

        test('rejects an unknown string', () => {
            expect(VerifyIsEnum.check('green', Color)).toBe(false);
        });

        test('rejects a non-string', () => {
            expect(VerifyIsEnum.check(42, Color)).toBe(false);
        });
    });

    describe('with const-object enum', () => {
        const Status = {
            Active: 'active',
            Inactive: 'inactive',
        } as const;

        test('accepts an allowed value', () => {
            expect(VerifyIsEnum.check('active', Status)).toBe(true);
        });

        test('rejects an unknown value', () => {
            expect(VerifyIsEnum.check('archived', Status)).toBe(false);
        });
    });

    describe('with plain array', () => {
        const Kinds = ['Contact', 'SupportArticleFeedback'] as const;

        test('accepts a value in the array', () => {
            expect(VerifyIsEnum.check('Contact', Kinds)).toBe(true);
        });

        test('rejects a value not in the array', () => {
            expect(VerifyIsEnum.check('Other', Kinds)).toBe(false);
        });

        test('accepts number values in a numeric array', () => {
            expect(VerifyIsEnum.check(2, [1, 2, 3])).toBe(true);
            expect(VerifyIsEnum.check(4, [1, 2, 3])).toBe(false);
        });
    });
});
