// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as path from 'path';

/**
 * Resolves the bundled `node-launcher.js` — spawned as its own Node process by
 * `develop`/run for Node-platform workers, and re-bundled into `bootstrap.js`
 * for container workers.
 *
 * build.mjs bundles BOTH the `base` bin (`base-cli.js`) and the launcher
 * (`node-launcher.js`) into `dist/`, and the bin always runs from `dist/`, so
 * every bundled module's `__dirname` is `dist/` regardless of its `source/`
 * location. The launcher is therefore a sibling at runtime — resolve it
 * directly. It must NOT be resolved via the `source/` layout: the published
 * package's `files` ships only `dist` + `templates`, and the launcher's source
 * is `.ts`, so only the bundled `dist/node-launcher.js` exists at runtime.
 */
export function resolveNodeLauncherPath(): string {
    return path.join(__dirname, 'node-launcher.js');
}
