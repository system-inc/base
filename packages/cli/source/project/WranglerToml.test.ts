// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';

import type { BaseWorkerProject } from './BaseWorkerProject';
import { WranglerToml } from './WranglerToml';

jest.mock('fs');

const readFileSync = fs.readFileSync as jest.Mock;

describe('WranglerToml.parse', () => {
    const project = {
        wranglerConfigFile: '/workers/example/wrangler.toml',
    } as BaseWorkerProject;

    afterEach(() => {
        jest.restoreAllMocks();
        readFileSync.mockReset();
    });

    it('parses the wrangler config file contents', () => {
        readFileSync.mockReturnValue(
            'main = "index.ts"\ncompatibility_date = "2024-01-01"',
        );
        const result = WranglerToml.parse(project);
        expect(result.main).toBe('index.ts');
        expect(result.compatibility_date).toBe('2024-01-01');
    });

    it('reports the config path on failure instead of a ReferenceError', () => {
        readFileSync.mockImplementation(() => {
            throw new Error('boom');
        });
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
            throw new Error('process.exit called');
        }) as never);

        // Before the fix the catch referenced an undefined `location`,
        // throwing a ReferenceError before ever logging or exiting.
        expect(() => WranglerToml.parse(project)).toThrow(
            'process.exit called',
        );
        expect(errorSpy).toHaveBeenCalledWith(
            'Unable to parse wrangler.toml at:',
            '/workers/example/wrangler.toml',
            'Error:',
            expect.any(Error),
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
