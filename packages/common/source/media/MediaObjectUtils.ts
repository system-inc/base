// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { MediaObjectType } from './MediaObjectType';

export function mediaObjectTypeByExtension(ext: string): MediaObjectType {
    if (!ext) {
        return MediaObjectType.File;
    }

    const imageExtensions = new Set([
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.bmp',
        '.svg',
        '.webp',
        '.tiff',
    ]);

    const videoExtensions = new Set([
        '.mp4',
        '.avi',
        '.mov',
        '.wmv',
        '.flv',
        '.mkv',
        '.webm',
    ]);

    // Normalize: lowercase and ensure leading dot
    const normalizedExt = ext.toLowerCase().startsWith('.')
        ? ext.toLowerCase()
        : `.${ext.toLowerCase()}`;

    if (imageExtensions.has(normalizedExt)) {
        return MediaObjectType.Image;
    }

    if (videoExtensions.has(normalizedExt)) {
        return MediaObjectType.Video;
    }

    return MediaObjectType.File;
}
