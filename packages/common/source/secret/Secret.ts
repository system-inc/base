// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A redaction-hardened wrapper around a sensitive value.
 *
 * The raw value is held in a native ECMAScript private field (`#value`),
 * which is invisible to `JSON.stringify`, `Object.keys`, spread, and
 * `console.log`. The class also explicitly overrides `toJSON`, `toString`,
 * and the Node.js / Workers inspect symbol so that *every* common leakage
 * path ({@link JSON.stringify}, template literals, `console.log`,
 * `util.inspect`) renders `[redacted]`.
 *
 * The only way to extract the underlying value is {@link reveal}. This
 * makes secret access explicit and greppable — a code review can enumerate
 * every escape point by searching for `.reveal()`.
 *
 * Prefer {@link map} when deriving one secret from another; it keeps the
 * result inside the wrapper instead of leaking the plaintext into caller
 * scope.
 *
 * @example
 * ```ts
 * const cookieSecret = new Secret(env.COOKIE_SECRET);
 * console.log(cookieSecret);              // Secret([redacted])
 * JSON.stringify({ secret: cookieSecret }); // {"secret":"[redacted]"}
 * `${cookieSecret}`;                      // "[redacted]"
 *
 * // Explicit, greppable extraction at the crypto boundary:
 * await encrypt(data, key, cookieSecret.reveal());
 * ```
 */
export class Secret<T> {
    static create<T>(value: T | undefined): Secret<T> | undefined {
        return value ? new Secret(value) : undefined;
    }

    readonly #value: T;

    constructor(value: T) {
        this.#value = value;
    }

    /**
     * Returns the raw underlying value. This is the one sanctioned escape
     * hatch out of the wrapper — prefer keeping the value inside `Secret`
     * (see {@link map}) and only call `reveal()` at the innermost boundary
     * that actually needs the plaintext (e.g. a crypto primitive or a
     * third-party SDK call).
     */
    reveal(): T {
        return this.#value;
    }

    /**
     * Transforms the wrapped value and returns a new `Secret` holding the
     * result. Useful for deriving one secret from another (hashing, key
     * splitting, encoding) without letting the plaintext escape into an
     * intermediate variable.
     */
    map<U>(fn: (value: T) => U): Secret<U> {
        return new Secret(fn(this.#value));
    }

    /**
     * Controls `JSON.stringify()` output.
     */
    toJSON(): string {
        return '[redacted]';
    }

    /**
     * Controls string coercion (template literals, `String()`, `"" + obj`).
     */
    toString(): string {
        return '[redacted]';
    }

    /**
     * Controls `console.log()` output in Node.js and Cloudflare Workers.
     */
    [Symbol.for('nodejs.util.inspect.custom')](): string {
        return 'Secret([redacted])';
    }
}
