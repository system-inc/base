// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { generateNonce } from '../../cryptography/NonceGeneration';
import { Secret } from '../../secret/Secret';

/**
 * Percent-encode per RFC 3986 (which OAuth 1.0a / RFC 5849 §3.6 requires):
 * everything except ALPHA / DIGIT / `-._~` is encoded. encodeURIComponent
 * leaves `!'()*` literal, which would produce a base string (and signing
 * key) that a conformant provider can't reproduce.
 */
function rfc3986Encode(value: string): string {
    return encodeURIComponent(value).replace(
        /[!'()*]/g,
        (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase(),
    );
}

/**
 * Options for generating the OAuth 1.0a header.
 *
 * `consumerSecret` and `tokenSecret` are wrapped in {@link Secret} so
 * they can't leak through logs or serialization of this options object;
 * they are revealed only at the HMAC signing-key construction site.
 */
export interface OAuth1aOptions {
    method: string;
    url: string;
    consumerKey: string;
    consumerSecret: Secret<string>;
    token: string;
    tokenSecret: Secret<string>;
    parameters?: Record<string, string>;
}

/**
 * Generates an OAuth 1.0a header string
 *
 * @param options OAuth configuration options
 * @returns A formatted OAuth header string starting with "OAuth"
 */
export async function generateOAuth1aHeader(
    options: OAuth1aOptions,
): Promise<string> {
    // Generate timestamp (seconds since epoch)
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Collect OAuth parameters
    const nonce = generateNonce();
    const oauthParams: Record<string, string> = {
        oauth_consumer_key: options.consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_token: options.token,
        oauth_version: '1.0',
    };

    // Combine all parameters for signature generation
    const allParams = { ...oauthParams, ...(options.parameters || {}) };

    // Generate signature
    const signature = await generateOauth1aSignature({
        method: options.method,
        url: options.url,
        parameters: allParams,
        consumerSecret: options.consumerSecret,
        tokenSecret: options.tokenSecret,
    });

    // Add signature to OAuth parameters
    oauthParams.oauth_signature = signature;
    const sortedParams = Object.entries(oauthParams).sort(([keyA], [keyB]) =>
        keyA.localeCompare(keyB),
    );

    // Format OAuth header
    const header =
        'OAuth ' +
        sortedParams
            .map(([key, value]) => `${key}="${rfc3986Encode(value)}"`)
            .join(',');

    return header;
}

/**
 * Generates the OAuth signature according to OAuth 1.0a spec
 *
 * @param options Parameters for signature generation
 * @returns Promise that resolves to Base64-encoded HMAC-SHA1 signature
 */
export async function generateOauth1aSignature(options: {
    method: string;
    url: string;
    parameters: Record<string, string>;
    consumerSecret: Secret<string>;
    tokenSecret: Secret<string>;
}): Promise<string> {
    // 1. Encode keys/values (RFC 3986), then sort by encoded key using a
    //    byte-ordinal comparison (RFC 5849 §3.4.1.3.2) — NOT localeCompare,
    //    which is locale-dependent and not byte order.
    const encodedPairs = Object.entries(options.parameters)
        .map(([key, value]): [string, string] => [
            rfc3986Encode(key),
            rfc3986Encode(value),
        ])
        .sort(([keyA], [keyB]) => (keyA < keyB ? -1 : keyA > keyB ? 1 : 0));

    // 2. Create parameter string
    const encodedParams = encodedPairs
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

    // 3. Create signature base string
    const baseString = [
        options.method.toUpperCase(),
        rfc3986Encode(options.url),
        rfc3986Encode(encodedParams),
    ].join('&');

    // 4. Create signing key. Secrets revealed only here, at the HMAC
    //    boundary; the rest of the function never touches plaintext.
    const signingKey = `${rfc3986Encode(options.consumerSecret.reveal())}&${rfc3986Encode(options.tokenSecret.reveal())}`;

    // 5. Calculate HMAC-SHA1 signature using Web crypto.subtle API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(signingKey);
    const messageData = encoder.encode(baseString);

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        {
            name: 'HMAC',
            hash: { name: 'SHA-1' },
        },
        false,
        ['sign'],
    );

    // Sign the message
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);

    // Convert the signature (ArrayBuffer) to base64
    const base64Signature = btoa(
        String.fromCharCode(...new Uint8Array(signature)),
    );
    return base64Signature;
}
