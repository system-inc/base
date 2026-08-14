// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-require-imports */

// Register the TS runtime only when the entry the launcher will load is a
// TypeScript file (the worker index path is the launcher's last argument).
//
// The launcher runs in two contexts. `base develop` on the Node platform
// spawns it against the worker's `index.ts`, where ts-node must transpile
// the worker (and the ship-source framework packages it imports). The
// container bootstrap, however, is this same launcher bundled by esbuild
// and pointed at a PREBUILT `.js` worker bundle — inside a container image
// where `typescript` is not installed. RegisterTsRuntime requires
// `typescript` at load time (ts-node resolves its compiler dynamically, so
// bundling cannot inline it), which crashes the container on boot. Gate on
// the entry extension so the TS runtime only wires up where it can — and
// needs to — exist.
if (process.argv[process.argv.length - 1]?.endsWith('.ts')) {
    require('./RegisterTsRuntime');
}
