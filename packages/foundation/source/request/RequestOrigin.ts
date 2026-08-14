// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HTTP_HEADER_ACCEPT_LANGUAGE } from '@system-inc/base-common/http/HttpHeaders';
import { LocaleOptions } from '@system-inc/base-common/locale/LocaleOptions';
import { CloudflarePlatformDelegate } from '../internal/cloudflare/CloudflarePlatformDelegate';
import { BaseWorkerPlatformDelegate } from '../worker/BaseWorkerPlatformDelegate';

export class RequestOrigin {
    readonly acceptLanguageHeader: string | undefined;
    readonly languagePreferences: ReadonlyArray<LanguagePreference>;
    readonly timeZone: string | undefined;
    readonly city: string | undefined;
    readonly region: string | undefined;
    readonly country: string | undefined;
    readonly latitude: string | undefined;
    readonly longitude: string | undefined;

    constructor(
        request: Request,
        platformDelegate: BaseWorkerPlatformDelegate,
    ) {
        this.acceptLanguageHeader =
            request.headers.get(HTTP_HEADER_ACCEPT_LANGUAGE) ?? undefined;

        if (this.acceptLanguageHeader) {
            this.languagePreferences = parseAcceptLanguage(
                this.acceptLanguageHeader,
            );
        } else {
            this.languagePreferences = [];
        }

        if (platformDelegate instanceof CloudflarePlatformDelegate) {
            const cfRequestProperties =
                platformDelegate.getPlatformRequestProperties(request);
            if (cfRequestProperties) {
                this.timeZone = cfRequestProperties.timezone;
                this.city = cfRequestProperties.city;
                this.region = cfRequestProperties.region;
                this.country = cfRequestProperties.country;
                this.latitude = cfRequestProperties.latitude;
                this.longitude = cfRequestProperties.longitude;
            }
        }
    }

    get preferredLanguage(): string | undefined {
        return this.languagePreferences[0]?.language;
    }

    get locale(): LocaleOptions {
        return {
            languageCode: this.preferredLanguage,
            timezone: this.timeZone,
        };
    }

    get location(): string {
        let location = 'Unknown';
        if (this.city && this.region && this.country) {
            location = `${this.city}, ${this.region}, ${this.country}`;
        } else if (this.region && this.country) {
            location = `${this.region}, ${this.country}`;
        } else if (this.country) {
            location = this.country;
        }
        return location;
    }
}

type LanguagePreference = {
    language: string;
    quality: number;
};

function parseAcceptLanguage(header: string): LanguagePreference[] {
    // Split the header into individual language tags and parameters
    const languageTags = header.split(',').map((tag) => tag.trim());

    const preferences: LanguagePreference[] = languageTags.map((tag) => {
        // Split the tag into language and quality value
        const [language, quality] = tag.split(';').map((part) => part.trim());
        const qualityValue = quality ? parseQualityValue(quality) : 1.0;

        return {
            language,
            quality: qualityValue,
        };
    });

    // Sort by quality in descending order (higher quality preferred)
    preferences.sort((a, b) => b.quality - a.quality);

    return preferences;
}

function parseQualityValue(quality: string): number {
    const match = quality.match(/^q=([0-9.]+)$/);
    return match ? parseFloat(match[1]) : 1.0;
}
