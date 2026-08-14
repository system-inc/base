// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { findJestConfig } from './TestCommand';

/**
 * findJestConfig walks up looking for the first jest config it sees.
 * The TestCommand uses this to explicitly point jest at a config —
 * without it, jest's own discovery sometimes stops at the wrong
 * package.json in monorepos. This test locks in the priority order
 * and walk-up behavior.
 */
describe('findJestConfig', () => {
    let tmpRoot: string;

    beforeEach(() => {
        tmpRoot = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-jestcfg-')),
        );
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('returns undefined when no config exists anywhere up to root', () => {
        // Walking up from a tmpdir, we eventually hit `/` without
        // finding any jest config. Returning undefined lets jest fall
        // back to its own discovery logic.
        const result = findJestConfig(tmpRoot);
        expect(result).toBeUndefined();
    });

    it('finds jest.config.js in startDir', () => {
        const configPath = path.join(tmpRoot, 'jest.config.js');
        fs.writeFileSync(configPath, 'module.exports = {};');

        expect(findJestConfig(tmpRoot)).toBe(configPath);
    });

    it('walks up from a nested dir', () => {
        const configPath = path.join(tmpRoot, 'jest.config.js');
        fs.writeFileSync(configPath, 'module.exports = {};');
        const nested = path.join(tmpRoot, 'a/b/c');
        fs.mkdirSync(nested, { recursive: true });

        expect(findJestConfig(nested)).toBe(configPath);
    });

    it('prefers .ts over .js when both exist at the same level', () => {
        // Priority: ts, js, mjs, cjs. .ts wins if present.
        fs.writeFileSync(
            path.join(tmpRoot, 'jest.config.ts'),
            'export default {};',
        );
        fs.writeFileSync(
            path.join(tmpRoot, 'jest.config.js'),
            'module.exports = {};',
        );

        expect(findJestConfig(tmpRoot)).toBe(
            path.join(tmpRoot, 'jest.config.ts'),
        );
    });

    it("stops at the nearest ancestor with a config (doesn't keep walking)", () => {
        // Outer has a config. Inner also has one. Walk should return
        // the inner one — the closest match wins.
        fs.writeFileSync(
            path.join(tmpRoot, 'jest.config.js'),
            'module.exports = { name: "outer" };',
        );
        const innerDir = path.join(tmpRoot, 'inner');
        fs.mkdirSync(innerDir);
        const innerConfig = path.join(innerDir, 'jest.config.js');
        fs.writeFileSync(innerConfig, 'module.exports = { name: "inner" };');

        expect(findJestConfig(innerDir)).toBe(innerConfig);
    });

    it('accepts .mjs and .cjs configs', () => {
        const configPath = path.join(tmpRoot, 'jest.config.mjs');
        fs.writeFileSync(configPath, 'export default {};');

        expect(findJestConfig(tmpRoot)).toBe(configPath);
    });
});
