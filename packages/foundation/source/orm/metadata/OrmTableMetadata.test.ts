// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmTableMetadata, requireTruncatable } from './OrmTableMetadata';

function makeMetadata(
    name: string,
    options?: OrmTableMetadata['options'],
): OrmTableMetadata {
    return {
        name,
        options,
        columns: [],
        relations: [],
        uniqueConstraints: [],
        indexes: [],
        listeners: {
            beforeInsert: [],
            afterInsert: [],
            beforeUpdate: [],
            afterUpdate: [],
            beforeDelete: [],
            afterDelete: [],
            afterLoad: [],
        },
        dateColumns: { create: [], update: [] },
        joinColumns: {},
    };
}

describe('requireTruncatable', () => {
    test('throws when options is undefined', () => {
        expect(() => requireTruncatable(makeMetadata('users'))).toThrow(
            /not marked truncatable/,
        );
    });

    test('throws when options exists but truncatable is undefined', () => {
        expect(() =>
            requireTruncatable(makeMetadata('users', { comment: 'hi' })),
        ).toThrow(/not marked truncatable/);
    });

    test('throws when truncatable is explicitly false', () => {
        expect(() =>
            requireTruncatable(makeMetadata('users', { truncatable: false })),
        ).toThrow(/not marked truncatable/);
    });

    test('error message names the table and suggests the fix', () => {
        const thrown = (() => {
            try {
                requireTruncatable(makeMetadata('accounts'));
                return undefined;
            } catch (err) {
                return err as Error;
            }
        })();

        expect(thrown).toBeDefined();
        expect(thrown!.message).toContain('"accounts"');
        expect(thrown!.message).toContain('@OrmTable');
        expect(thrown!.message).toContain('truncatable: true');
    });

    test('does not throw when truncatable is true', () => {
        expect(() =>
            requireTruncatable(makeMetadata('fixtures', { truncatable: true })),
        ).not.toThrow();
    });
});
