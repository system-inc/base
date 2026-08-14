// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Secret } from '@system-inc/base-common/secret/Secret';
import { TypedKey } from '@system-inc/base-common/type/TypedKey';

/**
 * A branded key for type-safe access to environment variables.
 *
 * Modules define keys for the env vars they need, preventing bulk
 * access to the full environment (which may contain secrets):
 *
 * ```ts
 * const CommitSha = BaseEnvironmentKey.create<string>('COMMIT_SHA');
 * const StripeKey = BaseEnvironmentKey.createSecret('STRIPE_SECRET_KEY');
 *
 * configuration.getEnvironmentVariable(CommitSha);   // string | undefined
 * configuration.getEnvironmentVariable(StripeKey);   // Secret<string> | undefined
 * ```
 *
 * Keys declared with {@link createSecret} are auto-wrapped in a
 * {@link Secret} by the configuration loader, so the value can never
 * flow into logs or JSON without an explicit `.reveal()` at the
 * consuming call site.
 *
 * Extends {@link TypedKey} with the `'environment'` scope brand so
 * environment keys cannot be confused with request-context, module,
 * or WebSocket keys at the type level.
 */
export class BaseEnvironmentKey<T> extends TypedKey<T, 'environment'> {
    private constructor(
        name: string,
        readonly isSecret: boolean,
    ) {
        super(name);
    }

    /**
     * Creates a typed environment variable key for a non-secret value.
     *
     * @example
     * ```ts
     * const CommitSha = BaseEnvironmentKey.create<string>('COMMIT_SHA');
     * ```
     */
    static create<T>(name: string): BaseEnvironmentKey<T> {
        return new BaseEnvironmentKey<T>(name, false);
    }

    /**
     * Creates a typed environment variable key for a secret value.
     *
     * The loader will automatically wrap the raw env string in a
     * {@link Secret}, so the typed value is `Secret<T>` (default
     * `Secret<string>`) and cannot be logged without an explicit
     * `.reveal()`.
     *
     * @example
     * ```ts
     * const StripeKey = BaseEnvironmentKey.createSecret('STRIPE_SECRET_KEY');
     * const stripe = configuration.requireEnvironmentVariable(StripeKey);
     * stripe.reveal(); // only way to get the raw string
     * ```
     */
    static createSecret<T = string>(
        name: string,
    ): BaseEnvironmentKey<Secret<T>> {
        return new BaseEnvironmentKey<Secret<T>>(name, true);
    }
}
