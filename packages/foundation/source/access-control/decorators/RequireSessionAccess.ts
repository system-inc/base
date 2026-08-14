// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { useSessionAccess } from '../../internal/access-control/UseSessionAccess';
import { SessionAccessRequirements } from '../SessionAccessRequirements';

/**
 * Enables session based access control for a class or method.
 * If a valid session is not present, the resource will return a 401 Unauthorized response.
 *
 * @param requirements
 * @returns
 */
export function RequireSessionAccess(
    requirements?: SessionAccessRequirements,
): ClassDecorator & MethodDecorator {
    return function (
        target: object | Function,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor,
    ) {
        useSessionAccess(target, propertyKey, descriptor, {
            ...requirements,
            skipAuthorization: false, // ensure that the user can access the resource with authorization
        });
    };
}
