// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves the project's `tsconfig.json` for an esbuild invocation, or
 * `undefined` if the project doesn't have one yet (e.g. a freshly
 * scaffolded workspace).
 *
 * esbuild — used directly by the worker/container bundle paths and
 * indirectly by wrangler — only applies `experimentalDecorators` to source
 * inside `node_modules` when handed an EXPLICIT tsconfig; its auto-discovery
 * skips `node_modules`. The framework and its modules ship decorator-based
 * `.ts` source into `node_modules`, so every esbuild invocation must point
 * at the project tsconfig or the build fails with "Parameter decorators only
 * work when experimental decorators are enabled".
 *
 * Returns the absolute path so callers can format it for their own arg style
 * (`--tsconfig=<path>` for esbuild, `--tsconfig <path>` for wrangler).
 */
export function resolveProjectTsconfig(): string | undefined {
    const projectTsconfig = path.resolve('tsconfig.json');
    return fs.existsSync(projectTsconfig) ? projectTsconfig : undefined;
}
