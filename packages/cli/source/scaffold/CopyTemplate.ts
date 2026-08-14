// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';

/**
 * Variables substituted into template files. Use `{{key}}` in the
 * template source; matches are replaced before the file is written.
 */
export type TemplateVars = Record<string, string | number>;

/**
 * Trailing suffix stripped during copy. Used for files whose unrendered
 * name would confuse the toolchain (e.g. `package.json.template` ->
 * `package.json`, so npm doesn't try to parse the template before
 * scaffolding). Bare files with no special name don't need it.
 */
const TEMPLATE_SUFFIX = '.template';

/**
 * Some workspace files start with a leading dot (`.gitignore`,
 * `.nvmrc`, etc). npm strips files whose name starts with a dot from
 * package tarballs in some setups, and they're easy to miss in editor
 * trees. We ship them under sanitized names (e.g. `gitignore.template`)
 * and restore the dot on copy.
 */
const DOTFILE_RESTORE: Record<string, string> = {
    'gitignore.template': '.gitignore',
    'nvmrc.template': '.nvmrc',
    'prettierrc.json.template': '.prettierrc.json',
    'prettierignore.template': '.prettierignore',
};

export interface CopyTemplateOptions {
    /** Absolute path of the template source directory. */
    templateDir: string;
    /** Absolute path where files should be written. */
    targetDir: string;
    /** Substituted into `{{key}}` placeholders in template files. */
    vars: TemplateVars;
    /**
     * If false, throw when any target file already exists (default).
     * If true, overwrite without warning. Use sparingly.
     */
    overwrite?: boolean;
}

/**
 * Recursively copy a template directory to a target, applying
 * `{{var}}` substitutions to file *contents* AND filenames. Strips the
 * `.template` suffix and restores known dotfile names.
 */
export function copyTemplate(options: CopyTemplateOptions): string[] {
    const { templateDir, targetDir, vars, overwrite = false } = options;
    if (!fs.existsSync(templateDir)) {
        throw new Error(`Template not found: ${templateDir}`);
    }
    const written: string[] = [];
    walk(templateDir, targetDir);
    return written;

    function walk(srcDir: string, dstDir: string) {
        for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
            const srcPath = path.join(srcDir, entry.name);
            const dstName = renderName(entry.name);
            const dstPath = path.join(dstDir, dstName);

            if (entry.isDirectory()) {
                fs.mkdirSync(dstPath, { recursive: true });
                walk(srcPath, dstPath);
                continue;
            }

            if (!overwrite && fs.existsSync(dstPath)) {
                throw new Error(
                    `Refusing to overwrite existing file: ${dstPath}. Use --force to allow.`,
                );
            }

            fs.mkdirSync(path.dirname(dstPath), { recursive: true });
            const content = fs.readFileSync(srcPath, 'utf8');
            fs.writeFileSync(dstPath, substitute(content, vars));
            // Preserve the source file's mode: git hooks (.githooks/*) must
            // keep their executable bit or git silently skips them.
            fs.chmodSync(dstPath, fs.statSync(srcPath).mode);
            written.push(dstPath);
        }
    }

    function renderName(name: string): string {
        if (DOTFILE_RESTORE[name]) return DOTFILE_RESTORE[name];
        const stripped = name.endsWith(TEMPLATE_SUFFIX)
            ? name.slice(0, -TEMPLATE_SUFFIX.length)
            : name;
        return substitute(stripped, vars);
    }
}

function substitute(input: string, vars: TemplateVars): string {
    return input.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = vars[key];
        if (value === undefined) return match; // leave untouched if unknown
        return String(value);
    });
}

/**
 * Resolve a template directory shipped inside the base-cli package.
 *
 * `templates/` lives at the package root. We walk up from `__dirname` until we
 * find it, rather than hard-coding a relative depth — because that depth differs
 * by context: the bundled CLI runs from `dist/` (templates at `../templates`),
 * while unit tests run the source from `source/scaffold/` (templates at
 * `../../templates`). Walking up handles both, and also a consumer's installed
 * `node_modules/@system-inc/base-cli/dist/`.
 */
export function resolveTemplateDir(name: 'workspace' | 'worker'): string {
    let dir = __dirname;
    for (;;) {
        const candidate = path.join(dir, 'templates', name);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            // Never found it — fall back to the bundled-layout location so the
            // error surfaces against the most likely intended path.
            return path.resolve(__dirname, '..', 'templates', name);
        }
        dir = parent;
    }
}

/**
 * The version of the running base-cli package, read from its own
 * package.json — found by the same walk-up used for `templates/`, since
 * the depth differs between the bundled `dist/` and source layouts.
 * Scaffolds substitute this into the template's `@system-inc/base-*`
 * dependency pins so a workspace always requests the version family of
 * the CLI that created it, instead of a hardcoded pin that drifts.
 */
export function resolveCliPackageVersion(): string {
    let dir = __dirname;
    for (;;) {
        const candidate = path.join(dir, 'package.json');
        if (fs.existsSync(candidate)) {
            const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
                name?: string;
                version?: string;
            };
            if (
                parsed.name === '@system-inc/base-cli' &&
                typeof parsed.version === 'string'
            ) {
                return parsed.version;
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            throw new Error(
                'Unable to resolve the base-cli package.json to determine the scaffold dependency version.',
            );
        }
        dir = parent;
    }
}
