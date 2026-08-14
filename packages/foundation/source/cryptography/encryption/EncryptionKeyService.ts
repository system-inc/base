// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ExportedEncryptionKey } from '@system-inc/base-common/cryptography/encryption/EncryptionKey';
import { EncryptionKeyProvider } from '@system-inc/base-common/cryptography/encryption/EncryptionKeyProvider';
import { Secret } from '@system-inc/base-common/secret/Secret';
import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { BaseEnvironmentKey } from '../../configuration/BaseEnvironmentKey';
import { Inject } from '../../dependency-injection/decorators/Inject';
import { Injectable } from '../../dependency-injection/decorators/Injectable';

/**
 * Wire-format of an entry in `ENCRYPTION_KEYS` before the `.key`
 * field is wrapped in a {@link Secret}. Raw bytes arrive as a plain
 * base64 string (from TOML / JSON) and are wrapped exactly once, at
 * the env-parsing boundary below.
 */
type RawExportedEncryptionKey = Omit<ExportedEncryptionKey, 'key'> & {
    key: string;
};

const EncryptionKeysEnv = BaseEnvironmentKey.create<
    string | RawExportedEncryptionKey[]
>('ENCRYPTION_KEYS');

@Injectable()
export class EncryptionKeyService extends EncryptionKeyProvider {
    constructor(
        @Inject(BaseConfiguration) baseConfiguration: BaseConfiguration,
    ) {
        const rawKeys =
            baseConfiguration.getEnvironmentVariable(EncryptionKeysEnv);
        if (!rawKeys) {
            throw new Error('ENCRYPTION_KEYS environment variable is required');
        }

        let parsedKeys: RawExportedEncryptionKey[];
        if (typeof rawKeys === 'string') {
            try {
                parsedKeys = JSON.parse(rawKeys);
            } catch (err) {
                throw new Error(
                    'Failed to parse ENCRYPTION_KEYS from environment variables',
                );
            }
        } else {
            parsedKeys = rawKeys;
        }

        if (!Array.isArray(parsedKeys) || parsedKeys.length === 0) {
            throw new Error('ENCRYPTION_KEYS must be a non-empty array');
        }

        // Wrap each key field in a Secret at this single boundary. After
        // this point, the raw base64 string exists only inside the
        // Secret wrapper and is revealed once inside the EncryptionKey
        // constructor when importing into Web Crypto.
        const encryptionKeys: ExportedEncryptionKey[] = parsedKeys.map(
            (entry) => ({
                id: entry.id,
                key: new Secret(entry.key),
                settings: entry.settings,
            }),
        );

        super(encryptionKeys);
    }
}
