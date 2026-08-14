// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { PlatformType } from '@system-inc/base-foundation/configuration/Platform';
import { CliPlatformType, userCwd } from './CliHelpers';

describe('CliPlatformType.getPlatformTypeFromArgumentString', () => {
    it('maps cloudflare to CloudflareWorker', () => {
        expect(
            CliPlatformType.getPlatformTypeFromArgumentString('cloudflare'),
        ).toBe(PlatformType.CloudflareWorker);
    });

    it('maps cloudflare-worker to CloudflareWorker', () => {
        expect(
            CliPlatformType.getPlatformTypeFromArgumentString(
                'cloudflare-worker',
            ),
        ).toBe(PlatformType.CloudflareWorker);
    });

    it('maps node to Node', () => {
        expect(CliPlatformType.getPlatformTypeFromArgumentString('node')).toBe(
            PlatformType.Node,
        );
    });

    it('is case-insensitive', () => {
        // The arg parser lowercases internally so `Node`, `NODE`, and
        // `node` all route to the same target. Important for ergonomic
        // CLI invocations.
        expect(CliPlatformType.getPlatformTypeFromArgumentString('NODE')).toBe(
            PlatformType.Node,
        );
        expect(
            CliPlatformType.getPlatformTypeFromArgumentString('Cloudflare'),
        ).toBe(PlatformType.CloudflareWorker);
    });

    it('throws on an unknown platform string', () => {
        expect(() =>
            CliPlatformType.getPlatformTypeFromArgumentString('bun'),
        ).toThrow(/Unknown platform type: bun/);
    });
});

describe('userCwd', () => {
    let originalInitCwd: string | undefined;

    beforeEach(() => {
        originalInitCwd = process.env.INIT_CWD;
    });

    afterEach(() => {
        if (originalInitCwd === undefined) {
            delete process.env.INIT_CWD;
        } else {
            process.env.INIT_CWD = originalInitCwd;
        }
    });

    it('returns INIT_CWD when set (matches npm/npx behavior)', () => {
        process.env.INIT_CWD = '/some/user/dir';
        expect(userCwd()).toBe('/some/user/dir');
    });

    it('falls back to process.cwd() when INIT_CWD is unset', () => {
        delete process.env.INIT_CWD;
        // process.cwd() can be anything; just verify the equality.
        expect(userCwd()).toBe(process.cwd());
    });

    it('falls back when INIT_CWD is the empty string', () => {
        // Defensive: an empty env var is rendered "" by some shells.
        // Treat it like "not set."
        process.env.INIT_CWD = '';
        expect(userCwd()).toBe(process.cwd());
    });
});
