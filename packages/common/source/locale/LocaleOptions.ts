// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { StrictJsonInterface } from '../json/StrictJson';

export type LocaleOptions = StrictJsonInterface<{
    /**
     * The language locale to use for formatting displayed values.
     * This should be a IETF BCP 47 language tag: ISO 639 (language) + ISO 3166-1 (region)
     * example: 'en-US', 'fr-FR', 'es-ES'
     */
    languageCode?: string;

    /**
     * The timezone to use for formatting displayed values.
     * This should be a IANA timezone name.
     * example: 'America/New_York', 'Europe/London', 'Asia/Tokyo'
     */
    timezone?: string;
}>;
