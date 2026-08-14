// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { decryptData } from '../cryptography/encryption/Decryption';
import { EncryptionKeyProvider } from '../cryptography/encryption/EncryptionKeyProvider';
import { AuthenticatedData } from '../cryptography/encryption/EncryptionOperations';
import { LogCategory } from '../logging/LogCategory';
import { Logger } from '../logging/Logger';
import { Dictionary } from '../type/Dictionary';
import { SetCookieOptions } from './SetCookie';

export namespace Cookies {
    export type GetCookieParser<T> = (s: string) => T | undefined;

    export function normalizeDomain(domain?: string): string | undefined {
        if (!domain) {
            return undefined;
        }
        domain = domain.trim();
        if (!domain.startsWith('.')) {
            return `.${domain}`;
        }
        return domain;
    }

    export function getCookie<T>(
        cookies: Dictionary<string> | undefined,
        name: string,
        parser: GetCookieParser<T>,
    ): T | undefined {
        // make sure we have cookies
        if (!cookies) {
            return undefined;
        }

        // try to get the cookie from the cookie jar
        const cookie = cookies[name];
        if (!cookie) {
            return undefined;
        }

        // try to parse the cookie
        try {
            return parser(cookie);
        } catch (error) {
            Logger.error(
                LogCategory.Common,
                'Error parsing cookie %s: ',
                name,
                error,
            );
            return undefined;
        }
    }

    export async function getEncryptedCookie<T>(
        cookies: Dictionary<string> | undefined,
        name: string,
        parser: GetCookieParser<T>,
        encryptionKeyProvider: EncryptionKeyProvider,
        authenticatedData?: AuthenticatedData,
    ): Promise<T | undefined> {
        // make sure we have cookies
        if (!cookies) {
            return undefined;
        }

        // get the encrypted cookie from the request cookies
        const encryptedCookie = cookies[name];
        if (!encryptedCookie) {
            return undefined;
        }

        // try to decrypt the cookie
        let cookie: string | undefined = undefined;
        try {
            const decryptedDeviceCookie = await decryptData(
                encryptedCookie,
                encryptionKeyProvider,
                authenticatedData,
            );
            if (typeof decryptedDeviceCookie !== 'string') {
                throw new Error(
                    `Invalid ${name} cookie: decrypted value was not a string`,
                );
            }
            cookie = decryptedDeviceCookie;
        } catch (error) {
            // TODO decide if we want this log or anythign else here
            Logger.warn(
                LogCategory.Common,
                'Error decrypting %s cookie: ',
                name,
                error,
            );
        }

        if (!cookie) {
            return undefined;
        }

        // try to parse the cookie
        try {
            return parser(cookie);
        } catch (error) {
            Logger.error(
                LogCategory.Common,
                'Error parsing cookie %s: ',
                name,
                error,
            );
            return undefined;
        }
    }

    export function secureCookieOptions(
        options: Pick<
            SetCookieOptions,
            'name' | 'value' | 'maxAge' | 'domain' | 'partitioned'
        >,
    ): SetCookieOptions {
        const sameSite: SetCookieOptions['sameSite'] = 'None';
        const secure = true;
        const domain = Cookies.normalizeDomain(options.domain);

        return {
            name: options.name,
            value: options.value,
            maxAge: options.maxAge,
            secure: secure,
            sameSite: sameSite,
            httpOnly: true,
            partitioned: options.partitioned,
            domain: domain,
            path: '/',
        };
    }
}
