// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import 'reflect-metadata';

import { RequestContext } from '../RequestContext';
import { RequestContextKey } from '../RequestContextKey';
import {
    InjectRequestContext,
    REQUEST_CONTEXT_METADATA_KEY,
    resolveRequestContextParams,
} from './RequestContextDecorator';
import { withRequestContext } from './WithRequestContext';

function makeRequestContext(
    overrides: Partial<RequestContext> = {},
): RequestContext {
    // Minimal stub — tests only exercise the property that the specific
    // guard/method under test reads.
    return {
        get: (key: RequestContextKey<unknown>) =>
            (overrides as Record<string, unknown>)[key.name],
        ...overrides,
    } as unknown as RequestContext;
}

describe('withRequestContext', () => {
    test('runs the guard with the RequestContext and forwards original args', async () => {
        const guard = jest.fn();
        const decorator = withRequestContext(guard);

        class Service {
            async method(a: string, b: number): Promise<string> {
                return `${a}:${b}`;
            }
        }
        const descriptor = Object.getOwnPropertyDescriptor(
            Service.prototype,
            'method',
        )!;
        decorator(Service.prototype, 'method', descriptor);
        Object.defineProperty(Service.prototype, 'method', descriptor);

        const rc = makeRequestContext();
        const service = new Service();
        // Simulate what the dispatcher does: declared args + RC trailing
        // at the slot registered by withRequestContext.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (service as any).method('hello', 7, rc);

        expect(guard).toHaveBeenCalledWith(rc);
        expect(result).toBe('hello:7');
    });

    test('stacked decorators each get the RC at their own slot', async () => {
        // This is the scenario that was broken: two withRequestContext
        // decorators stacked on the same method. The outer one used to
        // pick slot 0 because the inner wrapper has arity 0 from the
        // rest-param signature, clobbering the first real argument.
        const outerGuard = jest.fn();
        const innerGuard = jest.fn();

        class Service {
            async method(a: string, b: number): Promise<string> {
                return `${a}:${b}`;
            }
        }

        // Apply bottom-up, matching how the TypeScript decorator pipeline
        // invokes stacked method decorators.
        const inner = withRequestContext(innerGuard);
        const outer = withRequestContext(outerGuard);
        let descriptor = Object.getOwnPropertyDescriptor(
            Service.prototype,
            'method',
        )!;
        inner(Service.prototype, 'method', descriptor);
        Object.defineProperty(Service.prototype, 'method', descriptor);
        descriptor = Object.getOwnPropertyDescriptor(
            Service.prototype,
            'method',
        )!;
        outer(Service.prototype, 'method', descriptor);
        Object.defineProperty(Service.prototype, 'method', descriptor);

        const indices: number[] = Reflect.getMetadata(
            REQUEST_CONTEXT_METADATA_KEY,
            Service.prototype,
            'method',
        );
        // Two distinct trailing slots — the second decorator must pick a
        // slot past the first, not collide at 0.
        expect(indices).toEqual([2, 3]);

        // Drive the method the way the dispatcher would: declared args
        // first, then one RC per registered slot.
        const rc = makeRequestContext();
        const args = ['hello', 7];
        resolveRequestContextParams(
            Service.prototype,
            'method',
            rc,
            args as unknown[],
        );
        // resolveRequestContextParams writes RC into slots 2 and 3.
        expect(args).toEqual(['hello', 7, rc, rc]);

        const service = new Service();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (service as any).method(...args);

        expect(outerGuard).toHaveBeenCalledWith(rc);
        expect(innerGuard).toHaveBeenCalledWith(rc);
        expect(result).toBe('hello:7');
    });

    test('picks a slot past existing extraction-key registrations', async () => {
        // Key-based extractions register in the extractions map, not the
        // whole-context indices array. The slot picker has to account
        // for both, otherwise it can collide with an extraction slot
        // already written by the user's @InjectRequestContext(KEY).
        const guard = jest.fn();

        class Service {
            async method(_a: string, _b: number, _c: boolean): Promise<void> {}
        }

        const key = RequestContextKey.create<string>('slotCollisionKey');
        // Slot 5 is past the declared arity; simulates a user-written
        // `@InjectRequestContext(KEY)` on a high-index parameter.
        InjectRequestContext(key)(Service.prototype, 'method', 5);

        const decorator = withRequestContext(guard);
        const descriptor = Object.getOwnPropertyDescriptor(
            Service.prototype,
            'method',
        )!;
        decorator(Service.prototype, 'method', descriptor);
        Object.defineProperty(Service.prototype, 'method', descriptor);

        const indices: number[] = Reflect.getMetadata(
            REQUEST_CONTEXT_METADATA_KEY,
            Service.prototype,
            'method',
        );
        // Must land past slot 5, not on originalMethod.length (3).
        expect(indices).toEqual([6]);
    });
});
