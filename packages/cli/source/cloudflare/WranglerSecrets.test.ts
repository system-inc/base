// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';

import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { WranglerSecrets } from './WranglerSecrets';

const variables = {
    ENVIRONMENT: 'Production',
    COMMIT_SHA: 'abc123',
    STRIPE_SECRET_KEY: 'sk_live_123',
    DATABASES: [{ name: '@default', url: 'mysql://user:pass@host/db' }],
    RETRIES: 3,
    UNSET: undefined,
} as unknown as EnvironmentVariables;

describe('WranglerSecrets.split', () => {
    it('sends env.toml names as secrets and everything else as vars', () => {
        const { vars, secrets } = WranglerSecrets.split(
            variables,
            new Set(['STRIPE_SECRET_KEY', 'DATABASES']),
            new Set(),
        );

        expect(secrets).toEqual({
            STRIPE_SECRET_KEY: 'sk_live_123',
            DATABASES:
                '[{"name":"@default","url":"mysql://user:pass@host/db"}]',
        });
        expect(vars).toEqual({
            ENVIRONMENT: 'Production',
            COMMIT_SHA: 'abc123',
            RETRIES: '3',
        });
    });

    it('JSON-encodes structured values in var arguments', () => {
        const { vars } = WranglerSecrets.split(variables, new Set(), new Set());

        expect(WranglerSecrets.toVarArguments(vars)).toContain(
            'DATABASES:[{"name":"@default","url":"mysql://user:pass@host/db"}]',
        );
    });

    it('refuses a name that is both a wrangler.toml var and an env.toml secret', () => {
        expect(() =>
            WranglerSecrets.split(
                variables,
                new Set(['STRIPE_SECRET_KEY']),
                new Set(['STRIPE_SECRET_KEY', 'COMMIT_SHA']),
            ),
        ).toThrow(
            /STRIPE_SECRET_KEY is set in both wrangler\.toml \[vars\] and env\.toml/,
        );
    });
});

describe('WranglerSecrets.withSecretsFile', () => {
    it('passes no file when there are no secrets', async () => {
        const seen = await WranglerSecrets.withSecretsFile(
            {},
            async (file) => file,
        );

        expect(seen).toBeUndefined();
    });

    it('writes an owner-only JSON file and deletes it afterward', async () => {
        let seenPath: string | undefined;
        await WranglerSecrets.withSecretsFile(
            { STRIPE_SECRET_KEY: 'sk_live_123' },
            async (file) => {
                seenPath = file;
                expect(JSON.parse(fs.readFileSync(file!, 'utf8'))).toEqual({
                    STRIPE_SECRET_KEY: 'sk_live_123',
                });
                expect(fs.statSync(file!).mode & 0o777).toBe(0o600);
            },
        );

        expect(seenPath).toBeDefined();
        expect(fs.existsSync(seenPath!)).toBe(false);
    });

    it('deletes the file when the wrangler run fails', async () => {
        let seenPath: string | undefined;
        await expect(
            WranglerSecrets.withSecretsFile({ A: 'secret' }, async (file) => {
                seenPath = file;
                throw new Error('wrangler exited 1');
            }),
        ).rejects.toThrow('wrangler exited 1');

        expect(fs.existsSync(seenPath!)).toBe(false);
    });
});
