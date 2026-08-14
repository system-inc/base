// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Request as CloudflareRequest } from '@cloudflare/workers-types';

import { cfPrepareRequest } from '@system-inc/base-common/cloudflare/CloudflareRequest';
import { getGlobalVariable } from '@system-inc/base-common/global/Global';
import { CF_HEADER_IP_ADDRESS } from '@system-inc/base-common/http/HttpHeaders';
import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { BaseWorkerPlatformDelegate } from '../../worker/BaseWorkerPlatformDelegate';

export class CloudflarePlatformDelegate implements BaseWorkerPlatformDelegate<
    Partial<IncomingRequestCfProperties>
> {
    initializePlatform(
        _configuration: BaseConfiguration,
    ): void | Promise<void> {
        patchFetchForCloudflare();
    }

    getRequestIpAddress(request: Request): string | undefined {
        return request.headers.get(CF_HEADER_IP_ADDRESS) || undefined;
    }

    getPlatformRequestProperties(
        request: Request,
    ): Partial<IncomingRequestCfProperties<unknown>> | undefined {
        if ('cf' in request) {
            return (request as unknown as CloudflareRequest).cf;
        }
    }
}

/**
 * We have to patch the fetch call to remove any cache options because
 * they currently aren't implemented by Cloudflare Workers.
 * PlanetScale driver uses the cache option so we have to remove it.
 * https://github.com/cloudflare/workerd/issues/698
 */
export function patchFetchForCloudflare() {
    const global = getGlobalVariable();
    if (!global.originalFetch) {
        global.originalFetch = global.fetch;
        global.fetch = (
            request: unknown,
            init?: RequestInit,
        ): Promise<Response> => {
            return global.originalFetch(request, cfPrepareRequest(init, false));
        };
    }
}
