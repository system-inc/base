// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    readWorkersFolderFromPackageJson,
    resolvePersistTo,
    resolveWorkersScope,
} from './BaseWorkerProject';

/**
 * `resolveWorkersScope` reads CWD via `userCwd()`, which prefers
 * `INIT_CWD`. Driving the test through `INIT_CWD` lets us simulate
 * "where the user was standing" without touching the real `process.cwd()`.
 */

describe('resolveWorkersScope', () => {
    let tmpRoot: string;
    let originalInitCwd: string | undefined;

    beforeEach(() => {
        // os.tmpdir() returns /var/... on macOS but the real path is
        // /private/var/... — symlink resolution matters for assertions
        // like `expect(scope.workersFolder).toBe(path.dirname(workerDir))`.
        tmpRoot = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-test-')),
        );
        originalInitCwd = process.env.INIT_CWD;
    });

    afterEach(() => {
        if (originalInitCwd === undefined) {
            delete process.env.INIT_CWD;
        } else {
            process.env.INIT_CWD = originalInitCwd;
        }
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    function setCwd(dir: string): void {
        process.env.INIT_CWD = dir;
    }

    function mkWorker(parent: string, name: string): string {
        const dir = path.join(parent, name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'settings.ts'), '// fixture');
        return dir;
    }

    function writePackageJson(dir: string, body: unknown): void {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify(body, null, 2),
        );
    }

    describe('Branch 1: --workersFolder CLI flag wins', () => {
        it('resolves a relative cliFlag against the CWD', () => {
            const examples = path.join(tmpRoot, 'examples');
            fs.mkdirSync(examples);
            setCwd(tmpRoot);

            const scope = resolveWorkersScope('./examples', 'foo');

            expect(scope.workersFolder).toBe(examples);
            expect(scope.worker).toBe('foo');
        });

        it('keeps an absolute cliFlag as-is', () => {
            const elsewhere = fs.realpathSync(
                fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-elsewhere-')),
            );
            setCwd(tmpRoot);

            const scope = resolveWorkersScope(elsewhere, 'foo');

            expect(scope.workersFolder).toBe(elsewhere);
            fs.rmSync(elsewhere, { recursive: true, force: true });
        });

        it('infers the worker from CWD when cliFlag is set and CWD is a worker', () => {
            // Realistic case: `cd examples/test-worker && base test --workersFolder ../other`
            const workerDir = mkWorker(tmpRoot, 'test-worker');
            setCwd(workerDir);

            const scope = resolveWorkersScope('./other', undefined);

            expect(scope.workersFolder).toBe(path.join(workerDir, 'other'));
            expect(scope.worker).toBe('test-worker');
        });

        it('leaves worker undefined when cliFlag is set, cliWorker is not, and CWD is not a worker', () => {
            setCwd(tmpRoot);

            const scope = resolveWorkersScope('./examples', undefined);

            expect(scope.worker).toBeUndefined();
        });
    });

    describe('Branch 2: CWD is a worker beats project-level config', () => {
        it('uses parent(CWD) and basename(CWD) when CWD has settings.ts', () => {
            const workersFolder = path.join(tmpRoot, 'workers');
            const workerDir = mkWorker(workersFolder, 'foo');
            setCwd(workerDir);

            const scope = resolveWorkersScope(undefined, undefined);

            expect(scope.workersFolder).toBe(workersFolder);
            expect(scope.worker).toBe('foo');
        });

        it('lets cliWorker override the basename inference', () => {
            const workerDir = mkWorker(tmpRoot, 'foo');
            setCwd(workerDir);

            const scope = resolveWorkersScope(undefined, 'bar');

            expect(scope.workersFolder).toBe(tmpRoot);
            expect(scope.worker).toBe('bar');
        });

        it('wins over a package.json that points elsewhere', () => {
            // Project root says workers live in ./examples, but user has
            // `cd workers/foo` — sitting inside a real worker. The CWD
            // signal wins.
            const workersFolder = path.join(tmpRoot, 'workers');
            const workerDir = mkWorker(workersFolder, 'foo');
            writePackageJson(tmpRoot, {
                name: 'project',
                base: { workersFolder: './examples' },
            });
            setCwd(workerDir);

            const scope = resolveWorkersScope(undefined, undefined);

            expect(scope.workersFolder).toBe(workersFolder);
            expect(scope.worker).toBe('foo');
        });
    });

    describe('Branch 3: package.json base.workersFolder walked from CWD', () => {
        it('resolves the configured folder relative to the package root', () => {
            // package.json sits at tmpRoot; relative path resolves there.
            writePackageJson(tmpRoot, {
                name: 'project',
                base: { workersFolder: './examples' },
            });
            const examplesDir = path.join(tmpRoot, 'examples');
            fs.mkdirSync(examplesDir);
            setCwd(tmpRoot);

            const scope = resolveWorkersScope(undefined, undefined);

            expect(scope.workersFolder).toBe(examplesDir);
            expect(scope.worker).toBeUndefined();
        });

        it('walks up to the nearest package.json with base.workersFolder', () => {
            writePackageJson(tmpRoot, {
                name: 'project',
                base: { workersFolder: './examples' },
            });
            const subDir = path.join(tmpRoot, 'some/nested/path');
            fs.mkdirSync(subDir, { recursive: true });
            setCwd(subDir);

            const scope = resolveWorkersScope(undefined, undefined);

            expect(scope.workersFolder).toBe(path.join(tmpRoot, 'examples'));
        });

        it('resolves the relative path against the package root, not the CWD', () => {
            writePackageJson(tmpRoot, {
                name: 'project',
                base: { workersFolder: './examples' },
            });
            const subDir = path.join(tmpRoot, 'a/b/c');
            fs.mkdirSync(subDir, { recursive: true });
            setCwd(subDir);

            const scope = resolveWorkersScope(undefined, undefined);

            // Resolves to tmpRoot/examples, NOT subDir/examples
            expect(scope.workersFolder).toBe(path.join(tmpRoot, 'examples'));
        });

        it('passes cliWorker through unchanged', () => {
            writePackageJson(tmpRoot, {
                name: 'project',
                base: { workersFolder: './examples' },
            });
            setCwd(tmpRoot);

            const scope = resolveWorkersScope(undefined, 'foo');

            expect(scope.worker).toBe('foo');
        });
    });

    describe('Branch 4: ./workers/ subdir of CWD', () => {
        it('uses ./workers when no other signal is present', () => {
            const workersDir = path.join(tmpRoot, 'workers');
            fs.mkdirSync(workersDir);
            setCwd(tmpRoot);

            const scope = resolveWorkersScope(undefined, undefined);

            expect(scope.workersFolder).toBe(workersDir);
        });

        it('ignores ./workers if it is a file rather than a directory', () => {
            fs.writeFileSync(path.join(tmpRoot, 'workers'), 'oops');
            setCwd(tmpRoot);

            const scope = resolveWorkersScope(undefined, undefined);

            // Fallback to CWD when ./workers isn't a directory.
            expect(scope.workersFolder).toBe(tmpRoot);
        });
    });

    describe('Branch 5: fallback to CWD', () => {
        it('returns CWD as the workersFolder with no other signal', () => {
            setCwd(tmpRoot);

            const scope = resolveWorkersScope(undefined, undefined);

            expect(scope.workersFolder).toBe(tmpRoot);
            expect(scope.worker).toBeUndefined();
        });
    });

    describe('Empty-string CLI inputs', () => {
        // The handler treats empty strings as "not provided" by checking
        // typeof === 'string' && length > 0 before passing to
        // resolveWorkersScope. But the resolver itself receives undefined
        // in that case, so we just verify undefined produces the fallback
        // behavior we documented above.
        it('treats undefined cliFlag as no flag set', () => {
            setCwd(tmpRoot);

            const scope = resolveWorkersScope(undefined, undefined);

            expect(scope.workersFolder).toBe(tmpRoot);
        });
    });
});

describe('readWorkersFolderFromPackageJson', () => {
    let tmpRoot: string;

    beforeEach(() => {
        tmpRoot = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-pkgjson-')),
        );
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    function writePackageJsonRaw(dir: string, contents: string): void {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'package.json'), contents);
    }

    it('returns the configured folder and package root when present', () => {
        writePackageJsonRaw(
            tmpRoot,
            JSON.stringify({ base: { workersFolder: './examples' } }),
        );

        const result = readWorkersFolderFromPackageJson(tmpRoot);

        expect(result).toEqual({
            workersFolder: './examples',
            packageRoot: tmpRoot,
        });
    });

    it('walks up to the nearest declaring package.json', () => {
        writePackageJsonRaw(
            tmpRoot,
            JSON.stringify({ base: { workersFolder: './examples' } }),
        );
        const nested = path.join(tmpRoot, 'a/b/c');
        fs.mkdirSync(nested, { recursive: true });

        const result = readWorkersFolderFromPackageJson(nested);

        expect(result?.packageRoot).toBe(tmpRoot);
        expect(result?.workersFolder).toBe('./examples');
    });

    it('skips package.json files without base.workersFolder and keeps walking', () => {
        // Inner package.json has no base field; outer one declares the folder.
        writePackageJsonRaw(
            tmpRoot,
            JSON.stringify({ base: { workersFolder: './examples' } }),
        );
        const innerDir = path.join(tmpRoot, 'packages/inner');
        writePackageJsonRaw(innerDir, JSON.stringify({ name: 'inner' }));

        const result = readWorkersFolderFromPackageJson(innerDir);

        // The walk doesn't stop at the inner package.json; it keeps going
        // until it finds one with the declaration. This is required for
        // monorepos where leaf packages don't redeclare the workers folder.
        expect(result?.packageRoot).toBe(tmpRoot);
    });

    it('returns undefined when no ancestor declares base.workersFolder', () => {
        const subdir = path.join(tmpRoot, 'no-config-here');
        fs.mkdirSync(subdir);

        const result = readWorkersFolderFromPackageJson(subdir);

        expect(result).toBeUndefined();
    });

    it('ignores non-string base.workersFolder values', () => {
        writePackageJsonRaw(
            tmpRoot,
            JSON.stringify({ base: { workersFolder: 123 } }),
        );

        const result = readWorkersFolderFromPackageJson(tmpRoot);

        expect(result).toBeUndefined();
    });

    it('ignores empty-string base.workersFolder values', () => {
        writePackageJsonRaw(
            tmpRoot,
            JSON.stringify({ base: { workersFolder: '' } }),
        );

        const result = readWorkersFolderFromPackageJson(tmpRoot);

        expect(result).toBeUndefined();
    });

    it('silently skips unparseable package.json and keeps walking', () => {
        // Outer is valid; inner is garbage. We must not throw on the
        // garbage — a corrupt nested package.json shouldn't poison CLI
        // resolution for the rest of the repo.
        writePackageJsonRaw(
            tmpRoot,
            JSON.stringify({ base: { workersFolder: './examples' } }),
        );
        const innerDir = path.join(tmpRoot, 'broken');
        writePackageJsonRaw(innerDir, '{ this is not json');

        const result = readWorkersFolderFromPackageJson(innerDir);

        expect(result?.packageRoot).toBe(tmpRoot);
    });
});

describe('resolvePersistTo', () => {
    let tmpRoot: string;
    let originalInitCwd: string | undefined;

    beforeEach(() => {
        tmpRoot = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-persist-')),
        );
        originalInitCwd = process.env.INIT_CWD;
    });

    afterEach(() => {
        if (originalInitCwd === undefined) {
            delete process.env.INIT_CWD;
        } else {
            process.env.INIT_CWD = originalInitCwd;
        }
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    function writePackageJson(dir: string, body: unknown): void {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify(body, null, 2),
        );
    }

    it('returns undefined with no flag and no package.json config', () => {
        const workerDir = path.join(tmpRoot, 'workers', 'foo');
        fs.mkdirSync(workerDir, { recursive: true });

        expect(resolvePersistTo({ _: [], $0: '' }, workerDir)).toBeUndefined();
    });

    it('resolves package.json base.persistTo against the package root', () => {
        writePackageJson(tmpRoot, {
            base: {
                workersFolder: './workers',
                persistTo: './.wrangler/state',
            },
        });
        const workerDir = path.join(tmpRoot, 'workers', 'foo');
        fs.mkdirSync(workerDir, { recursive: true });

        const resolved = resolvePersistTo({ _: [], $0: '' }, workerDir);

        expect(resolved).toBe(path.join(tmpRoot, '.wrangler', 'state'));
    });

    it('walks past a worker-level package.json without base.persistTo', () => {
        writePackageJson(tmpRoot, {
            base: { persistTo: './shared-state' },
        });
        const workerDir = path.join(tmpRoot, 'workers', 'foo');
        writePackageJson(workerDir, { name: 'foo' });

        const resolved = resolvePersistTo({ _: [], $0: '' }, workerDir);

        expect(resolved).toBe(path.join(tmpRoot, 'shared-state'));
    });

    it('prefers the --persist-to flag over package.json, resolved against CWD', () => {
        writePackageJson(tmpRoot, {
            base: { persistTo: './from-package-json' },
        });
        const workerDir = path.join(tmpRoot, 'workers', 'foo');
        fs.mkdirSync(workerDir, { recursive: true });
        process.env.INIT_CWD = tmpRoot;

        const resolved = resolvePersistTo(
            { _: [], $0: '', 'persist-to': './from-flag' },
            workerDir,
        );

        expect(resolved).toBe(path.join(tmpRoot, 'from-flag'));
    });

    it('accepts the camelized persistTo args key yargs produces', () => {
        const workerDir = path.join(tmpRoot, 'workers', 'foo');
        fs.mkdirSync(workerDir, { recursive: true });
        process.env.INIT_CWD = tmpRoot;

        const resolved = resolvePersistTo(
            { _: [], $0: '', persistTo: './camelized' },
            workerDir,
        );

        expect(resolved).toBe(path.join(tmpRoot, 'camelized'));
    });
});
