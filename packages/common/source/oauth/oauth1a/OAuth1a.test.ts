// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as nonce from '../../cryptography/NonceGeneration';
import { Secret } from '../../secret/Secret';
import { generateOAuth1aHeader, generateOauth1aSignature } from './OAuth1a';

// Mock Date.now() to return consistent timestamp
const originalDateNow = Date.now;

describe('OAuth1.0a', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    afterEach(() => {
        global.Date.now = originalDateNow;
        jest.clearAllMocks();
    });

    describe('generateOAuthHeader', () => {
        // Example from OAuth 1.0a spec Appendix A https://oauth.net/core/1.0a/#anchor41
        it('should generate correct OAuth header for protected photo resource', async () => {
            // Set timestamp for photos example
            global.Date.now = jest.fn(() => 1191242096000);

            // Mock nonce for photos example
            jest.spyOn(nonce, 'generateNonce').mockImplementation(
                () => 'kllo9940pd9333jh',
            );

            const options = {
                consumerKey: 'dpf43f3p2l4k3l03',
                consumerSecret: new Secret('kd94hf93k423kf44'),
                token: 'nnch734d00sl2jdk',
                tokenSecret: new Secret('pfkkdhi9sl3r4s00'),
                method: 'GET',
                url: 'http://photos.example.net/photos',
                parameters: {
                    file: 'vacation.jpg',
                    size: 'original',
                },
            };

            const header = await generateOAuth1aHeader(options);

            // Verify the complete OAuth header as shown in spec A.5.3
            const expectedHeader =
                'OAuth ' +
                'oauth_consumer_key="dpf43f3p2l4k3l03",' +
                'oauth_nonce="kllo9940pd9333jh",' +
                'oauth_signature="tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D",' +
                'oauth_signature_method="HMAC-SHA1",' +
                'oauth_timestamp="1191242096",' +
                'oauth_token="nnch734d00sl2jdk",' +
                'oauth_version="1.0"';

            expect(header).toBe(expectedHeader);
        });
    });

    describe('generateOauth1aSignature', () => {
        // Twitter's documented RFC 5849 example inputs. The status text
        // contains "!", a space and "+" which exercise RFC-3986 encoding: the
        // base string must encode "!" as %21, so the buggy encodeURIComponent
        // path (which leaves "!" literal) produces a different signature. The
        // expected value is HMAC-SHA1 of the correct base string with the
        // documented signing key, cross-checked against Node's crypto.
        it('matches the RFC-3986 reference signature', async () => {
            const signature = await generateOauth1aSignature({
                method: 'POST',
                url: 'https://api.twitter.com/1.1/statuses/update.json',
                parameters: {
                    status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
                    include_entities: 'true',
                    oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
                    oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
                    oauth_signature_method: 'HMAC-SHA1',
                    oauth_timestamp: '1318622958',
                    oauth_token:
                        '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
                    oauth_version: '1.0',
                },
                consumerSecret: new Secret(
                    'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Y7uy',
                ),
                tokenSecret: new Secret(
                    'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
                ),
            });

            expect(signature).toBe('1H+0Q2yAyxS1Bg9KjquP/SQAbNM=');
        });
    });
});
