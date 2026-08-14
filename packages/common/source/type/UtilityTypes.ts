// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Enforces that at least one of the keys in `Keys` is required.
 *
 * See this stackoverflow answer for more details:
 * https://stackoverflow.com/a/49725198/243654
 */
export type RequireAny<T, Keys extends keyof T = keyof T> = Pick<
    T,
    Exclude<keyof T, Keys>
> &
    {
        [K in Keys]-?: Required<Pick<T, K>> &
            Partial<Pick<T, Exclude<Keys, K>>>;
    }[Keys];

/**
 * Makes all properties in T mutable.
 */
export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * Adds a property to a type T, with property name K, and property value type V.
 */
export type AddProperty<T, K extends string, V> = T & {
    [P in K]: V;
};

/**
 * Adds a property to a type T, with property name K, and property value type V.
 */
export type AddOptionalProperty<T, K extends string, V> = T & {
    [P in K]: V | undefined;
};

/**
 * Makes type T able to accept index operator '[]' to access any property.
 */
export type GenericTrap<T> = T & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
};

/**
 * Creates a method decorator that enforces the return type of the method.
 */
export type TypedMethodDecorator<T> = (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
) => void;

/**
 * Creates a type by extracting all the public properties of type T.
 */
export type PropertyInterface<T> = {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

export type RequireOnlyOne<T, Keys extends keyof T> = {
    [K in Keys]: Pick<T, K> & Partial<Record<Exclude<Keys, K>, never>>;
}[Keys] &
    Omit<T, Keys>;

/**
 * Used to create a type that requires all the properties of T or U, but not both.
 */
export type ExclusiveOr<T, U> =
    | (T & Partial<Record<Exclude<keyof U, keyof T>, never>>)
    | (U & Partial<Record<Exclude<keyof T, keyof U>, never>>);

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type EmptyInterface = {};

/**
 * Used to create a type that makes all properties of T optional, except for the ones in K.
 */
export type PartialWithRequired<T, K extends keyof T> = Partial<T> & Pick<T, K>;

export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
    Partial<Pick<T, K>>;

/**
 * Marks all properties in T as optional, except for the ones in K.
 */
export type RequireOnly<T, K extends keyof T> = Partial<T> &
    Required<Pick<T, K>>;
