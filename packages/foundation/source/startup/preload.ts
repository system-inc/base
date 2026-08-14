// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Worker-entry bootstrap: loads reflect-metadata before any decorated class is
// evaluated. The framework's decorators (@OrmTable, @GqlResolver, @Injectable,
// the validation/serialization decorators, …) read and write `reflect-metadata`,
// so a worker's entry file must import this FIRST — before importing BaseWorker
// or any module:
//
//     import '@system-inc/base-foundation/startup/preload';
//     import { BaseWorker } from '@system-inc/base-foundation/worker/BaseWorker';
//
// This lives in foundation (the worker runtime) rather than the CLI: it is
// worker-runtime code that esbuild bundles into the deployed worker, and the
// deployed worker must not depend on the build-time CLI package.
import 'reflect-metadata';
