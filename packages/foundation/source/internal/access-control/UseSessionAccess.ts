// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { SessionAccessOptions } from '../../access-control/SessionAccessOptions';
import { getAccessControlMetadata } from './AccessControlMetadata';

export function useSessionAccess(
    target: object | Function,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
    options?: SessionAccessOptions,
) {
    if (!options) {
        options = {};
    }

    if (target && propertyKey && descriptor) {
        // we are decorating a method — key by the owning class constructor
        // (target is its prototype) so same-named classes never collide
        const handler = BaseHandler.fromDecorator(target, propertyKey);
        getAccessControlMetadata().addMethodSessionAccessOptions(
            handler.target,
            handler.methodName,
            options,
        );
    } else {
        // we are decorating a class — target is the constructor itself
        getAccessControlMetadata().addClassSessionAccessOptions(
            target as unknown as Constructor<object>,
            options,
        );
    }
}
