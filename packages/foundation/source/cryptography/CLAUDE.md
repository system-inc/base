# cryptography/ — encrypted tokens

Foundation-level encryption services (DI-injectable) built on the primitives in [`base-common/cryptography`](../../../common/CLAUDE.md). Small — two services.

- **`EncryptedTokenService`** (`encryption/`) — encrypt/decrypt typed payloads to/from opaque token strings using AES, with key-rotation support. Tokens are **self-validating**: a successful decrypt proves authenticity (optionally bound to `authenticatedData`). Use it for stateless tokens (sessions, signed handles) you hand to clients and read back.
- **`EncryptionKeyService`** — supplies the encryption keys (implements `base-common`'s `EncryptionKeyProvider`), supporting rotation. Keys are generated with the CLI's `base keygen` and supplied via the **`ENCRYPTION_KEYS`** environment variable — an array of key entries (native TOML array in `env.toml`, or a JSON string), newest first for rotation (see [configuration](../configuration/CLAUDE.md) typed secret keys).

Both are `@Injectable()`; inject `EncryptedTokenService` where you need token crypto.

## See also

[`base-common/cryptography`](../../../common/CLAUDE.md) (`encryptData`/`decryptData`, key types) · [cli](../../../cli/CLAUDE.md) (`keygen`).
