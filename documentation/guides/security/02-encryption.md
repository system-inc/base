---
title: Encryption
description: Generate keys with base keygen and mint tamper-proof encrypted tokens.
---

Base ships an encrypted-token service for the classic needs (email-verification links, password-reset tokens, signed state in cookies or URLs), built on AES-GCM encryption with HMAC signing, with key rotation designed in from the start.

## Generate a key

```bash
npx base keygen
```

Prints a fresh key entry (TOML by default; `--format json` for JSON):

```
{ id = "<key-id>", key = "...", settings = { encrypt = { name = "AES-GCM", length = "128" }, sign = { name = "HMAC", hash = { name = "SHA-256" } } } }
```

Replace the `<key-id>` placeholder with a name of your choosing (`"2026-08"` works well; you'll thank yourself at rotation time). The command only prints; nothing is written anywhere.

## Configure `ENCRYPTION_KEYS`

Keys live in the `ENCRYPTION_KEYS` environment variable as an **array**, because rotation means multiple live keys. In `env.toml`:

```toml
[Production]
ENCRYPTION_KEYS = [
    { id = "2026-08", key = "...", settings = { encrypt = { name = "AES-GCM", length = 128 }, sign = { name = "HMAC", hash = { name = "SHA-256" } } } },
]
```

To rotate: generate a new key, **prepend** it, and keep the old ones listed until tokens minted with them have expired: new tokens use the newest key, old tokens still decrypt.

## Mint and verify tokens

```ts
import { EncryptedTokenService } from '@system-inc/base-foundation/cryptography/encryption/EncryptedTokenService';

@Injectable()
export class EmailVerificationService {
    constructor(
        @Inject(EncryptedTokenService)
        private readonly tokens: EncryptedTokenService,
    ) {}

    async createVerificationLink(accountId: string): Promise<string> {
        const token = await this.tokens.encryptForUrl({
            accountId,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });
        return `https://app.example.com/verify?token=${token}`;
    }

    async verify(token: string): Promise<string | null> {
        const payload = await this.tokens.decryptFromUrl<{
            accountId: string;
            expiresAt: number;
        }>(token);
        if (!payload || payload.expiresAt < Date.now()) {
            return null;
        }
        return payload.accountId;
    }
}
```

The four methods: `encrypt`/`decrypt` for opaque strings (cookies, headers), `encryptForUrl`/`decryptFromUrl` with URL-safe encoding for links. All four take an optional `authenticatedData` string that binds a token to its context: pass the account id when encrypting and again when decrypting, and a token lifted from one context won't decrypt in another.

**`decrypt` returns `null` on any failure; it never throws.** Wrong key, tampered payload, garbage input, hostile cookie: all `null`, by design, so junk input can't crash a request. Every decrypt call needs its null-check, as above.

## What this is for: And not

Encrypted tokens carry **short-lived, self-contained state** across an untrusted hop. They are not session storage (that's the [access-control provider](./01-access-control.md) and its backing store), not password hashing (one-way hashing is a different tool), and payloads should stay small and expirable: put an `expiresAt` inside and check it, as the example does.
