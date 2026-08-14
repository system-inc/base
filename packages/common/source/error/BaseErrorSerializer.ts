// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpStatus, HttpStatusCode } from '../http/HttpStatus';
import { Dictionary } from '../type/Dictionary';
import { Mutable } from '../type/UtilityTypes';
import { BaseErrorData } from './interfaces/BaseErrorData';
import {
    BaseErrorDataType,
    isBaseErrorDataType,
} from './interfaces/BaseErrorDataType';

/**
 * A serializable data representation of a BaseError.
 * Can be used for storage or transmission.
 */
export class BaseErrorSerializer {
    readonly error: BaseErrorDataType;

    constructor(error: unknown) {
        this.error = normalizeToErrorData(error);
    }

    /**
     * Serializes the error, with options for masking details.
     *
     * @returns Serialized error object safe for client consumption.
     */
    toJSON(): BaseErrorDataType {
        return this.toClientErrorData();
    }

    /**
     * Serializes the error to a safe client-facing representation.
     * Excludes sensitive details like stack traces and sanitizes error messages
     * to remove potentially sensitive information (e.g., SQL queries, bind variables).
     *
     * @returns Sanitized error safe for external consumption.
     */
    toClientErrorData(mask: boolean = false): BaseErrorDataType {
        return this.serializeClientErrorData(mask, new WeakSet());
    }

    /**
     * Walks the cause chain, guarding against cycles. `normalizeToErrorData`
     * only de-cycles causes it rebuilds — an already-`BaseErrorData`-shaped
     * error is returned as-is, so a cyclic cause chain survives into
     * serialization and would recurse until the stack overflows. Tracking the
     * cause objects seen so far breaks the cycle here regardless of shape.
     */
    private serializeClientErrorData(
        mask: boolean,
        seen: WeakSet<object>,
    ): BaseErrorDataType {
        seen.add(this.error);

        const baseError: Mutable<BaseErrorData> = {
            name: this.error.name,
            statusCode: this.error.statusCode,
            message: mask
                ? HttpStatus.getMessage(this.error.statusCode)
                : sanitizeErrorMessage(this.error.message),
            errorCode: this.error.errorCode,
        };

        if (this.error.cause) {
            baseError.cause = seen.has(this.error.cause)
                ? createBaseErrorData(
                      'Circular reference detected in error cause chain',
                  )
                : new BaseErrorSerializer(
                      this.error.cause,
                  ).serializeClientErrorData(mask, seen);
        }

        if (this.error.extensions) {
            baseError.extensions = this.error.extensions;
        }

        return baseError;
    }
}

/**
 * Converts an unknown error to a BaseErrorDataType.
 * Similar to BaseError.normalize but returns serialized data instead of an error instance.
 *
 * @param error The error to normalize.
 * @param seen WeakSet to track visited objects for circular reference detection
 * @returns A BaseErrorDataType object
 */
function normalizeToErrorData(
    error: unknown,
    seen?: WeakSet<object>,
): BaseErrorDataType {
    // If it's already a valid BaseErrorDataType, return it
    if (isBaseErrorDataType(error)) {
        return error;
    }

    // Handle primitives
    if (typeof error === 'string') {
        return createBaseErrorData(error);
    }

    if (typeof error === 'number') {
        return createBaseErrorData(`Numeric error: ${error}`);
    }

    if (typeof error === 'boolean') {
        return createBaseErrorData(`Boolean error: ${error}`);
    }

    if (typeof error === 'bigint') {
        return createBaseErrorData(`BigInt error: ${error.toString()}`);
    }

    if (typeof error === 'symbol') {
        return createBaseErrorData(error.toString());
    }

    if (typeof error === 'function') {
        return createBaseErrorData(
            `Function error: ${error.name || 'anonymous'}`,
        );
    }

    // Handle objects (including null)
    if (typeof error === 'object') {
        if (error === null) {
            return createBaseErrorData('Null error');
        }

        // Initialize seen set on first call
        if (!seen) {
            seen = new WeakSet();
        }

        // Check for circular reference
        if (seen.has(error)) {
            return createBaseErrorData(
                'Circular reference detected in error cause chain',
            );
        }

        // Mark this object as visited
        seen.add(error);

        let message: string = 'Unknown Error';
        let name: string = 'Error';
        let statusCode: HttpStatusCode = HttpStatusCode.InternalServerError;
        let stack: string | undefined;
        let errorCode: string | undefined;
        let extensions: Dictionary<string> | undefined;
        let cause: BaseErrorDataType | undefined;

        if ('message' in error && typeof error.message === 'string') {
            message = error.message;
        }

        if ('name' in error && typeof error.name === 'string') {
            name = error.name;
        }

        if ('stack' in error && typeof error.stack === 'string') {
            stack = error.stack;
        }

        if ('statusCode' in error && typeof error.statusCode === 'number') {
            // Validate it's a valid HTTP status code
            if (HttpStatus.isValidHttpStatus(error.statusCode)) {
                statusCode = error.statusCode;
            }
        }

        if ('errorCode' in error && typeof error.errorCode === 'string') {
            errorCode = error.errorCode;
        }

        if (
            'extensions' in error &&
            typeof error.extensions === 'object' &&
            error.extensions !== null
        ) {
            // Validate that extensions is a Dictionary<string>
            if (isDictionaryOfStrings(error.extensions)) {
                extensions = error.extensions;
            }
        }

        if ('cause' in error) {
            // Pass seen set to detect circular references in cause chain
            cause = normalizeToErrorData(error.cause, seen);
        }

        return {
            name,
            message,
            statusCode,
            stack,
            errorCode,
            extensions: extensions,
            cause,
        };
    }

    // Unknown type - create an UnknownValueError-like data
    try {
        return createBaseErrorData(
            `Unknown value caught error: ${String(error)}`,
        );
    } catch {
        return createBaseErrorData('Unknown value caught error');
    }
}

/**
 * Helper to create a basic BaseErrorData object.
 */
function createBaseErrorData(message: string): BaseErrorData {
    return {
        name: 'Error',
        message,
        statusCode: HttpStatusCode.InternalServerError,
    };
}

/**
 * Type guard to validate that an object is a Dictionary<string>
 */
function isDictionaryOfStrings(obj: object): obj is Dictionary<string> {
    return Object.values(obj).every((value) => typeof value === 'string');
}

/**
 * Sanitizes an error message for client consumption by applying
 * various redaction rules to remove sensitive information.
 *
 * @param message The error message to sanitize
 * @returns The sanitized message safe for client consumption
 */
function sanitizeErrorMessage(message: string): string {
    return redactDatabaseErrorMessage(message);
}

/**
 * Redacts sensitive information from database error messages.
 * Removes SQL queries, bind variables, and other sensitive details while preserving
 * the error type and description.
 *
 * @param message The error message to redact
 * @returns The redacted message
 */
function redactDatabaseErrorMessage(message: string): string {
    // Check if this is a database error message
    if (!message.startsWith('DatabaseError:')) {
        return message;
    }

    // Find the "desc =" portion which contains the user-friendly description
    const descMatch = message.match(/desc\s*=\s*([^(]+)/);
    if (descMatch) {
        // Return a sanitized version with just the error type and description
        return `DatabaseError: ${descMatch[1].trim()}`;
    }

    // If we can't parse it, return a generic database error message
    return 'DatabaseError: A database error occurred';
}
