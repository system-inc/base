// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ClientCategory } from './ClientCategory';
import { DeviceCategory } from './DeviceCategory';
import { parseUserAgent } from './UserAgentParser';

describe('UserAgentParser', () => {
    describe('parseUserAgent', () => {
        test('should handle null and empty user agents', () => {
            const nullResult = parseUserAgent(null);
            expect(nullResult).toEqual({
                clientCategory: ClientCategory.Unknown,
                deviceCategory: DeviceCategory.Unknown,
            });

            const emptyResult = parseUserAgent('');
            expect(emptyResult).toEqual({
                clientCategory: ClientCategory.Unknown,
                deviceCategory: DeviceCategory.Unknown,
            });
        });

        describe('Desktop Browsers', () => {
            test('should parse Chrome on Windows', () => {
                const ua =
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
                const result = parseUserAgent(ua);

                expect(result.clientCategory).toBe(ClientCategory.WebBrowser);
                expect(result.clientName).toBe('Chrome');
                expect(result.clientVersion).toBe('91.0.4472.124');
                expect(result.deviceCategory).toBe(DeviceCategory.Desktop);
                expect(result.osName).toBe('Windows');
                expect(result.osVersion).toBe('10.0');
            });

            test('should parse Firefox on Windows', () => {
                const ua =
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
                const result = parseUserAgent(ua);

                expect(result.clientCategory).toBe(ClientCategory.WebBrowser);
                expect(result.clientName).toBe('Firefox');
                expect(result.clientVersion).toBe('89.0');
                expect(result.deviceCategory).toBe(DeviceCategory.Desktop);
                expect(result.osName).toBe('Windows');
                expect(result.osVersion).toBe('10.0');
            });

            test('should parse Safari on macOS', () => {
                const ua =
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
                const result = parseUserAgent(ua);

                expect(result.clientCategory).toBe(ClientCategory.WebBrowser);
                expect(result.clientName).toBe('Safari');
                expect(result.clientVersion).toBe('14.1.1');
                expect(result.deviceCategory).toBe(DeviceCategory.Desktop);
                expect(result.osName).toBe('macOS');
                expect(result.osVersion).toBe('10.15.7');
            });

            test('should parse Edge on Windows (Chrome pattern matches first)', () => {
                const ua =
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edge/91.0';
                const result = parseUserAgent(ua);

                // Note: Chrome pattern matches first due to pattern order
                expect(result.clientCategory).toBe(ClientCategory.WebBrowser);
                expect(result.clientName).toBe('Chrome');
                expect(result.clientVersion).toBe('91.0.4472.124');
                expect(result.deviceCategory).toBe(DeviceCategory.Desktop);
                expect(result.osName).toBe('Windows');
                expect(result.osVersion).toBe('10.0');
            });

            test('should parse Opera on Windows (Chrome pattern matches first)', () => {
                const ua =
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 OPR/77.0.4054.203';
                const result = parseUserAgent(ua);

                // Note: Chrome pattern matches first due to pattern order
                expect(result.clientCategory).toBe(ClientCategory.WebBrowser);
                expect(result.clientName).toBe('Chrome');
                expect(result.clientVersion).toBe('91.0.4472.124');
                expect(result.deviceCategory).toBe(DeviceCategory.Desktop);
                expect(result.osName).toBe('Windows');
                expect(result.osVersion).toBe('10.0');
            });
        });

        describe('Mobile Devices', () => {
            test('should parse iPhone Safari (detected as app)', () => {
                const ua =
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1';
                const result = parseUserAgent(ua);

                // App regex matches "AppleWebKit/605.1.15" first
                expect(result.clientCategory).toBe(ClientCategory.App);
                expect(result.clientName).toBe('AppleWebKit');
                expect(result.clientVersion).toBe('605.1.15');
                expect(result.deviceCategory).toBe(DeviceCategory.Mobile);
                expect(result.osName).toBe('iOS');
                expect(result.osVersion).toBe('14.6');
            });

            test('should parse iPhone Chrome (CriOS)', () => {
                const ua =
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1';
                const result = parseUserAgent(ua);

                expect(result.clientCategory).toBe(ClientCategory.WebBrowser);
                expect(result.clientName).toBe('Chrome');
                expect(result.clientVersion).toBe('91.0.4472.80');
                expect(result.deviceCategory).toBe(DeviceCategory.Mobile);
                expect(result.osName).toBe('iOS');
                expect(result.osVersion).toBe('14.6');
            });

            test('should parse Android mobile Chrome', () => {
                const ua =
                    'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';
                const result = parseUserAgent(ua);

                expect(result.clientCategory).toBe(ClientCategory.WebBrowser);
                expect(result.clientName).toBe('Chrome');
                expect(result.clientVersion).toBe('91.0.4472.120');
                expect(result.deviceCategory).toBe(DeviceCategory.Mobile);
                expect(result.osName).toBe('Android');
                expect(result.osVersion).toBe('11');
            });

            test('should detect iPhone device category without browser match (detected as app)', () => {
                const ua =
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
                const result = parseUserAgent(ua);

                expect(result.deviceCategory).toBe(DeviceCategory.Mobile);
                expect(result.osName).toBe('iOS');
                expect(result.osVersion).toBe('14.6');
                // App regex matches "AppleWebKit/605.1.15"
                expect(result.clientCategory).toBe(ClientCategory.App);
                expect(result.clientName).toBe('AppleWebKit');
                expect(result.clientVersion).toBe('605.1.15');
            });
        });

        describe('Tablet Devices', () => {
            test('should parse iPad Safari (detected as app)', () => {
                const ua =
                    'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
                const result = parseUserAgent(ua);

                expect(result.deviceCategory).toBe(DeviceCategory.Tablet);
                // App regex matches "AppleWebKit/605.1.15" first
                expect(result.clientCategory).toBe(ClientCategory.App);
                expect(result.clientName).toBe('AppleWebKit');
                expect(result.clientVersion).toBe('605.1.15');
            });

            test('should parse Android tablet', () => {
                const ua =
                    'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36';
                const result = parseUserAgent(ua);

                expect(result.deviceCategory).toBe(DeviceCategory.Tablet);
                expect(result.clientCategory).toBe(ClientCategory.WebBrowser);
                expect(result.clientName).toBe('Chrome');
                expect(result.clientVersion).toBe('91.0.4472.120');
                expect(result.osName).toBe('Android');
                expect(result.osVersion).toBe('11');
            });

            test('should detect iPad device category without browser match (detected as app)', () => {
                const ua =
                    'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
                const result = parseUserAgent(ua);

                expect(result.deviceCategory).toBe(DeviceCategory.Tablet);
                // App regex matches "AppleWebKit/605.1.15"
                expect(result.clientCategory).toBe(ClientCategory.App);
                expect(result.clientName).toBe('AppleWebKit');
                expect(result.clientVersion).toBe('605.1.15');
            });
        });

        describe('Operating System Detection', () => {
            test('should parse various Windows versions', () => {
                const testCases = [
                    {
                        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        expected: '10.0',
                    },
                    {
                        ua: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)',
                        expected: '6.1',
                    },
                    {
                        ua: 'Mozilla/5.0 (Windows NT 6.3; Win64; x64)',
                        expected: '6.3',
                    },
                ];

                testCases.forEach(({ ua, expected }) => {
                    const result = parseUserAgent(ua);
                    expect(result.osName).toBe('Windows');
                    expect(result.osVersion).toBe(expected);
                    expect(result.deviceCategory).toBe(DeviceCategory.Desktop);
                });
            });

            test('should parse various macOS versions', () => {
                const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
                const result = parseUserAgent(ua);

                expect(result.osName).toBe('macOS');
                expect(result.osVersion).toBe('10.15.7');
                expect(result.deviceCategory).toBe(DeviceCategory.Desktop);
            });

            test('should parse iOS versions with underscore to dot conversion', () => {
                const ua =
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6_1 like Mac OS X)';
                const result = parseUserAgent(ua);

                expect(result.osName).toBe('iOS');
                expect(result.osVersion).toBe('14.6.1');
                expect(result.deviceCategory).toBe(DeviceCategory.Mobile);
            });

            test('should parse Android versions', () => {
                const ua = 'Mozilla/5.0 (Linux; Android 11.0; SM-G991B)';
                const result = parseUserAgent(ua);

                expect(result.osName).toBe('Android');
                expect(result.osVersion).toBe('11.0');
            });
        });

        describe('Custom Apps', () => {
            test('should parse custom app with version', () => {
                const ua = 'MyApp/1.2.3';
                const result = parseUserAgent(ua);

                expect(result.clientCategory).toBe(ClientCategory.App);
                expect(result.clientName).toBe('MyApp');
                expect(result.clientVersion).toBe('1.2.3');
                expect(result.deviceCategory).toBe(DeviceCategory.Unknown);
            });

            test('should parse multiple app patterns', () => {
                const testCases = [
                    {
                        ua: 'ConnectedApp/2.1.0',
                        name: 'ConnectedApp',
                        version: '2.1.0',
                    },
                    {
                        ua: 'TestClient/0.9.5',
                        name: 'TestClient',
                        version: '0.9.5',
                    },
                    {
                        ua: 'APIClient/10.0.1',
                        name: 'APIClient',
                        version: '10.0.1',
                    },
                ];

                testCases.forEach(({ ua, name, version }) => {
                    const result = parseUserAgent(ua);
                    expect(result.clientCategory).toBe(ClientCategory.App);
                    expect(result.clientName).toBe(name);
                    expect(result.clientVersion).toBe(version);
                });
            });

            test('should not match invalid app patterns', () => {
                const invalidCases = [
                    'App/',
                    '/1.0.0',
                    'App/abc',
                    'App/1.0',
                    'App 1.0.0',
                ];

                invalidCases.forEach((ua) => {
                    const result = parseUserAgent(ua);
                    expect(result.clientCategory).toBe(ClientCategory.Unknown);
                });
            });
        });

        describe('Browser Priority and Edge Cases', () => {
            test('should prioritize first matching browser pattern', () => {
                // This UA contains both Chrome and Safari patterns
                const ua =
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
                const result = parseUserAgent(ua);

                // Should match Chrome first since it appears first in the patterns array
                expect(result.clientName).toBe('Chrome');
                expect(result.clientVersion).toBe('91.0.4472.124');
            });

            test('should handle user agents with no matches', () => {
                const ua = 'UnknownClient/Unknown Version';
                const result = parseUserAgent(ua);

                expect(result.clientCategory).toBe(ClientCategory.Unknown);
                expect(result.clientName).toBeUndefined();
                expect(result.clientVersion).toBeUndefined();
                expect(result.deviceCategory).toBe(DeviceCategory.Unknown);
                expect(result.osName).toBeUndefined();
                expect(result.osVersion).toBeUndefined();
            });

            test('should handle malformed user agents', () => {
                const malformedCases = [
                    'Mozilla/5.0',
                    'Chrome/',
                    'iPhone',
                    'Android',
                    'Windows NT',
                ];

                malformedCases.forEach((ua) => {
                    const result = parseUserAgent(ua);
                    expect(result).toBeDefined();
                    expect(result.clientCategory).toBeDefined();
                    expect(result.deviceCategory).toBeDefined();
                });
            });
        });

        describe('Complex Real-World User Agents', () => {
            test('should parse Chrome on Android mobile correctly', () => {
                const ua =
                    'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Mobile Safari/537.36';
                const result = parseUserAgent(ua);

                expect(result.clientCategory).toBe(ClientCategory.WebBrowser);
                expect(result.clientName).toBe('Chrome');
                expect(result.clientVersion).toBe('100.0.4896.75');
                expect(result.deviceCategory).toBe(DeviceCategory.Mobile);
                expect(result.osName).toBe('Android');
                expect(result.osVersion).toBe('12');
            });

            test('should distinguish between Android mobile and tablet', () => {
                const mobileUA =
                    'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36';
                const tabletUA =
                    'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36';

                const mobileResult = parseUserAgent(mobileUA);
                const tabletResult = parseUserAgent(tabletUA);

                expect(mobileResult.deviceCategory).toBe(DeviceCategory.Mobile);
                expect(tabletResult.deviceCategory).toBe(DeviceCategory.Tablet);

                // Both should have same browser and OS info
                expect(mobileResult.clientName).toBe('Chrome');
                expect(tabletResult.clientName).toBe('Chrome');
                expect(mobileResult.osName).toBe('Android');
                expect(tabletResult.osName).toBe('Android');
            });
        });
    });
});
