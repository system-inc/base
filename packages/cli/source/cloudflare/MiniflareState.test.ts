// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as path from 'node:path';

import { miniflareD1SqlitePath } from './MiniflareState';

describe('miniflareD1SqlitePath', () => {
    // Ground truth: `wrangler d1 execute test-db --local --persist-to ./state`
    // with test-worker's database_id produces exactly this file under
    // `state/v3/`. If this test fails after a wrangler upgrade, miniflare
    // changed its id derivation and the helper must be updated to match.
    it('derives the same sqlite filename wrangler writes', () => {
        expect(
            miniflareD1SqlitePath(
                '/state/v3',
                'bc2df38e-c1f3-407d-9f2d-0a78da3bdae3',
            ),
        ).toBe(
            path.join(
                '/state/v3',
                'd1',
                'miniflare-D1DatabaseObject',
                'c9ef214f282fec1f2b1fe3a6109318f3cdcf95319f8db3187e8afd12a153359e.sqlite',
            ),
        );
    });

    it('maps different database ids to different files', () => {
        const a = miniflareD1SqlitePath('/root', 'database-a');
        const b = miniflareD1SqlitePath('/root', 'database-b');
        expect(a).not.toBe(b);
    });
});
