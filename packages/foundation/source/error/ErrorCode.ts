// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * There was a validation error with the provided data.
 */
export const ERROR_CODE_VALIDATION_ERROR = 'VALIDATION_ERROR';

/**
 * There was a validation error with the provided data.
 */
export const ERROR_CODE_SERIALIZATION_ERROR = 'SERIALIZATION_ERROR';

/**
 * The provided data is of an invalid type.
 */
export const ERROR_CODE_INVALID_TYPE = 'INVALID_TYPE';

/**
 * The quota for the operation has been exceeded.
 */
export const ERROR_CODE_QUOTA_EXCEEDED = 'QUOTA_EXCEEDED';

/**
 * The requested resource was not found.
 */
export const ERROR_CODE_NOT_FOUND = 'NOT_FOUND';

/**
 * The resource already exists.
 */
export const ERROR_CODE_ALREADY_EXISTS = 'ALREADY_EXISTS';

/**
 * A user must be authenticated to perform an operation.
 *
 * Produced by the access-control middleware when a handler requires
 * authorization (`@RequireSessionAccess`) and no session resolves.
 */
export const ERROR_CODE_AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED';

/**
 * The user does not have sufficient access roles to access a resource.
 *
 * This is different from insufficient entitlements, as access roles
 * are assigned by an administrator or system, rather than the user
 * themselves, and will typically require intervention from support
 * or an administrator to resolve.
 */
export const ERROR_CODE_PERMISSION_DENIED = 'PERMISSION_DENIED';

/**
 * The user does not have sufficient entitlements, e.g.
 * a plan or membership to access a resource.
 *
 * The entitlements are something the user can remedy by upgrading
 * themselves by doing something on the website or similar.
 */
export const ERROR_CODE_INSUFFICIENT_ENTITLEMENTS = 'INSUFFICIENT_ENTITLEMENTS';

/**
 * Framework-level error codes. Modules and applications extend this by
 * unioning in their own error code types:
 *
 * ```ts
 * // Pull module error codes
 * type MyCodes = ErrorCode | AccountErrorCode | AccessLogErrorCode;
 *
 * // Or add application-specific ones
 * type MyAppErrors = ErrorCode | 'CUSTOM_ERROR' | 'BACKEND_ERROR';
 *
 * // Use with HttpErrors
 * HttpErrors.badRequest<MyCodes>({ errorCode: 'CUSTOM_ERROR' });
 * ```
 *
 * Designed to be tree-shakeable — only imported error code constants
 * are included in the final bundle.
 */
export type ErrorCode =
    | typeof ERROR_CODE_VALIDATION_ERROR
    | typeof ERROR_CODE_SERIALIZATION_ERROR
    | typeof ERROR_CODE_INVALID_TYPE
    | typeof ERROR_CODE_QUOTA_EXCEEDED
    | typeof ERROR_CODE_NOT_FOUND
    | typeof ERROR_CODE_ALREADY_EXISTS
    | typeof ERROR_CODE_AUTHENTICATION_REQUIRED
    | typeof ERROR_CODE_PERMISSION_DENIED
    | typeof ERROR_CODE_INSUFFICIENT_ENTITLEMENTS;
