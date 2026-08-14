// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { isMediaTypeJson, isMediaTypeText } from './MediaType';

describe('isMediaTypeJson', () => {
    it('matches a bare application/json', () => {
        expect(isMediaTypeJson('application/json')).toBe(true);
    });

    it('matches application/json with parameters', () => {
        // a real Content-Type header often includes a charset
        expect(isMediaTypeJson('application/json; charset=utf-8')).toBe(true);
        expect(isMediaTypeJson('application/json;charset=UTF-8')).toBe(true);
    });

    it('is case-insensitive and tolerates surrounding whitespace', () => {
        expect(isMediaTypeJson('APPLICATION/JSON')).toBe(true);
        expect(isMediaTypeJson('  application/json  ')).toBe(true);
    });

    it('does not match other media types', () => {
        expect(isMediaTypeJson('text/plain')).toBe(false);
        expect(isMediaTypeJson('application/xml')).toBe(false);
        // a distinct type that merely starts the same
        expect(isMediaTypeJson('application/json-patch+json')).toBe(false);
    });
});

describe('isMediaTypeText', () => {
    it('matches any text/* type', () => {
        expect(isMediaTypeText('text/plain')).toBe(true);
        expect(isMediaTypeText('text/html')).toBe(true);
    });

    it('does not match non-text types', () => {
        expect(isMediaTypeText('application/json')).toBe(false);
    });
});
