// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any) => any;

type NonFnKeys<T> = {
    [K in keyof T]-?: T[K] extends AnyFn ? never : K;
}[keyof T];

export type OrmEntityKey<T> = Extract<NonFnKeys<T>, string>;

export type OrmEntityKeys<T> = Array<Extract<NonFnKeys<T>, string>>;

export type OrmPartialEntity<T> = Partial<Pick<T, NonFnKeys<T>>>;

export type OrmPartialEntityAs<T, V> = Partial<Record<NonFnKeys<T>, V>>;
