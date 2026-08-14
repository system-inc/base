// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ExportedEncryptionKey } from '@system-inc/base-common/cryptography/encryption/EncryptionKey';
import { EncryptionKeyProvider } from '@system-inc/base-common/cryptography/encryption/EncryptionKeyProvider';
import { Secret } from '@system-inc/base-common/secret/Secret';
import { EncryptedTokenService } from './EncryptedTokenService';

describe('EncryptedTokenService', () => {
    let service: EncryptedTokenService;

    beforeEach(() => {
        const keyMaterial = crypto.getRandomValues(new Uint8Array(16));
        const exportedKey: ExportedEncryptionKey = {
            id: 'test-key-1',
            key: new Secret(Buffer.from(keyMaterial).toString('base64')),
            settings: {
                encrypt: {
                    name: 'AES-GCM',
                    length: 128,
                },
                sign: {
                    name: 'HMAC',
                    hash: { name: 'SHA-256' },
                },
            },
        };

        const keyProvider = new EncryptionKeyProvider([exportedKey]);
        service = new EncryptedTokenService(keyProvider);
    });

    describe('encrypt / decrypt', () => {
        it('should round-trip a simple object', async () => {
            const payload = { email: 'test@example.com', role: 'admin' };
            const token = await service.encrypt(payload);
            const result = await service.decrypt<typeof payload>(token);

            expect(result).toEqual(payload);
        });

        it('should round-trip a complex nested object', async () => {
            const payload = {
                user: { name: 'Test', id: 123 },
                tags: ['a', 'b', 'c'],
                active: true,
            };
            const token = await service.encrypt(payload);
            const result = await service.decrypt<typeof payload>(token);

            expect(result).toEqual(payload);
        });

        it('should return null for an invalid token', async () => {
            const result = await service.decrypt('garbage-data');
            expect(result).toBeNull();
        });

        it('should return null for a tampered token', async () => {
            const payload = { email: 'test@example.com' };
            const token = await service.encrypt(payload);
            const tampered = token.slice(0, -5) + 'XXXXX';
            const result = await service.decrypt(tampered);

            expect(result).toBeNull();
        });

        it('should support authenticatedData', async () => {
            const payload = { email: 'test@example.com' };
            const secret = 'my-secret';
            const token = await service.encrypt(payload, secret);

            // Correct secret decrypts
            const result = await service.decrypt<typeof payload>(token, secret);
            expect(result).toEqual(payload);

            // Wrong secret fails
            const wrongResult = await service.decrypt<typeof payload>(
                token,
                'wrong-secret',
            );
            expect(wrongResult).toBeNull();

            // No secret fails
            const noSecretResult = await service.decrypt<typeof payload>(token);
            expect(noSecretResult).toBeNull();
        });
    });

    describe('encryptForUrl / decryptFromUrl', () => {
        it('should round-trip a payload through URL encoding', async () => {
            const payload = {
                emailAddress: 'user@example.com',
                emailTemplate: 'AgentCreated',
            };
            const token = await service.encryptForUrl(payload);
            const result = await service.decryptFromUrl<typeof payload>(token);

            expect(result).toEqual(payload);
        });

        it('should produce a URL-safe string', async () => {
            const payload = { data: 'test with special chars: +/=' };
            const token = await service.encryptForUrl(payload);

            // URL-encoded tokens should not contain raw special URL characters
            expect(token).not.toContain('/');
            expect(token).not.toContain('+');
            expect(token).not.toContain('=');
        });

        it('should return null for invalid URL token', async () => {
            const result = await service.decryptFromUrl('not-a-valid-token');
            expect(result).toBeNull();
        });

        it('should return null (not throw) for malformed percent-encoding', async () => {
            // decodeURIComponent throws URIError on these; the documented
            // contract is to return null for an invalid token.
            await expect(service.decryptFromUrl('%')).resolves.toBeNull();
            await expect(service.decryptFromUrl('%ZZ')).resolves.toBeNull();
            await expect(
                service.decryptFromUrl('abc%E0%A4%A'),
            ).resolves.toBeNull();
        });

        it('should support authenticatedData with URL encoding', async () => {
            const payload = { email: 'test@example.com' };
            const secret = 'url-secret';
            const token = await service.encryptForUrl(payload, secret);

            const result = await service.decryptFromUrl<typeof payload>(
                token,
                secret,
            );
            expect(result).toEqual(payload);

            const wrongResult = await service.decryptFromUrl<typeof payload>(
                token,
                'wrong',
            );
            expect(wrongResult).toBeNull();
        });
    });
});
