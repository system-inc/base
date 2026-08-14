// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import 'reflect-metadata';

import {
    InjectRequestContext,
    REQUEST_CONTEXT_METADATA_KEY,
} from './RequestContextDecorator';

describe('InjectRequestContext', () => {
    test('should store the parameter index in Reflect metadata', () => {
        class TestService {
            testMethod(
                _input: string,
                @InjectRequestContext() _rc?: unknown,
            ): void {}
        }

        const indices = Reflect.getMetadata(
            REQUEST_CONTEXT_METADATA_KEY,
            TestService.prototype,
            'testMethod',
        );
        expect(indices).toEqual([1]);
    });

    test('should store index 0 when it is the first parameter', () => {
        class TestService {
            testMethod(@InjectRequestContext() _rc?: unknown): void {}
        }

        const indices = Reflect.getMetadata(
            REQUEST_CONTEXT_METADATA_KEY,
            TestService.prototype,
            'testMethod',
        );
        expect(indices).toEqual([0]);
    });

    test('should store correct index with multiple preceding params', () => {
        class TestService {
            testMethod(
                _a: string,
                _b: number,
                _c: boolean,
                @InjectRequestContext() _rc?: unknown,
            ): void {}
        }

        const indices = Reflect.getMetadata(
            REQUEST_CONTEXT_METADATA_KEY,
            TestService.prototype,
            'testMethod',
        );
        expect(indices).toEqual([3]);
    });

    test('should accumulate indices when applied multiple times', () => {
        class TestService {
            testMethod(_input: string): void {}
        }

        // Simulate a second decorator (e.g., an auth wrapper) programmatically
        // registering an additional RC index at the next slot.
        InjectRequestContext()(TestService.prototype, 'testMethod', 1);
        InjectRequestContext()(TestService.prototype, 'testMethod', 2);

        const indices = Reflect.getMetadata(
            REQUEST_CONTEXT_METADATA_KEY,
            TestService.prototype,
            'testMethod',
        );
        expect(indices).toEqual([1, 2]);
    });

    test('should dedupe the same index', () => {
        class TestService {
            testMethod(_input: string): void {}
        }

        InjectRequestContext()(TestService.prototype, 'testMethod', 1);
        InjectRequestContext()(TestService.prototype, 'testMethod', 1);

        const indices = Reflect.getMetadata(
            REQUEST_CONTEXT_METADATA_KEY,
            TestService.prototype,
            'testMethod',
        );
        expect(indices).toEqual([1]);
    });

    test('should not set metadata for methods without the decorator', () => {
        class TestService {
            testMethod(_input: string): void {}
        }

        const indices = Reflect.getMetadata(
            REQUEST_CONTEXT_METADATA_KEY,
            TestService.prototype,
            'testMethod',
        );
        expect(indices).toBeUndefined();
    });
});
