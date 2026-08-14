// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { JsonObject } from '../../json/Json';
import { StrictJsonInterface } from '../../json/StrictJson';

/**
 * A JSON-serializable representation of a BaseError.
 */
export type BaseErrorData = StrictJsonInterface<{
    /**
     * The name of the error type.
     */
    readonly name: string;

    /**
     * The error message.
     */
    readonly message: string;

    /**
     * The HTTP status code associated with the error.
     */
    readonly statusCode: number;

    /**
     * The stack trace of the error.
     */
    readonly stack?: string;

    /**
     * Application-specific error code for programmatic error handling.
     */
    readonly errorCode?: string;

    /**
     * The underlying cause of the error.
     */
    readonly cause?: BaseErrorData;

    /**
     * Any additional information related to the error.
     */
    readonly extensions?: Readonly<JsonObject>;
}>;

/**
 * Determines if the given error data is a BaseErrorData.
 *
 * @param error The error to check.
 * @returns
 */
export function isBaseErrorData(error: unknown): error is BaseErrorData {
    if (typeof error !== 'object' || error === null) {
        return false;
    }
    const baseError = error as BaseErrorData;
    return (
        typeof baseError.name === 'string' &&
        typeof baseError.message === 'string' &&
        typeof baseError.statusCode === 'number'
    );
}
