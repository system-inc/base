// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DynamicBuffer } from '../buffer/DynamicBuffer';
import { bytesToBase64 } from '../encoding/ByteEncoding';
import { LogCategory } from '../logging/LogCategory';
import { Logger } from '../logging/Logger';

export async function readableStreamToBase64(
    readableStream: ReadableStream,
): Promise<string> {
    // Collect the stream chunks into a buffer
    const chunks: Uint8Array[] = [];
    const reader = readableStream.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    // Concatenate all chunks into a single Uint8Array buffer
    const buffer = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
    }

    // Convert the buffer to a Base64 string
    const base64String = bytesToBase64(buffer);
    return base64String;
}

export function transformJsonToBytes<JsonType>() {
    const textEnoder = new TextEncoder();
    return new TransformStream<JsonType, Uint8Array>({
        transform(
            chunk: JsonType,
            controller: TransformStreamDefaultController<Uint8Array>,
        ) {
            const json = JSON.stringify(chunk);
            const data = textEnoder.encode(json);
            controller.enqueue(textEnoder.encode(data.length.toString() + ':'));
            controller.enqueue(data);
        },
    });
}

export function transformBytesToJson<JsonType>(): TransformStream<
    Uint8Array,
    JsonType
> {
    // let buffer = new ArrayBuffer(1024, {maxByteLength: 1024});
    const buffer = new DynamicBuffer();
    const textDecoder = new TextDecoder();
    const colonCharCode = ':'.charCodeAt(0);

    return new TransformStream<Uint8Array, JsonType>({
        transform: function (
            chunk: Uint8Array,
            controller: TransformStreamDefaultController<JsonType>,
        ) {
            // write the chunk to our buffer
            buffer.write(chunk);
            // try to read messages from the buffer
            read(controller);
        },
        flush: function () {
            if (buffer.length() > 0) {
                // let data = buffer.read(buffer.length());
                // let text = textDecoder.decode(data);
                // console.error('data left over', text);
                Logger.error(
                    LogCategory.Common,
                    'data left over',
                    buffer.length(),
                );
            }
        },
    });

    function read(controller: TransformStreamDefaultController<JsonType>) {
        // read messages until we run out of data
        while (readNext(controller) && buffer.length() > 0) {
            /* empty */
        }
    }

    function readNext(
        controller: TransformStreamDefaultController<JsonType>,
    ): boolean {
        // byte format is <length>:<data>, with length being a string
        // find the length prefix separator (colon)
        const prefixSeparatorIndex = buffer.findIndex(colonCharCode);
        if (prefixSeparatorIndex === -1) {
            // wait for more data
            return false;
        }

        // get the length string
        // only peek at the prefix, incase we need to wait for all the data to arrive
        const prefixString = textDecoder.decode(
            buffer.peek(prefixSeparatorIndex),
        );
        const prefixLength = prefixString.length + 1;
        const match = prefixString.match(/^\d+$/);
        if (!match) {
            throw new Error('invalid length prefix');
        }
        const dataLength = parseInt(prefixString);

        // check that the complete data is in the buffer
        if (buffer.length() < prefixLength + dataLength) {
            // wait for more data
            return false;
        }

        // get our data from the buffer
        // skip the length prefix and separator, since we already read it via peek
        buffer.skip(prefixLength);
        // read the data
        const data = buffer.read(dataLength);
        // push the message to the stream
        controller.enqueue(JSON.parse(textDecoder.decode(data)));

        return true;
    }
}
