// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { SetCookie } from './SetCookie';

describe('SetCookie.toString', () => {
    it('emits Max-Age=0 (the delete-immediately value)', () => {
        const cookie = new SetCookie({ name: 'sid', value: '', maxAge: 0 });
        expect(cookie.toString()).toContain('Max-Age=0');
    });

    it('emits a positive Max-Age', () => {
        const cookie = new SetCookie({ name: 'sid', value: 'x', maxAge: 3600 });
        expect(cookie.toString()).toContain('Max-Age=3600');
    });

    it('omits Max-Age when not set', () => {
        const cookie = new SetCookie({ name: 'sid', value: 'x' });
        expect(cookie.toString()).not.toContain('Max-Age');
    });
});
