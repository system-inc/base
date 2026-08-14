// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ArgumentValidationError } from './ArgumentValidationError';

describe('ArgumentValidationError.validationErrors', () => {
    it('exposes a single validation entry passed to the constructor', () => {
        const error = new ArgumentValidationError({
            path: 'email',
            constraints: { isEmail: 'email must be an email' },
        });
        // Before the fix this returned the always-empty backing field.
        expect(error.validationErrors).toEqual([
            {
                path: 'email',
                constraints: { isEmail: 'email must be an email' },
            },
        ]);
    });

    it('exposes every entry when given an array', () => {
        const error = new ArgumentValidationError([
            { path: 'name', constraints: { isNotEmpty: 'name is required' } },
            { path: 'age', constraints: { min: 'age must be >= 0' } },
        ]);
        expect(error.validationErrors).toHaveLength(2);
        expect(error.validationErrors.map((e) => e.path)).toEqual([
            'name',
            'age',
        ]);
    });

    it('defaults constraints to an empty object when absent', () => {
        const error = new ArgumentValidationError({ path: 'token' } as never);
        expect(error.validationErrors).toEqual([
            { path: 'token', constraints: {} },
        ]);
    });

    it('matches the extensions payload', () => {
        const error = new ArgumentValidationError({
            path: 'id',
            constraints: {},
        });
        expect(error.validationErrors).toBe(error.extensions.validationErrors);
    });
});
