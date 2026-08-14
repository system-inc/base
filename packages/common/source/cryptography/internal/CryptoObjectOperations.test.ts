// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { objectToBuffer, stringifyObject } from './CryptoObjectOperations';

describe('CryptoObjectOperations', () => {
    describe('stringifyObject', () => {
        it('canonicalizes a simple object with sorted keys', () => {
            const obj = { name: 'test', age: 25, active: true };
            expect(stringifyObject(obj)).toBe(
                '{"active":true,"age":25,"name":"test"}',
            );
        });

        it('encodes null and undefined values distinctly', () => {
            expect(stringifyObject({ value: null })).toBe('{"value":null}');
            expect(stringifyObject({ value: undefined })).toBe(
                '{"value":undefined}',
            );
        });

        it('handles the empty object', () => {
            expect(stringifyObject({})).toBe('{}');
        });

        it('canonicalizes nested objects', () => {
            const obj = {
                user: { name: 'John', age: 30 },
                settings: { theme: 'dark', notifications: true },
            };
            expect(stringifyObject(obj)).toBe(
                '{"settings":{"notifications":true,"theme":"dark"},' +
                    '"user":{"age":30,"name":"John"}}',
            );
        });

        it('encodes arrays structurally', () => {
            const obj = { array: [1, 2, 3], boolean: false, number: 42 };
            expect(stringifyObject(obj)).toBe(
                '{"array":[1,2,3],"boolean":false,"number":42}',
            );
        });

        it('throws for non-object input', () => {
            expect(() => stringifyObject('not an object' as never)).toThrow(
                'Invalid object',
            );
            expect(() => stringifyObject(123 as never)).toThrow(
                'Invalid object',
            );
        });

        it('returns "null" for null input', () => {
            expect(stringifyObject(null as never)).toBe('null');
        });

        it('is stable regardless of key insertion order', () => {
            expect(stringifyObject({ a: 1, b: 2, c: 3 })).toBe(
                stringifyObject({ c: 3, a: 1, b: 2 }),
            );
        });

        // The reason this function exists: the canonical form must be
        // injective, since it is used as AES additional-authenticated-data.
        describe('collision resistance', () => {
            it('distinguishes falsy values from each other', () => {
                const forms = [
                    stringifyObject({ a: 0 }),
                    stringifyObject({ a: false }),
                    stringifyObject({ a: '' }),
                    stringifyObject({ a: null }),
                    stringifyObject({ a: undefined }),
                ];
                expect(new Set(forms).size).toBe(forms.length);
            });

            it('does not let string content collide with structure', () => {
                expect(stringifyObject({ a: 'x;b:y' })).not.toBe(
                    stringifyObject({ a: 'x', b: 'y' }),
                );
            });

            it('distinguishes a number from its string form', () => {
                expect(stringifyObject({ a: 1 })).not.toBe(
                    stringifyObject({ a: '1' }),
                );
            });
        });
    });

    describe('objectToBuffer', () => {
        it('encodes an object as canonical UTF-8 bytes', () => {
            const buffer = objectToBuffer({ name: 'test', value: 42 });
            expect(buffer).toBeInstanceOf(Uint8Array);
            expect(new TextDecoder().decode(buffer)).toBe(
                '{"name":"test","value":42}',
            );
        });

        it('produces the same buffer for key-reordered objects', () => {
            expect(objectToBuffer({ a: 1, b: 2 })).toEqual(
                objectToBuffer({ b: 2, a: 1 }),
            );
        });

        it('produces distinct buffers for colliding-shaped objects', () => {
            expect(objectToBuffer({ a: 0 })).not.toEqual(
                objectToBuffer({ a: false }),
            );
        });

        it('throws for non-object input', () => {
            expect(() => objectToBuffer('string' as never)).toThrow(
                'Invalid object',
            );
        });

        it('throws for null and undefined input', () => {
            expect(() => objectToBuffer(null as never)).toThrow(
                'Invalid object',
            );
            expect(() => objectToBuffer(undefined as never)).toThrow(
                'Invalid object',
            );
        });

        it('handles the empty object', () => {
            expect(new TextDecoder().decode(objectToBuffer({}))).toBe('{}');
        });

        it('handles unicode characters', () => {
            const content = new TextDecoder().decode(
                objectToBuffer({ chinese: '中文', emoji: '🚀🎉' }),
            );
            expect(content).toContain('中文');
            expect(content).toContain('🚀🎉');
        });
    });
});
