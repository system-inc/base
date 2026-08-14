// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export const MEDIA_TYPE_APPLICATION_JSON = 'application/json';
export const MEDIA_TYPE_APPLICATION_OCTET_STREAM = 'application/octet-stream';
export const MEDIA_TYPE_APPLICATION_FORM_URL_ENCODED =
    'application/x-www-form-urlencoded';
export const MEDIA_TYPE_APPLICATION_XML = 'application/xml';
export const MEDIA_TYPE_APPLICATION_PDF = 'application/pdf';
export const MEDIA_TYPE_APPLICATION_ZIP = 'application/zip';
export const MEDIA_TYPE_APPLICATION_GRAPHQL = 'application/graphql';
export const MEDIA_TYPE_APPLICATION_JAVASCRIPT = 'application/javascript';

export const MEDIA_TYPE_TEXT_PLAIN = 'text/plain';
export const MEDIA_TYPE_TEXT_HTML = 'text/html';
export const MEDIA_TYPE_TEXT_CSS = 'text/css';
export const MEDIA_TYPE_TEXT_JAVASCRIPT = 'text/javascript';

export const MEDIA_TYPE_IMAGE_PNG = 'image/png';
export const MEDIA_TYPE_IMAGE_JPEG = 'image/jpeg';
export const MEDIA_TYPE_IMAGE_GIF = 'image/gif';
export const MEDIA_TYPE_IMAGE_SVG_XML = 'image/svg+xml';

export const MEDIA_TYPE_MULTIPART_FORM_DATA = 'multipart/form-data';
export const MEDIA_TYPE_MULTIPART_MIXED = 'multipart/mixed';

export function isMediaTypeJson(mediaType: string): boolean {
    // A Content-Type header may carry parameters (e.g.
    // `application/json; charset=utf-8`); compare only the media type,
    // dropping anything after the first `;`.
    const essence = mediaType.split(';', 1)[0].trim().toLocaleLowerCase();
    return essence === MEDIA_TYPE_APPLICATION_JSON;
}

export function isMediaTypeText(mediaType: string): boolean {
    return mediaType.toLocaleLowerCase().startsWith('text/');
}
