// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import {
    exportKey,
    newAesKey,
} from '@system-inc/base-common/cryptography/CryptoKeyFactory';

/**
 * Command for generating a key for a worker.
 */
export class KeyGenCommand implements yargs.CommandModule {
    command = 'keygen';
    aliases = ['key-gen'];
    describe = 'Generates an encryption key.';

    builder(args: yargs.Argv) {
        return args
            .option('format', {
                describe: 'The output format of the key.',
                alias: 'f',
                choices: ['json', 'toml'],
            })
            .hide('worker')
            .hide('environment');
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const key = await newAesKey();
            const exportedKey = await exportKey(key);
            // `key` is intentionally raw here: this command exists to
            // print fresh material for the operator to paste into
            // ENCRYPTION_KEYS. The runtime `ExportedEncryptionKey`
            // shape uses `Secret<string>`, but the wire/CLI form is
            // plaintext.
            const baseKey = {
                id: '<key-id>',
                key: exportedKey,
                settings: {
                    encrypt: {
                        length: 128,
                        name: 'AES-GCM',
                    },
                    sign: {
                        name: 'HMAC',
                        hash: {
                            name: 'SHA-256',
                        },
                    },
                },
            };
            if (args.format === 'json') {
                console.log(JSON.stringify(baseKey, null, 4));
            } else {
                //smoll toml was not outputting this in the format I wanted it in, so I manually output it
                console.log(
                    `{ id = "${baseKey.id}", key = "${baseKey.key}", settings = { encrypt = { name = "${baseKey.settings.encrypt.name}", length = "${baseKey.settings.encrypt.length}" }, sign = { name = "${baseKey.settings.sign.name}", hash = { name = "${baseKey.settings.sign.hash.name}" } } } }`,
                );
            }
        };
    }
}
