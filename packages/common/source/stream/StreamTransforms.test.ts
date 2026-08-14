// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    readableStreamToBase64,
    transformBytesToJson,
    transformJsonToBytes,
} from './StreamTransforms';

describe('StreamTransforms', () => {
    describe('readableStreamToBase64', () => {
        it('should convert empty stream to empty base64 string', async () => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.close();
                },
            });

            const result = await readableStreamToBase64(stream);
            expect(result).toBe('');
        });

        it('should convert simple text stream to base64', async () => {
            const testData = 'Hello, World!';
            const stream = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();
                    controller.enqueue(encoder.encode(testData));
                    controller.close();
                },
            });

            const result = await readableStreamToBase64(stream);
            const expected = Buffer.from(testData).toString('base64');
            expect(result).toBe(expected);
        });

        it('should handle stream with multiple chunks', async () => {
            const chunks = ['Hello', ', ', 'World', '!'];
            const stream = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();
                    chunks.forEach((chunk) => {
                        controller.enqueue(encoder.encode(chunk));
                    });
                    controller.close();
                },
            });

            const result = await readableStreamToBase64(stream);
            const expected = Buffer.from(chunks.join('')).toString('base64');
            expect(result).toBe(expected);
        });

        it('should handle binary data stream', async () => {
            const binaryData = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(binaryData);
                    controller.close();
                },
            });

            const result = await readableStreamToBase64(stream);
            const expected = Buffer.from(binaryData).toString('base64');
            expect(result).toBe(expected);
        });

        it('should handle large data stream', async () => {
            const largeData = new Uint8Array(10000).fill(42);
            const stream = new ReadableStream({
                start(controller) {
                    // Split into multiple chunks
                    for (let i = 0; i < largeData.length; i += 1000) {
                        controller.enqueue(largeData.slice(i, i + 1000));
                    }
                    controller.close();
                },
            });

            const result = await readableStreamToBase64(stream);
            const expected = Buffer.from(largeData).toString('base64');
            expect(result).toBe(expected);
        });

        it('should handle stream with mixed chunk sizes', async () => {
            const data1 = new Uint8Array([1, 2]);
            const data2 = new Uint8Array([3, 4, 5, 6, 7]);
            const data3 = new Uint8Array([8]);
            const data4 = new Uint8Array([9, 10, 11, 12]);

            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(data1);
                    controller.enqueue(data2);
                    controller.enqueue(data3);
                    controller.enqueue(data4);
                    controller.close();
                },
            });

            const result = await readableStreamToBase64(stream);
            const combined = new Uint8Array(12);
            combined.set(data1, 0);
            combined.set(data2, 2);
            combined.set(data3, 7);
            combined.set(data4, 8);
            const expected = Buffer.from(combined).toString('base64');
            expect(result).toBe(expected);
        });
    });

    describe('transformJsonToBytes', () => {
        it('should transform simple JSON object to bytes with length prefix', async () => {
            const input = { message: 'hello' };
            const transform = transformJsonToBytes<typeof input>();

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(input);
                    controller.close();
                },
            });

            const transformed = readable.pipeThrough(transform);
            const chunks: Uint8Array[] = [];
            const reader = transformed.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            const decoder = new TextDecoder();
            const result = chunks
                .map((chunk) => decoder.decode(chunk))
                .join('');
            const expectedJson = JSON.stringify(input);
            const expectedLength = expectedJson.length;
            const expected = `${expectedLength}:${expectedJson}`;

            expect(result).toBe(expected);
        });

        it('should handle multiple JSON objects', async () => {
            const inputs = [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
                { id: 3, name: 'Charlie' },
            ];
            const transform = transformJsonToBytes<(typeof inputs)[0]>();

            const readable = new ReadableStream({
                start(controller) {
                    inputs.forEach((input) => controller.enqueue(input));
                    controller.close();
                },
            });

            const transformed = readable.pipeThrough(transform);
            const chunks: Uint8Array[] = [];
            const reader = transformed.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            const decoder = new TextDecoder();
            const result = chunks
                .map((chunk) => decoder.decode(chunk))
                .join('');

            let expected = '';
            inputs.forEach((input) => {
                const json = JSON.stringify(input);
                expected += `${json.length}:${json}`;
            });

            expect(result).toBe(expected);
        });

        it('should handle complex nested JSON objects', async () => {
            const input = {
                user: {
                    id: 123,
                    profile: {
                        name: 'John Doe',
                        settings: {
                            theme: 'dark',
                            notifications: true,
                        },
                    },
                },
                data: [1, 2, 3, { nested: 'value' }],
            };
            const transform = transformJsonToBytes<typeof input>();

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(input);
                    controller.close();
                },
            });

            const transformed = readable.pipeThrough(transform);
            const chunks: Uint8Array[] = [];
            const reader = transformed.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            const decoder = new TextDecoder();
            const result = chunks
                .map((chunk) => decoder.decode(chunk))
                .join('');
            const expectedJson = JSON.stringify(input);
            const expected = `${expectedJson.length}:${expectedJson}`;

            expect(result).toBe(expected);
        });

        it('should handle empty objects and arrays', async () => {
            const inputs = [{}, [], { empty: {} }, { emptyArray: [] }];
            const transform = transformJsonToBytes<
                Record<string, unknown> | unknown[]
            >();

            const readable = new ReadableStream({
                start(controller) {
                    inputs.forEach((input) => controller.enqueue(input));
                    controller.close();
                },
            });

            const transformed = readable.pipeThrough(transform);
            const chunks: Uint8Array[] = [];
            const reader = transformed.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            const decoder = new TextDecoder();
            const result = chunks
                .map((chunk) => decoder.decode(chunk))
                .join('');

            let expected = '';
            inputs.forEach((input) => {
                const json = JSON.stringify(input);
                expected += `${json.length}:${json}`;
            });

            expect(result).toBe(expected);
        });
    });

    describe('transformBytesToJson', () => {
        it('should transform bytes back to JSON object', async () => {
            const originalData = { message: 'hello world' };
            const jsonString = JSON.stringify(originalData);
            const lengthPrefix = `${jsonString.length}:`;
            const fullData = lengthPrefix + jsonString;

            const encoder = new TextEncoder();
            const bytes = encoder.encode(fullData);

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(bytes);
                    controller.close();
                },
            });

            const transform = transformBytesToJson<typeof originalData>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            const { done, value } = await reader.read();
            expect(done).toBe(false);
            expect(value).toEqual(originalData);

            const { done: done2 } = await reader.read();
            expect(done2).toBe(true);
        });

        it('should handle multiple JSON objects in sequence', async () => {
            const objects = [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
                { id: 3, name: 'Charlie' },
            ];

            let fullData = '';
            objects.forEach((obj) => {
                const json = JSON.stringify(obj);
                fullData += `${json.length}:${json}`;
            });

            const encoder = new TextEncoder();
            const bytes = encoder.encode(fullData);

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(bytes);
                    controller.close();
                },
            });

            const transform = transformBytesToJson<(typeof objects)[0]>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            const results = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                results.push(value);
            }

            expect(results).toEqual(objects);
        });

        it('should handle fragmented data across multiple chunks', async () => {
            const originalData = { message: 'hello world', id: 123 };
            const jsonString = JSON.stringify(originalData);
            const lengthPrefix = `${jsonString.length}:`;
            const fullData = lengthPrefix + jsonString;

            const encoder = new TextEncoder();
            const bytes = encoder.encode(fullData);

            // Split the data into small chunks to test fragmentation
            const chunks: Uint8Array[] = [];
            for (let i = 0; i < bytes.length; i += 3) {
                chunks.push(bytes.slice(i, i + 3));
            }

            const readable = new ReadableStream({
                start(controller) {
                    chunks.forEach((chunk) => controller.enqueue(chunk));
                    controller.close();
                },
            });

            const transform = transformBytesToJson<typeof originalData>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            const { done, value } = await reader.read();
            expect(done).toBe(false);
            expect(value).toEqual(originalData);

            const { done: done2 } = await reader.read();
            expect(done2).toBe(true);
        });

        it('should handle partial length prefix in separate chunks', async () => {
            const originalData = { test: 'data' };
            const jsonString = JSON.stringify(originalData);
            const lengthPrefix = `${jsonString.length}:`;
            const fullData = lengthPrefix + jsonString;

            const encoder = new TextEncoder();
            const bytes = encoder.encode(fullData);

            // Split specifically to test partial length prefix
            const chunk1 = bytes.slice(0, 2); // Partial length
            const chunk2 = bytes.slice(2); // Rest of length + data

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(chunk1);
                    controller.enqueue(chunk2);
                    controller.close();
                },
            });

            const transform = transformBytesToJson<typeof originalData>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            const { done, value } = await reader.read();
            expect(done).toBe(false);
            expect(value).toEqual(originalData);
        });

        it('should throw error for invalid length prefix', async () => {
            const invalidData = 'invalid:{"test":"data"}';
            const encoder = new TextEncoder();
            const bytes = encoder.encode(invalidData);

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(bytes);
                    controller.close();
                },
            });

            const transform = transformBytesToJson<Record<string, unknown>>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            await expect(reader.read()).rejects.toThrow(
                'invalid length prefix',
            );
        });

        it('should handle empty length prefix gracefully', async () => {
            const data = ':{"test":"data"}';
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(bytes);
                    controller.close();
                },
            });

            const transform = transformBytesToJson<Record<string, unknown>>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            await expect(reader.read()).rejects.toThrow(
                'invalid length prefix',
            );
        });

        it('should handle malformed JSON in data section', async () => {
            const malformedJson = '{"test":"data"'; // Missing closing brace - 14 chars
            const lengthPrefix = `${malformedJson.length}:`;
            const fullData = lengthPrefix + malformedJson;

            const encoder = new TextEncoder();
            const bytes = encoder.encode(fullData);

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(bytes);
                    controller.close();
                },
            });

            const transform = transformBytesToJson<Record<string, unknown>>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            await expect(reader.read()).rejects.toThrow();
        });
    });

    describe('round-trip transformations', () => {
        it('should preserve data through JSON -> bytes -> JSON transformation', async () => {
            const originalData = [
                { id: 1, name: 'Alice', active: true },
                { id: 2, name: 'Bob', active: false },
                { id: 3, name: 'Charlie', active: true },
            ];

            // Create readable stream with original data
            const readable = new ReadableStream({
                start(controller) {
                    originalData.forEach((data) => controller.enqueue(data));
                    controller.close();
                },
            });

            // Transform through JSON -> bytes -> JSON
            const jsonToBytes =
                transformJsonToBytes<(typeof originalData)[0]>();
            const bytesToJson =
                transformBytesToJson<(typeof originalData)[0]>();

            const transformed = readable
                .pipeThrough(jsonToBytes)
                .pipeThrough(bytesToJson);

            const reader = transformed.getReader();
            const results = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                results.push(value);
            }

            expect(results).toEqual(originalData);
        });

        it('should handle complex nested objects in round-trip', async () => {
            const originalData = {
                user: {
                    id: 123,
                    profile: {
                        name: 'John Doe',
                        settings: {
                            theme: 'dark',
                            notifications: true,
                            preferences: {
                                language: 'en',
                                timezone: 'UTC',
                            },
                        },
                    },
                },
                metadata: {
                    created: new Date().toISOString(),
                    tags: ['important', 'user-data'],
                },
                data: [1, 2, 3, { nested: 'value', array: [4, 5, 6] }],
            };

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(originalData);
                    controller.close();
                },
            });

            const jsonToBytes = transformJsonToBytes<typeof originalData>();
            const bytesToJson = transformBytesToJson<typeof originalData>();

            const transformed = readable
                .pipeThrough(jsonToBytes)
                .pipeThrough(bytesToJson);

            const reader = transformed.getReader();
            const { done, value } = await reader.read();

            expect(done).toBe(false);
            expect(value).toEqual(originalData);
        });

        it('should handle large objects in round-trip transformation', async () => {
            const largeObject = {
                data: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    name: `Item ${i}`,
                    description: `This is item number ${i} with some additional text to make it larger`,
                    tags: [`tag${i}`, `category${i % 10}`, 'common'],
                    metadata: {
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                        version: i % 5,
                    },
                })),
            };

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(largeObject);
                    controller.close();
                },
            });

            const jsonToBytes = transformJsonToBytes<typeof largeObject>();
            const bytesToJson = transformBytesToJson<typeof largeObject>();

            const transformed = readable
                .pipeThrough(jsonToBytes)
                .pipeThrough(bytesToJson);

            const reader = transformed.getReader();
            const { done, value } = await reader.read();

            expect(done).toBe(false);
            expect(value).toEqual(largeObject);
        });
    });

    describe('edge cases and error scenarios', () => {
        it('should handle zero-length JSON data', async () => {
            const data = '0:';
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(bytes);
                    controller.close();
                },
            });

            const transform = transformBytesToJson<Record<string, unknown>>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            await expect(reader.read()).rejects.toThrow();
        });

        it('should handle very large length prefix', async () => {
            const data = '999999999:{"test":"data"}';
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(bytes);
                    controller.close();
                },
            });

            const transform = transformBytesToJson<Record<string, unknown>>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            // Should wait for more data since length indicates much more data
            const { done } = await reader.read();
            expect(done).toBe(true); // Stream ends without enough data
        });

        it('should log data left over in flush', async () => {
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();

            const partialData = '10:{"test":"'; // Incomplete data
            const encoder = new TextEncoder();
            const bytes = encoder.encode(partialData);

            const readable = new ReadableStream({
                start(controller) {
                    controller.enqueue(bytes);
                    controller.close();
                },
            });

            const transform = transformBytesToJson<Record<string, unknown>>();
            const transformed = readable.pipeThrough(transform);
            const reader = transformed.getReader();

            // Read until done to trigger flush
            while (true) {
                const { done } = await reader.read();
                if (done) break;
            }

            expect(consoleSpy).toHaveBeenCalledWith(
                '[common] data left over',
                expect.any(Number),
            );

            consoleSpy.mockRestore();
        });
    });
});
