// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

interface PackageLock {
    lockfileVersion?: number;
    packages?: Record<
        string,
        {
            version?: string;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        }
    >;
}

/**
 * Asserts that the workspace's installed dependencies are coherent.
 *
 * Catches the two common drift cases (no `semver` library needed, URL/tarball
 * deps handled natively because we string-compare what npm itself wrote):
 *
 *   1. `package.json` was edited but `npm install` wasn't run — the lockfile's
 *      top-level `dependencies` block disagrees with `package.json`.
 *   2. The lockfile changed (pulled from upstream) but `npm install` wasn't
 *      run — `node_modules/<pkg>/package.json` doesn't match the lockfile.
 *
 * Exits the process with code 1 on the first sign of drift, listing every
 * mismatch with an actionable `npm install` hint.
 *
 * If `package-lock.json` is absent (e.g. the project intentionally doesn't
 * track it), this is a no-op with a warning — `npm install` will create one.
 */
export function checkInstalledDependencies(workspaceRoot: string): void {
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    const lockfilePath = path.join(workspaceRoot, 'package-lock.json');
    const nodeModulesPath = path.join(workspaceRoot, 'node_modules');

    if (!fs.existsSync(packageJsonPath)) {
        // Nothing to check against — let downstream commands fail with a
        // more contextual error.
        return;
    }

    if (!fs.existsSync(lockfilePath)) {
        console.warn(
            `[deps] No package-lock.json found at ${workspaceRoot}; skipping installed-dependency check. Run 'npm install' to generate one.`,
        );
        return;
    }

    if (!fs.existsSync(nodeModulesPath)) {
        console.error(
            `[deps] No node_modules directory found at ${workspaceRoot}. Run 'npm install'.`,
        );
        process.exit(1);
    }

    const packageJson: PackageJson = readJson(packageJsonPath);
    const lockfile: PackageLock = readJson(lockfilePath);
    const lockRoot = lockfile.packages?.[''] ?? {};

    const errors: string[] = [];

    // 1. package.json vs lockfile top-level — catches edits to package.json
    // without a follow-up `npm install`. String equality is sufficient: npm
    // copies the declared range/URL verbatim into the lockfile.
    compareDeclared(
        'dependencies',
        packageJson.dependencies,
        lockRoot.dependencies,
        errors,
    );
    compareDeclared(
        'devDependencies',
        packageJson.devDependencies,
        lockRoot.devDependencies,
        errors,
    );

    // 2. lockfile vs node_modules — catches pulled lockfile changes that
    // weren't installed locally yet.
    const declared = {
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {}),
    };
    for (const name of Object.keys(declared)) {
        const lockEntry = lockfile.packages?.[`node_modules/${name}`];
        if (!lockEntry) {
            errors.push(
                `[deps] '${name}' is declared in package.json but has no entry in package-lock.json. Run 'npm install'.`,
            );
            continue;
        }
        const installedManifestPath = path.join(
            nodeModulesPath,
            name,
            'package.json',
        );
        if (!fs.existsSync(installedManifestPath)) {
            errors.push(
                `[deps] '${name}' is declared but not installed. Run 'npm install'.`,
            );
            continue;
        }
        const installed: { version?: string } = readJson(installedManifestPath);
        if (
            lockEntry.version &&
            installed.version &&
            lockEntry.version !== installed.version
        ) {
            errors.push(
                `[deps] '${name}' is installed at ${installed.version} but package-lock.json wants ${lockEntry.version}. Run 'npm install'.`,
            );
        }
    }

    if (errors.length > 0) {
        for (const message of errors) {
            console.error(message);
        }
        console.error(
            `[deps] ${errors.length} dependency issue(s) detected. Run 'npm install' and try again.`,
        );
        process.exit(1);
    }
}

function compareDeclared(
    label: string,
    pkgEntries: Record<string, string> | undefined,
    lockEntries: Record<string, string> | undefined,
    errors: string[],
): void {
    for (const [name, declared] of Object.entries(pkgEntries ?? {})) {
        const locked = lockEntries?.[name];
        if (locked === undefined) {
            errors.push(
                `[deps] ${label}: '${name}' is declared in package.json but missing from package-lock.json. Run 'npm install'.`,
            );
            continue;
        }
        if (locked !== declared) {
            errors.push(
                `[deps] ${label}: '${name}' is '${declared}' in package.json but '${locked}' in package-lock.json. Run 'npm install'.`,
            );
        }
    }
}

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
