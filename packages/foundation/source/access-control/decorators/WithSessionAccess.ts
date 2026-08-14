// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { useSessionAccess } from '../../internal/access-control/UseSessionAccess';
import { SessionAccessRequirements } from '../SessionAccessRequirements';

/**
 * Enables session based access control for a class or method.
 *
 * The session is loaded into the request context if the user is
 * authenticated, but an anonymous request is not rejected.
 *
 * @param requirements
 * @returns
 */
export function WithSessionAccess(
    requirements?: SessionAccessRequirements,
): ClassDecorator & MethodDecorator {
    return function (
        target: object | Function,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor,
    ) {
        useSessionAccess(target, propertyKey, descriptor, {
            ...requirements,
            skipAuthorization: true, // ensure that the user can access the resource without authorization
        });
    };
}
