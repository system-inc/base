// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { mergeDeep } from './ObjectUtilities';

describe('mergeDeep', () => {
    it('merges nested plain objects', () => {
        expect(mergeDeep({ a: { b: 1, c: 2 } }, { a: { b: 3 } })).toEqual({
            a: { b: 3, c: 2 },
        });
    });

    it('replaces primitives outright', () => {
        expect(mergeDeep({ a: 1, b: 2 }, { a: 5 })).toEqual({ a: 5, b: 2 });
    });

    it('replaces (does not merge) arrays', () => {
        expect(mergeDeep({ a: [1, 2, 3] }, { a: [9] })).toEqual({ a: [9] });
    });

    it('does not recurse into an array on the original side', () => {
        expect(mergeDeep({ a: [1, 2] }, { a: { 0: 9 } })).toEqual({
            a: { 0: 9 },
        });
    });

    it('applies an explicit null update instead of discarding it', () => {
        expect(mergeDeep({ a: { b: 1 } }, { a: null })).toEqual({ a: null });
    });

    it('does not mutate the original', () => {
        const original = { a: { b: 1 } };
        mergeDeep(original, { a: { b: 2 } });
        expect(original).toEqual({ a: { b: 1 } });
    });
});
