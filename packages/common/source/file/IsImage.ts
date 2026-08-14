// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Checks if the given file extension is an image type.
 *
 * @param extension
 * @returns
 */
export function fileIsImage(extension?: string): boolean {
    if (!extension) {
        return false;
    }
    const imageExtensions = [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'bmp',
        'svg',
        'tiff',
        'webp',
    ];
    return imageExtensions.includes(extension.trim().toLowerCase());
}
