// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { runBase } from './internal/RunBase';

/**
 * Scaffolding is high-regression territory: template variable names
 * change, dotfile-restore mapping changes, a `.template` suffix gets
 * accidentally left on. These tests run the actual scaffold commands
 * against tmpdirs and assert the resulting tree — the only reliable
 * way to verify end-to-end template integrity.
 *
 * Tmpdirs live under `os.tmpdir()`. Belt-and-suspenders gitignore
 * pattern `.cli-test-tmp/` covers the case of a test accidentally
 * pointing in-tree.
 */

function mkTmpDir(prefix: string): string {
    return fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), `base-cli-${prefix}-`)),
    );
}

function exists(parent: string, rel: string): boolean {
    return fs.existsSync(path.join(parent, rel));
}

function read(parent: string, rel: string): string {
    return fs.readFileSync(path.join(parent, rel), 'utf8');
}

describe('base worker create', () => {
    let workspaceDir: string;

    beforeEach(() => {
        workspaceDir = mkTmpDir('worker-create');
    });

    afterEach(() => {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    it('scaffolds a worker into the resolved workersFolder', () => {
        // --workers-folder points the resolver at workspaceDir directly,
        // so the worker lands at workspaceDir/foo/.
        const result = runBase(
            ['worker', 'create', 'foo', '--workers-folder', workspaceDir],
            { cwd: workspaceDir },
        );

        expect(result.code).toBe(0);
        const workerRoot = path.join(workspaceDir, 'foo');
        expect(exists(workerRoot, 'settings.ts')).toBe(true);
        expect(exists(workerRoot, 'wrangler.toml')).toBe(true);
        expect(exists(workerRoot, 'index.ts')).toBe(true);
        expect(exists(workerRoot, 'source/services/HelloWorldService.ts')).toBe(
            true,
        );
        expect(exists(workerRoot, 'test/HelloWorld.integration.test.ts')).toBe(
            true,
        );
    });

    it('substitutes {{workerName}} into rendered template files', () => {
        runBase(['worker', 'create', 'foo', '--workers-folder', workspaceDir], {
            cwd: workspaceDir,
        });

        const settings = read(workspaceDir, 'foo/settings.ts');
        expect(settings).toContain("name: 'foo'");
        expect(settings).toContain("title: 'foo'");
        expect(settings).not.toContain('{{workerName}}');

        const wrangler = read(workspaceDir, 'foo/wrangler.toml');
        expect(wrangler).toContain('name = "foo"');
        expect(wrangler).not.toContain('{{workerName}}');
    });

    it('substitutes {{workerPort}} from --port', () => {
        runBase(
            [
                'worker',
                'create',
                'foo',
                '--port',
                '4567',
                '--workers-folder',
                workspaceDir,
            ],
            { cwd: workspaceDir },
        );

        const settings = read(workspaceDir, 'foo/settings.ts');
        expect(settings).toContain('port: 4567');
    });

    it('strips the .template suffix from rendered filenames', () => {
        // Templates ship as settings.ts.template / wrangler.toml.template
        // to keep editors and toolchains from parsing them prematurely.
        // The suffix must be stripped on copy.
        runBase(['worker', 'create', 'foo', '--workers-folder', workspaceDir], {
            cwd: workspaceDir,
        });

        expect(exists(workspaceDir, 'foo/settings.ts.template')).toBe(false);
        expect(exists(workspaceDir, 'foo/wrangler.toml.template')).toBe(false);
    });

    it('refuses to overwrite an existing worker dir without --force', () => {
        const workerDir = path.join(workspaceDir, 'foo');
        fs.mkdirSync(workerDir);
        fs.writeFileSync(path.join(workerDir, 'settings.ts'), 'existing');

        const result = runBase(
            ['worker', 'create', 'foo', '--workers-folder', workspaceDir],
            { cwd: workspaceDir },
        );

        expect(result.code).not.toBe(0);
        // The existing file must survive a rejected scaffold attempt.
        expect(read(workspaceDir, 'foo/settings.ts')).toBe('existing');
    });

    it('rejects invalid worker names', () => {
        // Validator is lowercase letters/digits/hyphens only.
        const result = runBase(
            ['worker', 'create', 'BadName', '--workers-folder', workspaceDir],
            { cwd: workspaceDir },
        );

        expect(result.code).not.toBe(0);
        expect(result.stderr).toMatch(/lowercase/i);
    });
});

describe('base workspace create', () => {
    let parentDir: string;
    let targetDir: string;

    beforeEach(() => {
        parentDir = mkTmpDir('workspace-create');
        targetDir = path.join(parentDir, 'my-workspace');
    });

    afterEach(() => {
        fs.rmSync(parentDir, { recursive: true, force: true });
    });

    it('scaffolds a workspace root + starter worker (no install)', () => {
        // --no-install keeps the test fast and offline. Real-world
        // boot would run `npm install` afterwards.
        const result = runBase(
            ['workspace', 'create', targetDir, '--no-install'],
            { cwd: parentDir },
        );

        expect(result.code).toBe(0);
        // Workspace root files
        expect(exists(targetDir, 'package.json')).toBe(true);
        expect(exists(targetDir, 'tsconfig.json')).toBe(true);
        expect(exists(targetDir, 'jest.config.js')).toBe(true);
        expect(exists(targetDir, 'jest.setup.ts')).toBe(true);
        expect(exists(targetDir, 'eslint.config.mjs')).toBe(true);
        // Nested-dir files
        expect(exists(targetDir, '.vscode/launch.json')).toBe(true);
        expect(exists(targetDir, '.github/workflows/ci.yml')).toBe(true);
        // Composite action for secrets import — required by ci.yml.
        // If this drops out of the template, scaffolded projects get
        // a CI that references a missing action.
        expect(
            exists(targetDir, '.github/actions/configure-project/action.yml'),
        ).toBe(true);
        // Three-workflow CI shape (ci + integration + deploy-production)
        // is the standard consumer pipeline. Locking them in so a template
        // refactor can't silently strand scaffolded projects with a partial
        // CI.
        expect(exists(targetDir, '.github/workflows/integration.yml')).toBe(
            true,
        );
        expect(
            exists(targetDir, '.github/workflows/deploy-production.yml'),
        ).toBe(true);
        // Starter worker
        expect(exists(targetDir, 'workers/app/settings.ts')).toBe(true);
        expect(exists(targetDir, 'workers/app/wrangler.toml')).toBe(true);
    });

    it('restores dotfile names from the *.template suffix sources', () => {
        runBase(['workspace', 'create', targetDir, '--no-install'], {
            cwd: parentDir,
        });

        // gitignore.template → .gitignore, nvmrc.template → .nvmrc.
        // These dotfiles are easy to silently break — a refactor that
        // renames the mapping table strands them as nvmrc/gitignore.
        expect(exists(targetDir, '.gitignore')).toBe(true);
        expect(exists(targetDir, '.nvmrc')).toBe(true);
        expect(exists(targetDir, 'gitignore.template')).toBe(false);
        expect(exists(targetDir, 'nvmrc.template')).toBe(false);
    });

    it('ships the pre-commit hook with its executable bit intact', () => {
        runBase(['workspace', 'create', targetDir, '--no-install'], {
            cwd: parentDir,
        });

        // A non-executable hook is silently skipped by git, so losing the
        // mode (e.g. a copy path that drops it) would disable formatting
        // for every new workspace without any visible error.
        const hook = path.join(targetDir, '.githooks', 'pre-commit');
        expect(fs.existsSync(hook)).toBe(true);
        expect(fs.statSync(hook).mode & 0o111).toBe(0o111);
    });

    it('substitutes workspaceName into package.json', () => {
        runBase(['workspace', 'create', targetDir, '--no-install'], {
            cwd: parentDir,
        });

        const pkg = JSON.parse(read(targetDir, 'package.json'));
        expect(pkg.name).toBe('my-workspace');
    });

    it('honors --name override', () => {
        runBase(
            [
                'workspace',
                'create',
                targetDir,
                '--name',
                'custom-name',
                '--no-install',
            ],
            { cwd: parentDir },
        );

        const pkg = JSON.parse(read(targetDir, 'package.json'));
        expect(pkg.name).toBe('custom-name');
    });

    it('honors --starter for the initial worker name', () => {
        runBase(
            [
                'workspace',
                'create',
                targetDir,
                '--starter',
                'api',
                '--no-install',
            ],
            { cwd: parentDir },
        );

        expect(exists(targetDir, 'workers/api/settings.ts')).toBe(true);
        expect(exists(targetDir, 'workers/app/settings.ts')).toBe(false);
        const settings = read(targetDir, 'workers/api/settings.ts');
        expect(settings).toContain("name: 'api'");
    });

    it('refuses to scaffold into a non-empty directory without --force', () => {
        fs.mkdirSync(targetDir);
        fs.writeFileSync(path.join(targetDir, 'pre-existing'), 'data');

        const result = runBase(
            ['workspace', 'create', targetDir, '--no-install'],
            { cwd: parentDir },
        );

        expect(result.code).not.toBe(0);
        expect(result.stderr).toMatch(/not empty/i);
    });

    it('leaves no unrendered {{var}} placeholders in the tree', () => {
        runBase(['workspace', 'create', targetDir, '--no-install'], {
            cwd: parentDir,
        });

        // Walk the tree and assert no file body contains "{{...}}"
        // patterns matching a known var. Catches templates that
        // reference a var we forgot to pass through.
        const stray = findStrayPlaceholders(targetDir);
        expect(stray).toEqual([]);
    });
});

/**
 * Walk a directory tree and return any file paths whose contents
 * contain a `{{knownVar}}` placeholder that should have been replaced
 * by scaffolding. Avoids false positives from intentional `{{...}}` in
 * doc snippets by restricting to vars our scaffold actually passes.
 */
function findStrayPlaceholders(root: string): string[] {
    const knownVars = ['workspaceName', 'workerName', 'workerPort'];
    const pattern = new RegExp(`\\{\\{(?:${knownVars.join('|')})\\}\\}`);
    const stray: string[] = [];

    function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules') continue;
                walk(full);
                continue;
            }
            try {
                const body = fs.readFileSync(full, 'utf8');
                if (pattern.test(body)) stray.push(full);
            } catch {
                // Skip binary or unreadable files.
            }
        }
    }
    walk(root);
    return stray;
}
