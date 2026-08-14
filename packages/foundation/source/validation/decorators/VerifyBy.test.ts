// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { validate } from '../ValidationEngine';
import { VerifyBy } from './VerifyBy';

describe('VerifyBy', () => {
    test('registers a custom rule that fires end-to-end', async () => {
        const VerifyIsEven = VerifyBy<void>({
            name: 'IsEven',
            check: (value) => typeof value === 'number' && value % 2 === 0,
            defaultMessage: ({ property }) => `${property} must be even`,
        });

        class Target {
            @VerifyIsEven()
            count!: number;
        }

        const passing = new Target();
        passing.count = 4;
        expect(await validate(passing)).toEqual([]);

        const failing = new Target();
        failing.count = 3;
        const errors = await validate(failing);
        expect(errors).toHaveLength(1);
        expect(errors[0].path).toBe('count');
        expect(errors[0].constraints.IsEven).toBeDefined();
    });

    test('registers a rule with options', async () => {
        const VerifyMultipleOf = VerifyBy<number>({
            name: 'MultipleOf',
            check: (value, divisor) =>
                typeof value === 'number' && value % divisor === 0,
            defaultMessage: ({ property, options }) =>
                `${property} must be a multiple of ${options}`,
        });

        class Target {
            @VerifyMultipleOf(5)
            n!: number;
        }

        const passing = new Target();
        passing.n = 15;
        expect(await validate(passing)).toEqual([]);

        const failing = new Target();
        failing.n = 7;
        const errors = await validate(failing);
        expect(errors[0].constraints.MultipleOf).toBeDefined();
    });

    test('supports a custom string message returned from check', async () => {
        const VerifyContainsFoo = VerifyBy<void>({
            name: 'ContainsFoo',
            check: (value) => {
                if (typeof value !== 'string') return 'value must be a string';
                return value.includes('foo') ? true : 'value must contain foo';
            },
            defaultMessage:
                'default (should not be used when check returns a string)',
        });

        class Target {
            @VerifyContainsFoo()
            s!: string;
        }

        const t = new Target();
        t.s = 'no match here';
        const errors = await validate(t);
        expect(errors[0].constraints.ContainsFoo).toBe(
            'value must contain foo',
        );
    });

    test('supports array-level rules via operatesOn', async () => {
        const VerifyHasExactly = VerifyBy<number>({
            name: 'HasExactly',
            operatesOn: 'array',
            check: (value, count) =>
                Array.isArray(value) && value.length === count,
            defaultMessage: ({ property, options }) =>
                `${property} must contain exactly ${options} elements`,
        });

        class Target {
            @VerifyHasExactly(3)
            items!: unknown[];
        }

        const passing = new Target();
        passing.items = [1, 2, 3];
        expect(await validate(passing)).toEqual([]);

        const failing = new Target();
        failing.items = [1, 2];
        const errors = await validate(failing);
        expect(errors[0].constraints.HasExactly).toBeDefined();
        expect(errors[0].path).toBe('items');
    });
});
