// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DynamicBuffer } from './DynamicBuffer';

describe('DynamicBuffer', () => {
    describe('constructor', () => {
        it('should create buffer with default size of 1024', () => {
            const buffer = new DynamicBuffer();
            expect(buffer.buffer.byteLength).toBe(1024);
            expect(buffer.length()).toBe(0);
        });

        it('should create buffer with custom initial size', () => {
            const buffer = new DynamicBuffer(2048);
            expect(buffer.buffer.byteLength).toBe(2048);
            expect(buffer.length()).toBe(0);
        });
    });

    describe('write', () => {
        it('should write data to empty buffer', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3, 4]);

            buffer.write(data);

            expect(buffer.length()).toBe(4);
            expect(Array.from(buffer.view)).toEqual([1, 2, 3, 4]);
        });

        it('should append data to existing buffer', () => {
            const buffer = new DynamicBuffer();
            const data1 = new Uint8Array([1, 2]);
            const data2 = new Uint8Array([3, 4]);

            buffer.write(data1);
            buffer.write(data2);

            expect(buffer.length()).toBe(4);
            expect(Array.from(buffer.view)).toEqual([1, 2, 3, 4]);
        });

        it('should grow buffer when data exceeds capacity', () => {
            const buffer = new DynamicBuffer(4);
            const data = new Uint8Array(10).fill(5);

            buffer.write(data);

            expect(buffer.length()).toBe(10);
            expect(buffer.buffer.byteLength).toBeGreaterThan(4);
            expect(Array.from(buffer.view)).toEqual(Array(10).fill(5));
        });

        it('should reuse space at beginning after reads', () => {
            const buffer = new DynamicBuffer(10);
            const data1 = new Uint8Array([1, 2, 3, 4]);
            const data2 = new Uint8Array([5, 6]);

            buffer.write(data1);
            buffer.read(2); // Creates space at beginning
            buffer.write(data2);

            expect(buffer.length()).toBe(4);
            expect(Array.from(buffer.view)).toEqual([3, 4, 5, 6]);
        });
    });

    describe('peek', () => {
        it('should return copy of data without consuming it', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3, 4]);
            buffer.write(data);

            const peeked = buffer.peek(2);

            expect(Array.from(peeked)).toEqual([1, 2]);
            expect(buffer.length()).toBe(4); // Data not consumed
            expect(Array.from(buffer.view)).toEqual([1, 2, 3, 4]);
        });

        it('should throw error when requesting more data than available', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2]);
            buffer.write(data);

            expect(() => buffer.peek(3)).toThrow('not enough data');
        });

        it('should return empty array when peeking 0 bytes', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3]);
            buffer.write(data);

            const peeked = buffer.peek(0);

            expect(peeked.length).toBe(0);
            expect(buffer.length()).toBe(3);
        });
    });

    describe('read', () => {
        it('should return and consume data from buffer', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3, 4]);
            buffer.write(data);

            const read = buffer.read(2);

            expect(Array.from(read)).toEqual([1, 2]);
            expect(buffer.length()).toBe(2);
            expect(Array.from(buffer.view)).toEqual([3, 4]);
        });

        it('should throw error when requesting more data than available', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2]);
            buffer.write(data);

            expect(() => buffer.read(3)).toThrow('not enough data');
        });

        it('should handle reading all data', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3]);
            buffer.write(data);

            const read = buffer.read(3);

            expect(Array.from(read)).toEqual([1, 2, 3]);
            expect(buffer.length()).toBe(0);
        });

        it('should return empty array when reading 0 bytes', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3]);
            buffer.write(data);

            const read = buffer.read(0);

            expect(read.length).toBe(0);
            expect(buffer.length()).toBe(3);
        });
    });

    describe('skip', () => {
        it('should skip specified number of bytes', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3, 4]);
            buffer.write(data);

            buffer.skip(2);

            expect(buffer.length()).toBe(2);
            expect(Array.from(buffer.view)).toEqual([3, 4]);
        });

        it('should throw error when skipping more data than available', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2]);
            buffer.write(data);

            expect(() => buffer.skip(3)).toThrow('not enough data');
        });

        it('should handle skipping all data', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3]);
            buffer.write(data);

            buffer.skip(3);

            expect(buffer.length()).toBe(0);
        });

        it('should handle skipping 0 bytes', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3]);
            buffer.write(data);

            buffer.skip(0);

            expect(buffer.length()).toBe(3);
            expect(Array.from(buffer.view)).toEqual([1, 2, 3]);
        });
    });

    describe('findIndex', () => {
        it('should find index of existing value', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3, 4]);
            buffer.write(data);

            expect(buffer.findIndex(3)).toBe(2);
            expect(buffer.findIndex(1)).toBe(0);
            expect(buffer.findIndex(4)).toBe(3);
        });

        it('should return -1 for non-existing value', () => {
            const buffer = new DynamicBuffer();
            const data = new Uint8Array([1, 2, 3, 4]);
            buffer.write(data);

            expect(buffer.findIndex(5)).toBe(-1);
        });

        it('should return -1 for empty buffer', () => {
            const buffer = new DynamicBuffer();

            expect(buffer.findIndex(1)).toBe(-1);
        });
    });

    describe('length', () => {
        it('should return 0 for empty buffer', () => {
            const buffer = new DynamicBuffer();

            expect(buffer.length()).toBe(0);
        });

        it('should return correct length after writes', () => {
            const buffer = new DynamicBuffer();

            expect(buffer.length()).toBe(0);

            buffer.write(new Uint8Array([1, 2]));
            expect(buffer.length()).toBe(2);

            buffer.write(new Uint8Array([3, 4, 5]));
            expect(buffer.length()).toBe(5);
        });

        it('should return correct length after reads', () => {
            const buffer = new DynamicBuffer();
            buffer.write(new Uint8Array([1, 2, 3, 4, 5]));

            expect(buffer.length()).toBe(5);

            buffer.read(2);
            expect(buffer.length()).toBe(3);

            buffer.skip(1);
            expect(buffer.length()).toBe(2);
        });
    });

    describe('integration scenarios', () => {
        it('should handle mixed read/write operations', () => {
            const buffer = new DynamicBuffer();

            // Write initial data
            buffer.write(new Uint8Array([1, 2, 3, 4]));
            expect(buffer.length()).toBe(4);

            // Read some data
            const read1 = buffer.read(2);
            expect(Array.from(read1)).toEqual([1, 2]);
            expect(buffer.length()).toBe(2);

            // Write more data
            buffer.write(new Uint8Array([5, 6]));
            expect(buffer.length()).toBe(4);
            expect(Array.from(buffer.view)).toEqual([3, 4, 5, 6]);

            // Peek at data
            const peeked = buffer.peek(2);
            expect(Array.from(peeked)).toEqual([3, 4]);
            expect(buffer.length()).toBe(4);

            // Skip some data
            buffer.skip(1);
            expect(buffer.length()).toBe(3);
            expect(Array.from(buffer.view)).toEqual([4, 5, 6]);
        });

        it('should handle buffer growth and compaction', () => {
            const buffer = new DynamicBuffer(8);

            // Fill buffer partially
            buffer.write(new Uint8Array([1, 2, 3, 4]));

            // Read some to create space at beginning
            buffer.read(2);
            expect(Array.from(buffer.view)).toEqual([3, 4]);

            // Write data that fits in available space
            buffer.write(new Uint8Array([5, 6, 7, 8]));
            expect(Array.from(buffer.view)).toEqual([3, 4, 5, 6, 7, 8]);

            // Write data that requires growth
            buffer.write(new Uint8Array([9, 10, 11, 12]));
            expect(buffer.buffer.byteLength).toBeGreaterThan(8);
            expect(Array.from(buffer.view)).toEqual([
                3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
            ]);
        });
    });
});
