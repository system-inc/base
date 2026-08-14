// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    base64ToBytes,
    bytesToBase64,
    bytesToHex,
    hexToBytes,
} from './ByteEncoding';

describe('ByteEncoding', () => {
    // Cross-check against Node's Buffer (the previous implementation) so the
    // Web-standard codec is byte-for-byte compatible with stored data.
    const samples = [
        '',
        'a',
        'hello world',
        'a slightly longer string with punctuation! @#$%^&*()',
        '\x00\x01\x02\xfd\xfe\xff', // full byte range
    ];

    describe('base64 round-trips and matches Buffer', () => {
        it.each(samples)('round-trips %j', (text) => {
            const bytes = new TextEncoder().encode(text);
            const base64 = bytesToBase64(bytes);
            expect(base64).toBe(Buffer.from(bytes).toString('base64'));
            expect(new TextDecoder().decode(base64ToBytes(base64))).toBe(text);
        });

        it('decodes a known base64 string to the same bytes as Buffer', () => {
            const base64 = Buffer.from([0, 127, 128, 255, 16, 32]).toString(
                'base64',
            );
            expect(Array.from(base64ToBytes(base64))).toEqual([
                0, 127, 128, 255, 16, 32,
            ]);
        });

        it('accepts an ArrayBuffer as well as a view', () => {
            const view = new Uint8Array([1, 2, 3, 4]);
            expect(bytesToBase64(view.buffer)).toBe(bytesToBase64(view));
        });
    });

    describe('hex matches Buffer', () => {
        it.each(samples)('encodes %j', (text) => {
            const bytes = new TextEncoder().encode(text);
            expect(bytesToHex(bytes)).toBe(Buffer.from(bytes).toString('hex'));
        });

        it('zero-pads single-digit bytes', () => {
            expect(bytesToHex(new Uint8Array([0, 5, 15, 16, 255]))).toBe(
                '00050f10ff',
            );
        });
    });

    describe('hexToBytes', () => {
        it.each(samples)('round-trips %j through bytesToHex', (text) => {
            const bytes = new TextEncoder().encode(text);
            expect(Array.from(hexToBytes(bytesToHex(bytes)))).toEqual(
                Array.from(bytes),
            );
        });

        it('decodes a known hex string to the same bytes as Buffer', () => {
            expect(Array.from(hexToBytes('00050f10ff'))).toEqual([
                0, 5, 15, 16, 255,
            ]);
        });

        it('accepts uppercase hex', () => {
            expect(Array.from(hexToBytes('00050F10FF'))).toEqual([
                0, 5, 15, 16, 255,
            ]);
        });

        it('returns an empty array for an empty string', () => {
            expect(hexToBytes('')).toEqual(new Uint8Array(0));
        });

        it('returns a Uint8Array backed by an ArrayBuffer (usable as BufferSource)', () => {
            expect(hexToBytes('00ff').buffer).toBeInstanceOf(ArrayBuffer);
        });

        it('throws on odd-length input', () => {
            expect(() => hexToBytes('abc')).toThrow(
                'Invalid hex string length',
            );
        });

        it.each(['zz', '1g', 'a1g3', '00fg', 'gg'])(
            'throws on non-hex characters (%j) — stricter than Buffer.from',
            (value) => {
                expect(() => hexToBytes(value)).toThrow('Invalid hex string');
            },
        );
    });
});
