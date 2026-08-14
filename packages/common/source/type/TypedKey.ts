// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A branded, typed key used across the framework for safe, nominal
 * lookups into keyed stores (request context, environment variables,
 * module settings, WebSocket attachments, etc.).
 *
 * The `Scope` phantom brand prevents keys from different stores being
 * accidentally interchanged — a `RequestContextKey<string>` cannot be
 * passed where a `BaseEnvironmentKey<string>` is expected, even though
 * both wrap a `string` value, because TypeScript treats the scope
 * brands as distinct types.
 *
 * Concrete key types (e.g. `RequestContextKey`) extend this base with
 * a fixed scope literal and may add their own constraints on `T`.
 *
 * Some subclasses (those that write into per-key stores — see
 * `RequestContextKey`, `WebSocketInfoKey`) enforce name uniqueness at
 * creation time because two instances with the same `name` would
 * silently overwrite each other. Other subclasses permit duplicate
 * names because they read from shared stores (env vars, module
 * settings) where repeated lookups with the same name are benign and
 * sometimes required (e.g., dynamic bindings).
 */
export class TypedKey<T, Scope extends string> {
    /** @internal phantom type brand — never assigned at runtime */
    readonly _brand!: T;
    /** @internal phantom scope brand — never assigned at runtime */
    readonly _scope!: Scope;

    constructor(readonly name: string) {}
}
