// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { NodeWebSocket } from './NodeWebSocketTypes';
import { NodeWebSocketWrapper } from './NodeWebSocketWrapper';

describe('NodeWebSocketWrapper', () => {
    it('reads back the onclose handler without infinite recursion', () => {
        const wrapper = new NodeWebSocketWrapper({} as NodeWebSocket);
        const handler = () => {};
        wrapper.onclose = handler as never;
        // before the fix the getter returned `this.onclose`, recursing until
        // "Maximum call stack size exceeded"
        expect(wrapper.onclose).toBe(handler);
    });
});
