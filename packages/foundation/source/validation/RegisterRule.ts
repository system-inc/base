// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getBaseMetadata } from '../base/BaseMetadata';
import {
    RuleCheckResult,
    ValidationContext,
} from '../internal/metadata/ValidationMetadata';

/**
 * Definition a rule author provides to {@link registerRule}.
 */
export interface RuleDefinition<TOptions> {
    /**
     * Rule name surfaced in `ValidationError.constraints` (e.g.
     * `"IsString"`, `"MaxLength"`). Conventionally matches the
     * decorator's function name minus the `Verify` prefix.
     */
    readonly name: string;

    /**
     * How the rule handles arrays.
     *
     * - `"value"` (default) — value-level rule. When the decorated
     *   property holds an array, the engine applies `check` to each
     *   element. Error paths include the index (`items[2]`). Use
     *   this for rules like `IsString`, `IsEmail`, `MaxLength`.
     *
     * - `"array"` — array-level rule. The engine passes the array
     *   through to `check` without iterating. Use this for rules
     *   that describe the array itself, e.g. `IsArray`,
     *   `ArrayMinSize`, `ArrayNotEmpty`.
     */
    readonly operatesOn?: 'value' | 'array';

    /**
     * The validation predicate. Return `true` to pass, `false` to
     * fail with the default message, or a `string` to fail with a
     * custom message.
     */
    readonly check: (
        value: unknown,
        options: TOptions,
        context: ValidationContext<TOptions>,
    ) => RuleCheckResult;

    /**
     * Default human-readable message. Can be a literal string (use
     * `$property` to interpolate the property name) or a function
     * receiving the validation context.
     */
    readonly defaultMessage:
        | string
        | ((context: ValidationContext<TOptions>) => string);
}

/**
 * A decorator factory for a no-options validation rule. Callable to
 * attach the rule; exposes a `.check(value)` predicate for ad-hoc
 * use outside of a decorator context (services, VerifyIf conditions,
 * unit tests).
 */
export interface VoidRuleDecorator {
    (): PropertyDecorator;
    check(value: unknown): boolean;
}

/**
 * A decorator factory for an options-bearing validation rule.
 * `.check(value, options)` runs the same predicate the decorator
 * would apply, for direct use outside of a class field.
 */
export interface OptionsRuleDecorator<TOptions> {
    (options: TOptions): PropertyDecorator;
    check(value: unknown, options: TOptions): boolean;
}

/**
 * Resolves to the right decorator shape for the given options type.
 */
export type RuleDecorator<TOptions> = [TOptions] extends [void]
    ? VoidRuleDecorator
    : OptionsRuleDecorator<TOptions>;

/**
 * Creates a property decorator for a validation rule.
 *
 * The returned factory is callable (`VerifyIsEmail()` / `VerifyMaxLength(255)`)
 * and also exposes a `.check()` predicate for ad-hoc use:
 *
 * ```ts
 * VerifyIsEmail.check('foo@bar.com');       // true
 * VerifyMaxLength.check('abc', 255);         // true
 * ```
 *
 * Usage:
 * ```ts
 * // No options:
 * export const VerifyIsString = registerRule<void>({
 *     name: 'IsString',
 *     check: (value) => typeof value === 'string',
 *     defaultMessage: ({ property }) => `${property} must be a string`,
 * });
 *
 * // With options:
 * export const VerifyMaxLength = registerRule<number>({
 *     name: 'MaxLength',
 *     check: (value, max) =>
 *         typeof value === 'string' && value.length <= max,
 *     defaultMessage: ({ property, options }) =>
 *         `${property} must be at most ${options} characters`,
 * });
 *
 * // Array-level:
 * export const VerifyArrayMinSize = registerRule<number>({
 *     name: 'ArrayMinSize',
 *     operatesOn: 'array',
 *     check: (value, min) => Array.isArray(value) && value.length >= min,
 *     defaultMessage: ({ property, options }) =>
 *         `${property} must contain at least ${options} elements`,
 * });
 * ```
 */
export function registerRule<TOptions = void>(
    definition: RuleDefinition<TOptions>,
): RuleDecorator<TOptions> {
    const operatesOn = definition.operatesOn ?? 'value';
    const defaultMessage = definition.defaultMessage;

    const factory = (options?: TOptions): PropertyDecorator => {
        return (target: object, propertyName: string | symbol) => {
            getBaseMetadata().validation.add({
                target: target.constructor,
                propertyName: String(propertyName),
                ruleName: definition.name,
                operatesOn,
                options: options as unknown,
                check: definition.check as (
                    value: unknown,
                    options: unknown,
                    context: ValidationContext,
                ) => RuleCheckResult,
                message: (context) => {
                    if (typeof defaultMessage === 'function') {
                        return defaultMessage(
                            context as ValidationContext<TOptions>,
                        );
                    }
                    return defaultMessage.replace(
                        /\$property/g,
                        context.property,
                    );
                },
            });
        };
    };

    // The standalone predicate. Called outside a decorator context, so
    // the enclosing target/property are unavailable — we pass a
    // minimal context. A rule's `check` may return a string on
    // failure (a custom message); from the predicate's point of view
    // that's still a failure, so only `=== true` counts as a pass.
    factory.check = (value: unknown, options?: TOptions): boolean => {
        const effectiveOptions = options as TOptions;
        const result = definition.check(value, effectiveOptions, {
            target: {},
            property: '',
            value,
            options: effectiveOptions,
        });
        return result === true;
    };

    return factory as unknown as RuleDecorator<TOptions>;
}
