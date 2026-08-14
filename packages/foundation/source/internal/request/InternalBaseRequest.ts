// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export namespace InternalBaseRequest {
    export const HostNameSuffix = '.base-internal';

    export function getInternalHostName(origin: string): string {
        return `${origin}${HostNameSuffix}`;
    }
}
