// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ArgumentValidationError } from '../error/ArgumentValidationError';

const FileSizeLimit = 1024 * 1024 * 5; // 5 MB

/**
 * Validates the contentType headers and returns the file extension.
 *
 * @param contentType
 * @param contentLength
 * @param options
 * @returns
 */
export function validateAndExtractFileType(
    contentType: string | null,
    contentLength: number,
    options?: {
        // mime string array
        allowedContentType?: string[];
        fileSizeLimit?: number;
        disallowedFileTypes?: string[];
    },
): {
    fileExt: string;
    fileType: string;
} {
    // check the contentType
    if (
        !contentType ||
        (options?.allowedContentType &&
            !options.allowedContentType.includes(contentType))
    ) {
        throw new ArgumentValidationError({
            path: 'contentType',
            constraints: {
                isValid: 'contentType is not supported!',
            },
        });
    }
    // make sure the file is not too big or too small
    if (
        contentLength < 100 ||
        contentLength > (options?.fileSizeLimit ?? FileSizeLimit)
    ) {
        throw new ArgumentValidationError({
            path: 'contentLength',
            constraints: {
                isValid: `File size must be between 100 and ${
                    options?.fileSizeLimit ?? FileSizeLimit
                } bytes`,
            },
        });
    }
    // make sure the file is in a supported format
    const mimeTypeExt = contentType.split('/')[1];
    if (
        options?.disallowedFileTypes &&
        options.disallowedFileTypes.includes(mimeTypeExt)
    ) {
        throw new ArgumentValidationError({
            path: 'fileType',
            constraints: {
                isValid: `File type ${mimeTypeExt} is not allowed`,
            },
        });
    }

    return {
        fileExt: mimeTypeExt,
        fileType: mimeTypeExt,
    };
}
