// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yargs from 'yargs';

import {
    dirtyTreeDowngradesToWarning,
    findWorkspaceRoot,
    resolveWorkspaceCheckScripts,
} from './DeployGates';

/**
 * Workspace-root resolution decides WHERE the deploy gate runs the
 * workspace's typecheck/lint/test scripts. Resolving to the wrong
 * package.json (e.g. an intermediate workspace member) silently skips
 * the gate — pin the walk-up rules.
 */

describe('findWorkspaceRoot', () => {
    let root: string;

    beforeEach(() => {
        root = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-gates-')),
        );
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function makePackageJson(folder: string, content: object): void {
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(
            path.join(folder, 'package.json'),
            JSON.stringify(content),
        );
    }

    it('prefers the package.json declaring a `base` config over a nearer one', () => {
        // Mirrors this repo: root has `base.workersFolder`, but the
        // workersFolder itself (examples/) has its own plain package.json.
        makePackageJson(root, { base: { workersFolder: './examples' } });
        makePackageJson(path.join(root, 'examples'), { name: 'examples' });

        expect(findWorkspaceRoot(path.join(root, 'examples'))).toBe(root);
    });

    it('falls back to the nearest package.json when none declares `base`', () => {
        makePackageJson(path.join(root, 'workers'), { name: 'workers' });

        expect(findWorkspaceRoot(path.join(root, 'workers'))).toBe(
            path.join(root, 'workers'),
        );
    });

    it('returns the start folder itself when it declares `base`', () => {
        makePackageJson(root, { base: {} });
        expect(findWorkspaceRoot(root)).toBe(root);
    });

    it('returns undefined when no package.json exists on the walk', () => {
        const deep = path.join(root, 'a', 'b');
        fs.mkdirSync(deep, { recursive: true });
        // The walk continues above the tmp dir; os.tmpdir() ancestry has no
        // package.json, so this exercises the not-found path end to end.
        expect(findWorkspaceRoot(deep)).toBeUndefined();
    });

    it('skips an unparseable package.json and keeps walking', () => {
        makePackageJson(root, { base: {} });
        const workers = path.join(root, 'workers');
        fs.mkdirSync(workers, { recursive: true });
        fs.writeFileSync(path.join(workers, 'package.json'), '{not json');

        expect(findWorkspaceRoot(workers)).toBe(root);
    });
});

/**
 * The dirty-tree gate refuses ONLY for Production — its point is a
 * reproducible COMMIT_SHA for incident forensics. Iteration environments
 * (Development and custom ones like Test/Integration) warn and mark the
 * SHA '-dirty' instead. Getting this backwards either blocks everyday
 * iteration or lets unreproducible code ship to Production.
 */
describe('dirtyTreeDowngradesToWarning', () => {
    const args = (extra: object = {}): yargs.Arguments =>
        ({ _: [], $0: 'base', ...extra }) as yargs.Arguments;

    it('refuses for Production without a bypass flag', () => {
        expect(dirtyTreeDowngradesToWarning(args(), 'Production')).toBe(false);
    });

    it('warns for Development', () => {
        expect(dirtyTreeDowngradesToWarning(args(), 'Development')).toBe(true);
    });

    it('warns for custom environments (Test, Integration, Staging)', () => {
        for (const environment of ['Test', 'Integration', 'Staging']) {
            expect(dirtyTreeDowngradesToWarning(args(), environment)).toBe(
                true,
            );
        }
    });

    it('--allow-dirty downgrades Production to a warning', () => {
        expect(
            dirtyTreeDowngradesToWarning(
                args({ allowDirty: true }),
                'Production',
            ),
        ).toBe(true);
    });

    it('--force downgrades Production to a warning', () => {
        expect(
            dirtyTreeDowngradesToWarning(args({ force: true }), 'Production'),
        ).toBe(true);
    });
});

describe('resolveWorkspaceCheckScripts', () => {
    it('splits declared and undeclared check scripts', () => {
        expect(
            resolveWorkspaceCheckScripts({
                typecheck: 'tsc --noEmit',
                lint: 'eslint .',
                build: 'tsc -b',
            }),
        ).toEqual({
            present: ['typecheck', 'lint'],
            missing: ['test'],
        });
    });

    it('reports everything missing when scripts are absent', () => {
        expect(resolveWorkspaceCheckScripts(undefined)).toEqual({
            present: [],
            missing: ['typecheck', 'lint', 'test'],
        });
    });

    it('keeps fail-fast order (typecheck before lint before test)', () => {
        expect(
            resolveWorkspaceCheckScripts({
                test: 'jest',
                lint: 'eslint .',
                typecheck: 'tsc --noEmit',
            }).present,
        ).toEqual(['typecheck', 'lint', 'test']);
    });
});
