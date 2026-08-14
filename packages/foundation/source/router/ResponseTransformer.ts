// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RequestContext } from '../request/RequestContext';

/**
 * Interface for response transformers.
 */
export interface ResponseTransformer {
    /**
     * Transforms the response from the route handler.
     *
     * @param response
     * @returns
     */
    transformResponse(
        response: Response,
        request?: RequestContext,
    ): Response | Promise<Response>;
}
