// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { validateAndExtractFileType } from './Headers';

describe('Headers', () => {
    describe('validateAndExtractFileType', () => {
        describe('valid file types', () => {
            it('should validate and return file info for image/jpeg', () => {
                const result = validateAndExtractFileType('image/jpeg', 1000, {
                    allowedContentType: ['image/jpeg'],
                });
                expect(result).toEqual({
                    fileExt: 'jpeg',
                    fileType: 'jpeg',
                });
            });

            it('should validate and return file info for application/json', () => {
                const result = validateAndExtractFileType(
                    'application/json',
                    500,
                    { allowedContentType: ['application/json'] },
                );
                expect(result).toEqual({
                    fileExt: 'json',
                    fileType: 'json',
                });
            });

            it('should validate and return file info for text/plain', () => {
                const result = validateAndExtractFileType('text/plain', 300, {
                    allowedContentType: ['text/plain'],
                });
                expect(result).toEqual({
                    fileExt: 'plain',
                    fileType: 'plain',
                });
            });

            it('should handle multiple allowed content types', () => {
                const result = validateAndExtractFileType('image/png', 1000, {
                    allowedContentType: [
                        'image/jpeg',
                        'image/png',
                        'image/webp',
                    ],
                });
                expect(result.fileExt).toBe('png');
            });
        });

        describe('content length validation', () => {
            it('should accept valid content length within default limits', () => {
                const result = validateAndExtractFileType(
                    'application/pdf',
                    1024 * 1024,
                    { allowedContentType: ['application/pdf'] },
                );
                expect(result.fileExt).toBe('pdf');
            });

            it('should accept content length at minimum boundary', () => {
                const result = validateAndExtractFileType('text/plain', 100, {
                    allowedContentType: ['text/plain'],
                });
                expect(result.fileExt).toBe('plain');
            });

            it('should accept content length at maximum boundary (default)', () => {
                const result = validateAndExtractFileType(
                    'application/pdf',
                    1024 * 1024 * 5,
                    { allowedContentType: ['application/pdf'] },
                );
                expect(result.fileExt).toBe('pdf');
            });

            it('should throw error for content length below minimum', () => {
                expect(() => {
                    validateAndExtractFileType('text/plain', 99, {
                        allowedContentType: ['text/plain'],
                    });
                }).toThrow();
            });

            it('should throw error for content length above default maximum', () => {
                const oversizeLimit = 1024 * 1024 * 5 + 1; // 5MB + 1
                expect(() => {
                    validateAndExtractFileType('text/plain', oversizeLimit, {
                        allowedContentType: ['text/plain'],
                    });
                }).toThrow();
            });

            it('should use custom file size limit when provided', () => {
                const customLimit = 1024 * 100; // 100KB
                const result = validateAndExtractFileType(
                    'text/plain',
                    customLimit,
                    {
                        allowedContentType: ['text/plain'],
                        fileSizeLimit: customLimit,
                    },
                );
                expect(result.fileExt).toBe('plain');
            });

            it('should throw error when exceeding custom file size limit', () => {
                const customLimit = 1024 * 100; // 100KB
                expect(() => {
                    validateAndExtractFileType('text/plain', customLimit + 1, {
                        allowedContentType: ['text/plain'],
                        fileSizeLimit: customLimit,
                    });
                }).toThrow();
            });
        });

        describe('content type validation', () => {
            it('should throw error for null content type', () => {
                expect(() => {
                    validateAndExtractFileType(null, 1000, {
                        allowedContentType: ['text/plain'],
                    });
                }).toThrow();
            });

            it('should throw error for empty content type', () => {
                expect(() => {
                    validateAndExtractFileType('', 1000, {
                        allowedContentType: ['text/plain'],
                    });
                }).toThrow();
            });

            it('should throw error for content type not in allowed list', () => {
                expect(() => {
                    validateAndExtractFileType('text/html', 1000, {
                        allowedContentType: ['text/plain'],
                    });
                }).toThrow();
            });

            it('should work without allowedContentType restriction', () => {
                const result = validateAndExtractFileType('text/css', 500);
                expect(result.fileExt).toBe('css');
            });

            it('should handle complex mime types', () => {
                const result = validateAndExtractFileType(
                    'application/vnd.ms-excel',
                    1000,
                    { allowedContentType: ['application/vnd.ms-excel'] },
                );
                expect(result.fileExt).toBe('vnd.ms-excel');
            });
        });

        describe('error messages', () => {
            it('should throw validation error for invalid file size', () => {
                try {
                    validateAndExtractFileType('text/plain', 50, {
                        allowedContentType: ['text/plain'],
                    });
                    fail('Expected error to be thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(Error);
                }
            });

            it('should include custom size limit in error message', () => {
                const customLimit = 1024 * 100;
                try {
                    validateAndExtractFileType('text/plain', customLimit + 1, {
                        allowedContentType: ['text/plain'],
                        fileSizeLimit: customLimit,
                    });
                    fail('Expected error to be thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(Error);
                }
            });
        });

        describe('options parameter', () => {
            it('should work without options parameter', () => {
                const result = validateAndExtractFileType(
                    'application/json',
                    1000,
                );
                expect(result.fileExt).toBe('json');
            });

            it('should work with only allowedContentType option', () => {
                const result = validateAndExtractFileType('text/csv', 300, {
                    allowedContentType: ['text/csv'],
                });
                expect(result).toEqual({
                    fileExt: 'csv',
                    fileType: 'csv',
                });
            });

            it('should work with both allowedContentType and fileSizeLimit options', () => {
                const customLimit = 1024 * 10; // 10KB
                const result = validateAndExtractFileType(
                    'application/xml',
                    customLimit,
                    {
                        allowedContentType: ['application/xml'],
                        fileSizeLimit: customLimit,
                    },
                );
                expect(result.fileExt).toBe('xml');
            });
        });
    });

    describe('integration scenarios', () => {
        it('should handle typical document upload validation', () => {
            const contentType = 'application/pdf';
            const contentLength = 1024 * 1024 * 2; // 2MB

            const result = validateAndExtractFileType(
                contentType,
                contentLength,
                { allowedContentType: [contentType] },
            );

            expect(result).toEqual({
                fileExt: 'pdf',
                fileType: 'pdf',
            });
        });

        it('should validate multiple file types in upload system', () => {
            const allowedTypes = [
                'image/jpeg',
                'image/png',
                'application/pdf',
                'text/plain',
            ];

            const testFiles = [
                { type: 'image/jpeg', size: 1000 },
                { type: 'image/png', size: 2000 },
                { type: 'application/pdf', size: 1024 * 1024 },
                { type: 'text/plain', size: 500 },
            ];

            testFiles.forEach((file) => {
                const result = validateAndExtractFileType(
                    file.type,
                    file.size,
                    { allowedContentType: allowedTypes },
                );
                expect(result.fileExt).toBeTruthy();
                expect(result.fileType).toBeTruthy();
            });
        });

        it('should enforce size limits consistently', () => {
            const fileSizeLimit = 1024 * 1024 * 3; // 3MB for files

            expect(() => {
                validateAndExtractFileType(
                    'application/pdf',
                    fileSizeLimit + 1,
                    {
                        allowedContentType: ['application/pdf'],
                        fileSizeLimit,
                    },
                );
            }).toThrow();
        });
    });

    describe('edge cases', () => {
        it('should handle content types with additional parameters', () => {
            const result = validateAndExtractFileType(
                'text/plain; charset=utf-8',
                500,
                { allowedContentType: ['text/plain; charset=utf-8'] },
            );
            expect(result.fileExt).toBe('plain; charset=utf-8');
        });

        it('should handle empty allowed content types array', () => {
            expect(() => {
                validateAndExtractFileType('text/plain', 500, {
                    allowedContentType: [],
                });
            }).toThrow();
        });

        it('should handle very small file sizes at boundary', () => {
            const result = validateAndExtractFileType('text/plain', 100, {
                allowedContentType: ['text/plain'],
            });
            expect(result.fileExt).toBe('plain');
        });

        it('should handle very large file sizes at boundary', () => {
            const maxSize = 1024 * 1024 * 5; // 5MB default
            const result = validateAndExtractFileType(
                'application/zip',
                maxSize,
                { allowedContentType: ['application/zip'] },
            );
            expect(result.fileExt).toBe('zip');
        });

        it('should handle case sensitivity in content types', () => {
            const result = validateAndExtractFileType('IMAGE/JPEG', 1000, {
                allowedContentType: ['IMAGE/JPEG'],
            });
            expect(result.fileExt).toBe('JPEG');
        });
    });
});
