// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import { createMatchPath, loadConfig, type MatchPath } from 'tsconfig-paths';

/**
 * Extensions tried when resolving a module specifier to a file on disk. The
 * `.ts`/`.tsx` entries come first because workers and modules are authored in
 * TypeScript and resolved through ts-node — the default Node extensions
 * (`.js`/`.json`/`.node`) would never match the source files we scan.
 */
const RESOLUTION_EXTENSIONS = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.json',
];

/**
 * Builds a module-path resolver from the project's tsconfig `paths`.
 *
 * This is the same resolution `tsc`, ts-node, and jest apply to the worker's
 * own imports, so a specifier like `@system-inc/base-modules/account/AccountModule`
 * lands on the exact file on disk — no hard-coded alias guessing. Returns
 * `undefined` when the project has no usable tsconfig `paths`, in which case
 * only relative imports can be resolved.
 */
function createModuleResolver(projectDir: string): MatchPath | undefined {
    let config: ReturnType<typeof loadConfig> | undefined;
    try {
        config = loadConfig(projectDir);
    } catch {
        config = undefined;
    }

    if (!config || config.resultType !== 'success' || !config.paths) {
        return undefined;
    }

    return createMatchPath(config.absoluteBaseUrl, config.paths);
}

/**
 * Parses import statements from a TypeScript file and returns a map
 * of imported names to their source paths.
 *
 * Handles both single-line and multi-line import statements.
 */
export function parseImports(fileContent: string): Map<string, string> {
    const imports = new Map<string, string>();
    const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(fileContent)) !== null) {
        const names = match[1]
            .split(',')
            .map((n) => n.trim())
            .filter((n) => n.length > 0);
        const sourcePath = match[2];
        for (const name of names) {
            imports.set(name, sourcePath);
        }
    }
    return imports;
}

/**
 * Resolves a module import to the absolute directory of the file it points at,
 * mirroring the project's own module resolution.
 *
 * Relative imports resolve against the settings file; everything else is run
 * through the tsconfig-`paths` resolver. A specifier that the resolver can't
 * place — a real `node_modules` package, or a framework import with no tsconfig
 * alias — returns `undefined` and is simply skipped: those never carry the
 * module's own integration tests (the published packages exclude test files).
 *
 * @param importPath The import specifier from the source file (e.g. '@system-inc/base-modules/account/AccountModule')
 * @param settingsFileDir The directory of the settings file, used to resolve relative imports
 * @param matchPath The tsconfig-`paths` resolver, or undefined when the project declares no paths
 * @returns The absolute directory containing the imported file, or undefined if it can't be resolved
 */
export function resolveImportPath(
    importPath: string,
    settingsFileDir: string,
    matchPath: MatchPath | undefined,
): string | undefined {
    // Relative imports resolve directly against the settings file's directory.
    if (importPath.startsWith('.')) {
        return path.resolve(settingsFileDir, path.dirname(importPath));
    }

    // Everything else goes through the project's tsconfig `paths` resolver,
    // which existence-checks candidates against RESOLUTION_EXTENSIONS.
    const resolvedFile = matchPath?.(
        importPath,
        undefined,
        undefined,
        RESOLUTION_EXTENSIONS,
    );

    return resolvedFile ? path.dirname(resolvedFile) : undefined;
}

/**
 * Recursively checks if a directory contains any *.integration.test.ts files.
 */
function hasIntegrationTests(dirPath: string): boolean {
    if (!fs.existsSync(dirPath)) {
        return false;
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (hasIntegrationTests(path.join(dirPath, entry.name))) {
                return true;
            }
        } else if (entry.name.endsWith('.integration.test.ts')) {
            return true;
        }
    }
    return false;
}

/**
 * Discovers integration test glob patterns by parsing the worker's settings
 * file to find module imports and resolving each to the module's directory on
 * disk (via the project's tsconfig `paths`), then scanning for tests.
 *
 * When moduleNames is provided, only those modules are looked up in the imports.
 * When moduleNames is undefined, all imports from the settings file are checked
 * for integration tests (useful for container settings where the caller doesn't
 * know which modules are registered).
 *
 * @param settingsFilePath Absolute path to the worker's settings.ts file
 * @param moduleNames Specific module names to discover, or undefined to discover all
 * @returns Array of glob patterns for Jest --testMatch
 */
export function discoverModuleIntegrationTests(
    settingsFilePath: string,
    moduleNames?: string[],
): string[] {
    if (!fs.existsSync(settingsFilePath)) {
        return [];
    }

    const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
    const imports = parseImports(fileContent);
    const settingsFileDir = path.dirname(settingsFilePath);
    // The resolver is built from the project tsconfig (the runner executes at
    // the project root), so it matches how the worker's own imports resolve.
    const matchPath = createModuleResolver(process.cwd());

    const patterns: string[] = [];
    const addedDirs = new Set<string>();

    // Determine which imports to check
    const entriesToCheck: Array<[string, string]> = moduleNames
        ? moduleNames
              .map((name): [string, string] | undefined => {
                  const importPath = imports.get(name);
                  if (!importPath) {
                      console.warn(
                          `Could not find import for module '${name}' in ${settingsFilePath}`,
                      );
                      return undefined;
                  }
                  return [name, importPath];
              })
              .filter((entry): entry is [string, string] => entry !== undefined)
        : Array.from(imports.entries());

    for (const [name, importPath] of entriesToCheck) {
        const dir = resolveImportPath(importPath, settingsFileDir, matchPath);
        if (!dir || addedDirs.has(dir)) {
            continue;
        }

        if (hasIntegrationTests(dir)) {
            console.log(`  Found integration tests for '${name}' at ${dir}`);
            patterns.push(`${dir}/**/*.integration.test.ts`);
            addedDirs.add(dir);
        }
    }

    return patterns;
}
