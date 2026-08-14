// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { HandlerMiddlewareRegistration } from '../../middleware/BaseMiddleware';
import { MiddlewareMetadata } from './MiddlewareMetadata';

const mwA = (() => {}) as unknown as HandlerMiddlewareRegistration;
const mwB = (() => {}) as unknown as HandlerMiddlewareRegistration;
const mwClass = (() => {}) as unknown as HandlerMiddlewareRegistration;

describe('MiddlewareMetadata', () => {
    it('appends stacked registrations instead of overwriting them', () => {
        const metadata = new MiddlewareMetadata();
        // two @WithMiddleware on the same method register separately
        metadata.addMiddleware('Service.op', [mwA]);
        metadata.addMiddleware('Service.op', [mwB]);
        expect(metadata.getMiddleware('Service.op')).toEqual([mwA, mwB]);
    });

    it('does not alias the caller array on the first registration', () => {
        const metadata = new MiddlewareMetadata();
        const caller = [mwA];
        metadata.addMiddleware('Service.op', caller);
        caller.push(mwB); // must not leak into stored metadata
        expect(metadata.getMiddleware('Service.op')).toEqual([mwA]);
    });

    it('merges class and operation middleware for a handler', () => {
        const metadata = new MiddlewareMetadata();
        class Service {}
        metadata.addMiddleware('Service', [mwClass]);
        metadata.addMiddleware('Service.op', [mwA]);
        metadata.addMiddleware('Service.op', [mwB]);

        const handler = new BaseHandler(Service, 'op');
        expect(metadata.getMiddlewareForHandler(handler)).toEqual([
            mwClass,
            mwA,
            mwB,
        ]);
    });
});
