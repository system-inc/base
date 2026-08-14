// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export class DynamicBuffer {
    buffer: ArrayBuffer;
    view: Uint8Array;

    constructor(initialSize: number = 1024) {
        this.buffer = new ArrayBuffer(initialSize);
        this.view = new Uint8Array(this.buffer.slice(0, 0));
    }

    write(chunk: Uint8Array) {
        // available space at end of buffer
        const availableAtEnd =
            this.buffer.byteLength - (this.view.byteOffset + this.view.length);

        // write to end if data will fit
        if (chunk.length <= availableAtEnd) {
            const newView = new Uint8Array(
                this.buffer,
                this.view.byteOffset,
                this.view.length + chunk.length,
            );
            newView.set(chunk, this.view.length);
            this.view = newView;
            return;
        }

        // see if there is enough space if we shift the data to the beginning of the buffer
        const availableAtBeginning = this.view.byteOffset;
        if (chunk.length <= availableAtBeginning + availableAtEnd) {
            // shift data to beginning of buffer and append
            const newView = new Uint8Array(
                this.buffer,
                0,
                this.view.length + chunk.length,
            );
            newView.set(this.view);
            newView.set(chunk, this.view.length);
            this.view = newView;
            return;
        }

        // data didn't fit, grow underlying buffer
        this.grow(this.view.length + chunk.length);
        const newView = new Uint8Array(
            this.buffer,
            0,
            this.view.length + chunk.length,
        );
        newView.set(chunk, this.view.length);
        this.view = newView;
    }

    peek(length: number): Uint8Array {
        if (length > this.view.length) {
            throw new Error('not enough data');
        }

        // make a copy of the data
        return this.view.slice(0, length);
    }

    read(length: number): Uint8Array {
        if (length > this.view.length) {
            throw new Error('not enough data');
        }

        // make a copy of the data
        const chunk = this.view.slice(0, length);
        // slide the data window on the underlying buffer
        this.view = this.view.subarray(length);
        return chunk;
    }

    skip(length: number) {
        if (length > this.view.length) {
            throw new Error('not enough data');
        }

        // slide the data window on the underlying buffer
        this.view = this.view.subarray(length);
    }

    findIndex(searchValue: number): number {
        return this.view.findIndex((value) => {
            return value === searchValue;
        });
    }

    length() {
        return this.view.length;
    }

    private grow(newSize: number) {
        newSize = Math.max(this.buffer.byteLength * 2, newSize);

        const newBuffer = new ArrayBuffer(newSize);
        const newView = new Uint8Array(newBuffer, 0, this.view.length);
        newView.set(this.view);

        this.buffer = newBuffer;
        this.view = newView;
    }
}
