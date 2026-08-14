// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DeferredExecutor } from './DeferredExecutor';

describe('DeferredExecutor', () => {
    it('runs every queued action in order', async () => {
        const executor = new DeferredExecutor();
        const order: number[] = [];
        executor.append(async () => {
            order.push(1);
        });
        executor.append(async () => {
            order.push(2);
        });
        await executor.execute();
        expect(order).toEqual([1, 2]);
    });

    it('drains the queue so a second execute does not re-run actions', async () => {
        const executor = new DeferredExecutor();
        const action = jest.fn(async () => {});
        executor.append(action);

        await executor.execute();
        await executor.execute();

        // Before the drain fix, execute() left _actions intact, so a second
        // drain (as the shared websocket container gets, once per event) would
        // re-run every prior action.
        expect(action).toHaveBeenCalledTimes(1);
    });

    it('only runs actions appended since the last execute', async () => {
        const executor = new DeferredExecutor();
        const first = jest.fn(async () => {});
        const second = jest.fn(async () => {});

        executor.append(first);
        await executor.execute();

        executor.append(second);
        await executor.execute();

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('runs actions appended by another action within the same execute', async () => {
        const executor = new DeferredExecutor();
        const order: string[] = [];
        executor.append(async () => {
            order.push('outer');
            executor.append(async () => {
                order.push('nested');
            });
        });

        await executor.execute();

        expect(order).toEqual(['outer', 'nested']);
        // and the queue is fully drained afterwards
        const after = jest.fn(async () => {});
        await executor.execute();
        expect(after).not.toHaveBeenCalled();
    });

    it('continues after an action throws and still drains the rest', async () => {
        const executor = new DeferredExecutor();
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const after = jest.fn(async () => {});
        try {
            executor.append(async () => {
                throw new Error('boom');
            });
            executor.append(after);

            await executor.execute();

            expect(after).toHaveBeenCalledTimes(1);
            expect(errorSpy).toHaveBeenCalled();
        } finally {
            errorSpy.mockRestore();
        }
    });
});
