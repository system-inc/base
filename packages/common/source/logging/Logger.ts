// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogLevel, parseLogLevel } from './LogLevel';

/**
 * Level-gated logger over `console.*`.
 *
 * Logging sits beneath dependency injection — like `console` itself — so
 * the Logger is a module-scope static singleton in the style of
 * `DecoratorRegistry` (deliberately not stashed on `globalThis`, so
 * jest's per-file module registry and dev-server reloads reset it). The
 * level is process-global state, the same compromise the framework
 * already makes for its metadata registries: one worker per process.
 *
 * Every log line belongs to a **category** (`'rpc'`, `'orm'`, your
 * module's name), which prefixes the output (`[rpc] …`) and can carry
 * its own threshold. There are two ways to call — same categories, same
 * settings, one mechanism:
 *
 * ```ts
 * // anywhere, zero setup — pass the category each call
 * Logger.info('notes', 'note %s created', noteId);
 *
 * // a subsystem — bake the category in once at module top
 * const logger = Logger.create('rpc');
 * logger.debug('RPC: %s', procedureName);
 * ```
 *
 * `create` also skips the per-call category lookup, so prefer it on hot
 * paths.
 *
 * Performance contract: below the threshold a call on a created logger
 * is one cached integer compare and a return — no string is built.
 * Format arguments printf-style (`'%s'`, `'%o'`, …; `console` assembles
 * the string only when emitting) rather than with template literals, and
 * guard genuinely expensive computation with {@link isDebugEnabled}:
 *
 * ```ts
 * if (logger.isDebugEnabled) {
 *     logger.debug(stopWatch.toString());
 * }
 * ```
 *
 * The sink is `console.*` — on Cloudflare Workers that is the output
 * channel (tail, dashboard, observability). The win is gating, not a
 * different transport.
 *
 * Rule of thumb: the Logger is for **worker execution-path code** — boot,
 * dispatch, and anything that runs while serving traffic, where levels
 * let an operator tune what a deployed worker emits. Output aimed at a
 * human running a tool (CLI commands, the jest test harness, fatal
 * pre-exit messages) stays on plain `console`: it must print regardless
 * of any level configuration.
 */
export class Logger {
    //region Static configuration

    private static readonly instances = new Map<string, Logger>();
    private static defaultLevel = LogLevel.Info;
    private static readonly categoryLevels = new Map<string, LogLevel>();

    /**
     * Returns the logger for `category`, creating it on first use.
     * Repeated calls with the same category return the same instance, so
     * this is safe (and intended) at module top level:
     *
     * ```ts
     * const logger = Logger.create('rpc');
     * ```
     */
    static create(category: string): Logger {
        let instance = Logger.instances.get(category);
        if (!instance) {
            instance = new Logger(category);
            Logger.instances.set(category, instance);
        }
        return instance;
    }

    /**
     * Sets the default threshold (or one category's threshold), updating
     * the cached level on every existing logger. Writes are rare and
     * slow-path; reads on the hot path stay a single field compare.
     */
    static setLevel(level: LogLevel, category?: string): void {
        if (category === undefined) {
            Logger.defaultLevel = level;
        } else {
            Logger.categoryLevels.set(category, level);
        }
        for (const instance of Logger.instances.values()) {
            instance.level = Logger.effectiveLevel(instance.category);
        }
    }

    /**
     * Applies a level directive of the form `warn` or `warn,rpc=debug` —
     * a default level and/or per-category overrides, comma-separated.
     * This is the `LOG_LEVEL` environment variable format. Throws on an
     * unrecognized level name or malformed entry: a typo silently
     * changing what a worker logs is exactly the kind of guess the
     * framework refuses to make.
     */
    static configure(directive: string): void {
        for (const entry of directive.split(',')) {
            const trimmed = entry.trim();
            if (trimmed.length === 0) {
                continue;
            }
            const [first, second, ...rest] = trimmed.split('=');
            if (rest.length > 0) {
                throw new Error(
                    `Invalid log level entry '${trimmed}' — expected 'level' or 'category=level'.`,
                );
            }
            const levelName = second ?? first;
            const level = parseLogLevel(levelName);
            if (level === undefined) {
                throw new Error(
                    `Unknown log level '${levelName}' in '${trimmed}' — expected one of debug, info, warn, error, off.`,
                );
            }
            Logger.setLevel(
                level,
                second === undefined ? undefined : first.trim(),
            );
        }
    }

    /**
     * The effective threshold for `category` (or the default threshold
     * when omitted).
     */
    static getLevel(category?: string): LogLevel {
        return Logger.effectiveLevel(category);
    }

    private static effectiveLevel(category: string | undefined): LogLevel {
        if (category !== undefined) {
            const override = Logger.categoryLevels.get(category);
            if (override !== undefined) {
                return override;
            }
        }
        return Logger.defaultLevel;
    }

    //endregion
    //region Static logging

    // Each static delegates to the category's logger, so it sees exactly
    // the settings a created instance would — the only difference is the
    // per-call category lookup, which `create` lets hot paths skip.

    /**
     * True when `level` would be emitted for `category`. Use to guard
     * computation that is expensive even before formatting (e.g.
     * `stopWatch.toString()`).
     */
    static isEnabled(category: string, level: LogLevel): boolean {
        return Logger.create(category).isEnabled(level);
    }

    static debug(
        category: string,
        message: string,
        ...optionalParameters: unknown[]
    ): void {
        Logger.create(category).debug(message, ...optionalParameters);
    }

    static info(
        category: string,
        message: string,
        ...optionalParameters: unknown[]
    ): void {
        Logger.create(category).info(message, ...optionalParameters);
    }

    static warn(
        category: string,
        message: string,
        ...optionalParameters: unknown[]
    ): void {
        Logger.create(category).warn(message, ...optionalParameters);
    }

    static error(
        category: string,
        message: string,
        ...optionalParameters: unknown[]
    ): void {
        Logger.create(category).error(message, ...optionalParameters);
    }

    //endregion
    //region Instance

    /**
     * Cached effective threshold — the hot-path compare. Maintained by
     * {@link setLevel}; never written elsewhere.
     */
    private level: LogLevel;

    /**
     * `'[rpc] '` for category `'rpc'`.
     */
    private readonly prefix: string;

    private constructor(readonly category: string) {
        this.level = Logger.effectiveLevel(category);
        this.prefix = `[${category}] `;
    }

    /**
     * True when `level` would be emitted. Use to guard computation that
     * is expensive even before formatting (e.g. `stopWatch.toString()`).
     */
    isEnabled(level: LogLevel): boolean {
        return level >= this.level;
    }

    get isDebugEnabled(): boolean {
        return LogLevel.Debug >= this.level;
    }

    debug(message: string, ...optionalParameters: unknown[]): void {
        if (LogLevel.Debug < this.level) {
            return;
        }
        console.debug(this.prefix + message, ...optionalParameters);
    }

    info(message: string, ...optionalParameters: unknown[]): void {
        if (LogLevel.Info < this.level) {
            return;
        }
        console.info(this.prefix + message, ...optionalParameters);
    }

    warn(message: string, ...optionalParameters: unknown[]): void {
        if (LogLevel.Warn < this.level) {
            return;
        }
        console.warn(this.prefix + message, ...optionalParameters);
    }

    error(message: string, ...optionalParameters: unknown[]): void {
        if (LogLevel.Error < this.level) {
            return;
        }
        console.error(this.prefix + message, ...optionalParameters);
    }

    //endregion
}
