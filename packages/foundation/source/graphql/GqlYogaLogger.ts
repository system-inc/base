// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';

/**
 * The shape of Yoga's `logging` option: one sink per level, each taking
 * console-style arguments. Declared here so the provider does not reach
 * into `@graphql-yoga/logger`, a transitive dependency.
 */
export type GqlYogaLogger = Record<
    'debug' | 'info' | 'warn' | 'error',
    (...args: unknown[]) => void
>;

/**
 * Routes Yoga's own log output through the framework Logger under the
 * `gql` category, so `LOG_LEVEL` governs it like everything else the
 * worker emits.
 *
 * Yoga's `error` channel is demoted to debug. Yoga calls it from its
 * masked-errors wrapper for every resolver error whose mask function
 * returned a new object, which `gqlMaskError` always does, so it fires for
 * expected client errors (a 404 from a lookup, a validation failure) as
 * well as for real failures. `gqlMaskError` already logs the real failures,
 * the masked 5xx errors, at error level; letting Yoga log too would report
 * every 4xx as an error with a stack trace.
 */
export const gqlYogaLogger: GqlYogaLogger = {
    debug: (...args) => Logger.debug(LogCategory.Gql, ...toLogArguments(args)),
    info: (...args) => Logger.info(LogCategory.Gql, ...toLogArguments(args)),
    warn: (...args) => Logger.warn(LogCategory.Gql, ...toLogArguments(args)),
    error: (...args) => Logger.debug(LogCategory.Gql, ...toLogArguments(args)),
};

/**
 * The Logger takes a message string first; Yoga may lead with an Error or
 * any other value, which is then formatted as `%o`.
 */
function toLogArguments(args: unknown[]): [string, ...unknown[]] {
    const [first, ...rest] = args;
    if (typeof first === 'string') {
        return [first, ...rest];
    }
    return ['%o', ...args];
}
