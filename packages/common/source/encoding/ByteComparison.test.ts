// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { compareBytes } from './ByteComparison';

describe('ByteComparison', () => {
    // Cross-check against Node's Buffer.compare (the previous implementation)
    // so the runtime-agnostic version is behaviourally identical.
    const samples: number[][] = [
        [],
        [0],
        [255],
        [1, 2, 3],
        [1, 2, 3, 4],
        [1, 2, 4],
        [0, 0, 0],
        [127, 128, 129],
    ];

    it('matches Buffer.compare for every ordered pair', () => {
        for (const left of samples) {
            for (const right of samples) {
                expect(
                    compareBytes(new Uint8Array(left), new Uint8Array(right)),
                ).toBe(Buffer.compare(Buffer.from(left), Buffer.from(right)));
            }
        }
    });

    it('returns 0 for equal arrays', () => {
        expect(
            compareBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])),
        ).toBe(0);
    });

    it('compares unsigned (high bytes sort after low bytes)', () => {
        expect(compareBytes(new Uint8Array([255]), new Uint8Array([0]))).toBe(
            1,
        );
    });

    it('sorts a shorter prefix before its longer extension', () => {
        expect(
            compareBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0])),
        ).toBe(-1);
        expect(
            compareBytes(new Uint8Array([1, 2, 0]), new Uint8Array([1, 2])),
        ).toBe(1);
    });

    it('is usable as an Array.prototype.sort comparator', () => {
        const sorted = [
            new Uint8Array([2]),
            new Uint8Array([1, 0]),
            new Uint8Array([1]),
        ].sort(compareBytes);
        expect(sorted.map((bytes) => Array.from(bytes))).toEqual([
            [1],
            [1, 0],
            [2],
        ]);
    });
});
