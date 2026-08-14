// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Options for the `@Provider` decorator and the optional/lazy injection
 * decorators built on the same factory registration path.
 */
export interface ProviderOptions {
    factoryType?: 'caching' | 'non-caching';
}
