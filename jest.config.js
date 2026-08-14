// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    verbose: true,
    // Build the CLI bin once before the run so cli-integration suites always
    // spawn the current dist/, never a stale bundle. See jest.globalSetup.js.
    globalSetup: './jest.globalSetup.js',
    setupFilesAfterEnv: ['./jest.setup.ts'],
    // Integration tests need framework setup (TEST_WORKER_NAME, TEST_HOST,
    // module-test discovery) and run via `base test`. Default jest runs
    // (`npm test`, `npx jest`) should stick to unit tests.
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '\\.integration\\.test\\.ts$',
    ],
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.test.json',
            },
        ],
    },
    moduleNameMapper: {
        '^@system-inc/base-common/(.*)$': '<rootDir>/packages/common/source/$1',
        '^@system-inc/base-foundation/(.*)$':
            '<rootDir>/packages/foundation/source/$1',
        '^@system-inc/base-client/(.*)$': '<rootDir>/packages/client/source/$1',
        '^@system-inc/base-cli/(.*)$': '<rootDir>/packages/cli/source/$1',
    },
};
