// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { copyTemplate } from './CopyTemplate';

// `resolveTemplateDir` is intentionally NOT unit-tested here: it resolves the
// templates dir from `__dirname`, which differs between this source file (under
// ts-jest) and the bundled `dist/`. Testing it in-VM would assert the wrong
// layout — its real behavior is covered faithfully by the bundled CLI in
// `integration/Scaffold.cli-integration.test.ts` (which actually scaffolds).

describe('copyTemplate', () => {
    let templateDir: string;
    let targetDir: string;

    beforeEach(() => {
        const tmpRoot = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-template-')),
        );
        templateDir = path.join(tmpRoot, 'template');
        targetDir = path.join(tmpRoot, 'target');
        fs.mkdirSync(templateDir);
    });

    afterEach(() => {
        // Tear down by removing the shared tmp parent of both dirs.
        const parent = path.dirname(templateDir);
        fs.rmSync(parent, { recursive: true, force: true });
    });

    function writeTemplate(relPath: string, body: string): void {
        const full = path.join(templateDir, relPath);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }

    function read(relPath: string): string {
        return fs.readFileSync(path.join(targetDir, relPath), 'utf8');
    }

    it('substitutes {{var}} placeholders in file contents', () => {
        writeTemplate(
            'settings.ts',
            `export const name = '{{workerName}}';\nexport const port = {{workerPort}};\n`,
        );

        copyTemplate({
            templateDir,
            targetDir,
            vars: { workerName: 'foo', workerPort: 3000 },
        });

        expect(read('settings.ts')).toBe(
            `export const name = 'foo';\nexport const port = 3000;\n`,
        );
    });

    it('substitutes {{var}} in filenames', () => {
        writeTemplate('{{workerName}}.config.ts', '// no vars in body');

        copyTemplate({
            templateDir,
            targetDir,
            vars: { workerName: 'foo' },
        });

        expect(fs.existsSync(path.join(targetDir, 'foo.config.ts'))).toBe(true);
    });

    it('strips the .template suffix from filenames', () => {
        // Used for files whose unrendered name would confuse the
        // toolchain (e.g. package.json.template prevents npm from
        // parsing the template before scaffolding).
        writeTemplate('package.json.template', '{ "name": "{{workerName}}" }');

        copyTemplate({
            templateDir,
            targetDir,
            vars: { workerName: 'foo' },
        });

        expect(fs.existsSync(path.join(targetDir, 'package.json'))).toBe(true);
        expect(
            fs.existsSync(path.join(targetDir, 'package.json.template')),
        ).toBe(false);
        expect(read('package.json')).toBe('{ "name": "foo" }');
    });

    it('restores known dotfile names (gitignore.template → .gitignore)', () => {
        writeTemplate('gitignore.template', 'node_modules\n');

        copyTemplate({
            templateDir,
            targetDir,
            vars: {},
        });

        expect(fs.existsSync(path.join(targetDir, '.gitignore'))).toBe(true);
        expect(read('.gitignore')).toBe('node_modules\n');
    });

    it('restores .nvmrc from nvmrc.template', () => {
        writeTemplate('nvmrc.template', '20\n');

        copyTemplate({
            templateDir,
            targetDir,
            vars: {},
        });

        expect(read('.nvmrc')).toBe('20\n');
    });

    it('recurses into subdirectories', () => {
        writeTemplate('a/b/c/leaf.txt', 'leaf:{{workerName}}');

        copyTemplate({
            templateDir,
            targetDir,
            vars: { workerName: 'foo' },
        });

        expect(read('a/b/c/leaf.txt')).toBe('leaf:foo');
    });

    it('preserves the executable bit (.githooks/pre-commit stays runnable)', () => {
        writeTemplate('.githooks/pre-commit', '#!/bin/sh\nexit 0\n');
        fs.chmodSync(path.join(templateDir, '.githooks/pre-commit'), 0o755);

        copyTemplate({
            templateDir,
            targetDir,
            vars: {},
        });

        const mode = fs.statSync(
            path.join(targetDir, '.githooks/pre-commit'),
        ).mode;
        expect(mode & 0o111).toBe(0o111);
    });

    it('leaves unknown {{vars}} untouched', () => {
        // Documented behavior of substitute(): unmatched keys are left
        // as-is rather than rendered as `undefined` or stripped.
        writeTemplate('readme.md', 'hello {{workerName}} {{notDefined}}');

        copyTemplate({
            templateDir,
            targetDir,
            vars: { workerName: 'foo' },
        });

        expect(read('readme.md')).toBe('hello foo {{notDefined}}');
    });

    it('throws when a target file already exists and overwrite is false', () => {
        writeTemplate('settings.ts', 'new');
        fs.mkdirSync(targetDir);
        fs.writeFileSync(path.join(targetDir, 'settings.ts'), 'existing');

        expect(() =>
            copyTemplate({
                templateDir,
                targetDir,
                vars: {},
            }),
        ).toThrow(/Refusing to overwrite/);
        // Existing file is untouched.
        expect(read('settings.ts')).toBe('existing');
    });

    it('overwrites existing files when overwrite is true', () => {
        writeTemplate('settings.ts', 'new');
        fs.mkdirSync(targetDir);
        fs.writeFileSync(path.join(targetDir, 'settings.ts'), 'existing');

        copyTemplate({
            templateDir,
            targetDir,
            vars: {},
            overwrite: true,
        });

        expect(read('settings.ts')).toBe('new');
    });

    it('throws when templateDir does not exist', () => {
        const missing = path.join(path.dirname(templateDir), 'missing');

        expect(() =>
            copyTemplate({
                templateDir: missing,
                targetDir,
                vars: {},
            }),
        ).toThrow(/Template not found/);
    });

    it('numeric vars stringify cleanly', () => {
        writeTemplate('port.ts', 'export const port = {{port}};');

        copyTemplate({
            templateDir,
            targetDir,
            vars: { port: 3000 },
        });

        expect(read('port.ts')).toBe('export const port = 3000;');
    });
});
