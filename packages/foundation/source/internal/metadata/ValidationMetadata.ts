// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/**
 * Internal metadata storage for validation rules.
 *
 * Rules are registered per-class via the `@Verify*` decorators and
 * read by {@link ValidationEngine} during `validate()`. Storage is
 * keyed by the class constructor, and the engine walks the prototype
 * chain so subclasses inherit their parents' rules.
 */

/**
 * Context passed to a rule's {@link check} and message functions.
 */
export interface ValidationContext<TOptions = unknown> {
    /**
     * The object carrying the property under validation.
     */
    readonly target: object;

    /**
     * The property name under validation.
     */
    readonly property: string;

    /**
     * The value under validation — for value-level rules this is
     * the individual element (auto-iterated if the property is an
     * array); for array-level rules this is the whole array.
     */
    readonly value: unknown;

    /**
     * Options the decorator was applied with.
     */
    readonly options: TOptions;
}

/**
 * The outcome of a rule's {@link check}:
 * - `true` — value passes the rule.
 * - `false` — value fails; the engine uses the rule's default message.
 * - `string` — value fails with a custom inline message.
 */
export type RuleCheckResult = boolean | string;

/**
 * A single rule definition captured when the decorator is registered.
 *
 * Stored against (targetConstructor, propertyName) and looked up by
 * the engine for each property on the class.
 */
export interface RuleMetadata {
    readonly target: Function;
    readonly propertyName: string;
    readonly ruleName: string;
    readonly operatesOn: 'value' | 'array';
    readonly options: unknown;
    readonly check: (
        value: unknown,
        options: unknown,
        context: ValidationContext,
    ) => RuleCheckResult;
    readonly message: (context: ValidationContext) => string;
}

/**
 * Central registry of validation rules, keyed by class constructor.
 *
 * Hangs off {@link BaseMetadata} as `.validation` alongside the other
 * framework-level metadata stores (GraphQL, middleware, scheduled,
 * etc.). Never expose the stored {@link RuleMetadata} objects outside
 * the validation engine — they carry raw `check` functions, which are
 * framework internals.
 */
export class ValidationMetadata {
    private readonly byTarget = new WeakMap<Function, RuleMetadata[]>();
    // Kept alongside `byTarget` so we can enumerate every class that
    // has at least one registered rule — `WeakMap` is not iterable.
    // The strong reference here is fine: class constructors live for
    // the entire process in all realistic validator use cases.
    private readonly targets: Function[] = [];

    /**
     * Record a rule for later use by `validate()`.
     */
    add(meta: RuleMetadata): void {
        let list = this.byTarget.get(meta.target);
        if (!list) {
            list = [];
            this.byTarget.set(meta.target, list);
            this.targets.push(meta.target);
        }
        list.push(meta);
    }

    /**
     * Every class constructor for which at least one rule has been
     * registered. Order matches insertion order.
     *
     * Used by the CLI to resolve a type name (e.g. a GraphQL input
     * type) back to its validatable class.
     */
    getRegisteredTargets(): readonly Function[] {
        return this.targets;
    }

    /**
     * Return every rule that applies to `target`, walking the
     * prototype chain so subclasses inherit their parents' rules.
     */
    getAllFor(target: Function): RuleMetadata[] {
        const collected: RuleMetadata[] = [];
        let current: Function | null = target;
        while (
            current &&
            current !== Object &&
            current !== Function.prototype
        ) {
            const own = this.byTarget.get(current);
            if (own) {
                collected.push(...own);
            }
            current = Object.getPrototypeOf(current);
        }
        return collected;
    }

    /**
     * True if `target` (or any ancestor) has at least one registered rule.
     *
     * Used by the engine to decide whether to recurse into a nested
     * class instance.
     */
    has(target: Function): boolean {
        let current: Function | null = target;
        while (
            current &&
            current !== Object &&
            current !== Function.prototype
        ) {
            if (this.byTarget.has(current)) {
                return true;
            }
            current = Object.getPrototypeOf(current);
        }
        return false;
    }
}
