// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ClientCategory } from './ClientCategory';
import { DeviceCategory } from './DeviceCategory';

export interface UserAgentInfo {
    clientCategory: ClientCategory;
    clientName?: string;
    clientVersion?: string;
    deviceCategory: DeviceCategory;
    osName?: string;
    osVersion?: string;
}

export function parseUserAgent(userAgent: string | null): UserAgentInfo {
    // Default values
    const info: UserAgentInfo = {
        clientCategory: ClientCategory.Unknown,
        deviceCategory: DeviceCategory.Unknown,
    };
    if (!userAgent) {
        return info;
    }

    // Device Type and Model Detection
    if (/iPhone/.test(userAgent)) {
        info.deviceCategory = DeviceCategory.Mobile;
    } else if (/iPad/.test(userAgent)) {
        info.deviceCategory = DeviceCategory.Tablet;
    } else if (/Android/.test(userAgent) && !/Mobile/.test(userAgent)) {
        info.deviceCategory = DeviceCategory.Tablet;
        // Model extraction for Android tablets can be complex and is not covered here
    } else if (/Android/.test(userAgent) && /Mobile/.test(userAgent)) {
        info.deviceCategory = DeviceCategory.Mobile;
        // Model extraction for Android phones can be complex and is not covered here
    } else if (/Macintosh/.test(userAgent)) {
        info.deviceCategory = DeviceCategory.Desktop;
        // Distinguishing between MacBook and Desktop Mac requires more specific heuristics
    } else if (/Windows NT/.test(userAgent)) {
        info.deviceCategory = DeviceCategory.Desktop;
        // Could be a laptop, but specific detection is not feasible through User-Agent alone
    }

    // Patterns for detecting operating system and version
    const osPatterns = [
        { name: 'Windows', pattern: /Windows NT ([0-9._]+)/ },
        { name: 'macOS', pattern: /Mac OS X ([0-9._]+)/ },
        { name: 'iOS', pattern: /iPhone OS ([0-9_]+)/ },
        { name: 'Android', pattern: /Android ([0-9.]+)/ },
        // Add more OS patterns as necessary
    ];
    // Attempt to identify the OS and version
    for (const os of osPatterns) {
        const match = userAgent.match(os.pattern);
        if (match) {
            info.osName = os.name;
            info.osVersion = match[1].replace(/_/g, '.'); // Replace underscores with dots for iOS version
            break; // Stop once we match an OS
        }
    }

    // Define patterns for known web browsers and their version formats
    const browserPatterns = [
        { name: 'Chrome', pattern: 'Chrome/(\\d+\\.\\d+\\.\\d+\\.\\d+)' },
        { name: 'Safari', pattern: 'Version/(\\d+\\.\\d+\\.\\d+).+Safari/' },
        { name: 'Firefox', pattern: 'Firefox/(\\d+\\.\\d+)' },
        { name: 'Edge', pattern: 'Edge/(\\d+\\.\\d+)' },
        // Add mobile browsers as needed
        { name: 'Opera', pattern: 'OPR/(\\d+\\.\\d+\\.\\d+\\.\\d+)' },
        {
            name: 'Chrome',
            pattern: 'CriOS/(\\d+\\.\\d+\\.\\d+\\.\\d+)',
            type: 'Web Browser',
        },
        {
            name: 'Safari',
            pattern: 'Version/(\\d+\\.\\d+\\.\\d+) Mobile/\\S+ Safari',
            type: 'Web Browser',
        },
        // Add more browsers as needed
    ];

    // Attempt to identify the browser and version
    for (const { name, pattern } of browserPatterns) {
        const regex = new RegExp(pattern);
        const match = userAgent.match(regex);
        if (match) {
            info.clientCategory = ClientCategory.WebBrowser;
            info.clientName = name;
            info.clientVersion = match[1];
            return info; // Return as soon as we identify the browser
        }
    }

    // Fallback for other types of clients
    // If userAgent does not match known browsers, you might consider it an app
    // This part can be customized based on known patterns for your apps
    // Example: CustomApp/1.0.0
    const appRegex = /(\w+)\/(\d+\.\d+\.\d+)/;
    const appMatch = userAgent.match(appRegex);
    if (appMatch) {
        info.clientCategory = ClientCategory.App;
        info.clientName = appMatch[1];
        info.clientVersion = appMatch[2];
    }

    return info;
}
