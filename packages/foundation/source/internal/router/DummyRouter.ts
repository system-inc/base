// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Route, RouterType } from 'itty-router';

/**
 * Creates a dummy router to fake the Itty Router.
 *
 * @returns
 */
export function DummyRouter(): RouterType<Route, any> {
    return new IttyDummyRouter() as unknown as RouterType<Route, any>;
}

/**
 * DummyRouter to fake the Itty Router.
 *
 * We need this because the Itty Router fails in the CLI.
 *
 * All operations are no-ops.
 *
 * @returns
 */
export class IttyDummyRouter {
    all() {}
    ALL() {}
    delete() {}
    DELETE() {}
    get() {}
    GET() {}
    head() {}
    HEAD() {}
    options() {}
    OPTIONS() {}
    patch() {}
    PATCH() {}
    post() {}
    POST() {}
    put() {}
    PUT() {}
}
