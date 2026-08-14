// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { fileIsImage } from './IsImage';

describe('File Utilities', () => {
    describe('fileIsImage', () => {
        test('should return true for common image extensions', () => {
            expect(fileIsImage('jpg')).toBe(true);
            expect(fileIsImage('jpeg')).toBe(true);
            expect(fileIsImage('png')).toBe(true);
            expect(fileIsImage('gif')).toBe(true);
            expect(fileIsImage('bmp')).toBe(true);
            expect(fileIsImage('svg')).toBe(true);
            expect(fileIsImage('tiff')).toBe(true);
            expect(fileIsImage('webp')).toBe(true);
        });

        test('should return true for uppercase extensions', () => {
            expect(fileIsImage('JPG')).toBe(true);
            expect(fileIsImage('JPEG')).toBe(true);
            expect(fileIsImage('PNG')).toBe(true);
            expect(fileIsImage('GIF')).toBe(true);
            expect(fileIsImage('BMP')).toBe(true);
            expect(fileIsImage('SVG')).toBe(true);
            expect(fileIsImage('TIFF')).toBe(true);
            expect(fileIsImage('WEBP')).toBe(true);
        });

        test('should return true for mixed case extensions', () => {
            expect(fileIsImage('Jpg')).toBe(true);
            expect(fileIsImage('JpEg')).toBe(true);
            expect(fileIsImage('PnG')).toBe(true);
            expect(fileIsImage('GiF')).toBe(true);
            expect(fileIsImage('BmP')).toBe(true);
            expect(fileIsImage('SvG')).toBe(true);
            expect(fileIsImage('TiFf')).toBe(true);
            expect(fileIsImage('WebP')).toBe(true);
        });

        test('should return true for extensions with leading/trailing whitespace', () => {
            expect(fileIsImage(' jpg ')).toBe(true);
            expect(fileIsImage(' jpeg ')).toBe(true);
            expect(fileIsImage('\tpng\t')).toBe(true);
            expect(fileIsImage('\ngif\n')).toBe(true);
            expect(fileIsImage('  bmp  ')).toBe(true);
            expect(fileIsImage('   svg   ')).toBe(true);
        });

        test('should return false for non-image extensions', () => {
            expect(fileIsImage('txt')).toBe(false);
            expect(fileIsImage('doc')).toBe(false);
            expect(fileIsImage('docx')).toBe(false);
            expect(fileIsImage('pdf')).toBe(false);
            expect(fileIsImage('mp4')).toBe(false);
            expect(fileIsImage('mp3')).toBe(false);
            expect(fileIsImage('avi')).toBe(false);
            expect(fileIsImage('mov')).toBe(false);
            expect(fileIsImage('zip')).toBe(false);
            expect(fileIsImage('exe')).toBe(false);
        });

        test('should return false for programming file extensions', () => {
            expect(fileIsImage('js')).toBe(false);
            expect(fileIsImage('ts')).toBe(false);
            expect(fileIsImage('html')).toBe(false);
            expect(fileIsImage('css')).toBe(false);
            expect(fileIsImage('json')).toBe(false);
            expect(fileIsImage('xml')).toBe(false);
            expect(fileIsImage('py')).toBe(false);
            expect(fileIsImage('java')).toBe(false);
            expect(fileIsImage('cpp')).toBe(false);
        });

        test('should return false for undefined extension', () => {
            expect(fileIsImage(undefined)).toBe(false);
        });

        test('should return false for empty string extension', () => {
            expect(fileIsImage('')).toBe(false);
        });

        test('should return false for whitespace-only extension', () => {
            expect(fileIsImage(' ')).toBe(false);
            expect(fileIsImage('   ')).toBe(false);
            expect(fileIsImage('\t')).toBe(false);
            expect(fileIsImage('\n')).toBe(false);
            expect(fileIsImage('\r')).toBe(false);
        });

        test('should return false for extensions with dots', () => {
            expect(fileIsImage('.jpg')).toBe(false);
            expect(fileIsImage('jpg.')).toBe(false);
            expect(fileIsImage('.png.')).toBe(false);
        });

        test('should return false for partial matches', () => {
            expect(fileIsImage('jp')).toBe(false);
            expect(fileIsImage('pn')).toBe(false);
            expect(fileIsImage('gi')).toBe(false);
            expect(fileIsImage('jpgg')).toBe(false);
            expect(fileIsImage('pngg')).toBe(false);
            expect(fileIsImage('giff')).toBe(false);
        });

        test('should return false for extensions that contain image extensions', () => {
            expect(fileIsImage('jpgx')).toBe(false);
            expect(fileIsImage('xjpg')).toBe(false);
            expect(fileIsImage('pngfile')).toBe(false);
            expect(fileIsImage('mypng')).toBe(false);
            expect(fileIsImage('gif123')).toBe(false);
            expect(fileIsImage('123gif')).toBe(false);
        });

        test('should return false for numeric extensions', () => {
            expect(fileIsImage('123')).toBe(false);
            expect(fileIsImage('456')).toBe(false);
            expect(fileIsImage('000')).toBe(false);
        });

        test('should return false for special character extensions', () => {
            expect(fileIsImage('!@#')).toBe(false);
            expect(fileIsImage('$%^')).toBe(false);
            expect(fileIsImage('&*()')).toBe(false);
            expect(fileIsImage('+-=')).toBe(false);
        });

        test('should handle edge case extensions', () => {
            expect(fileIsImage('ico')).toBe(false);
            expect(fileIsImage('psd')).toBe(false);
            expect(fileIsImage('raw')).toBe(false);
            expect(fileIsImage('cr2')).toBe(false);
            expect(fileIsImage('nef')).toBe(false);
        });

        test('should be case insensitive for all supported extensions', () => {
            const supportedExtensions = [
                'jpg',
                'jpeg',
                'png',
                'gif',
                'bmp',
                'svg',
                'tiff',
                'webp',
            ];

            supportedExtensions.forEach((ext) => {
                expect(fileIsImage(ext.toLowerCase())).toBe(true);
                expect(fileIsImage(ext.toUpperCase())).toBe(true);
            });
        });
    });
});
