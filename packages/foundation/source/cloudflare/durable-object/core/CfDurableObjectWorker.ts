// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { EnvironmentVariables } from '../../../configuration/EnvironmentVariables';
import { ExecutionModeType } from '../../../configuration/ExecutionMode';
import { HttpErrors } from '../../../error/HttpErrors';
import { CfContainer } from '../container/core/CfContainer';
import { CfDurableObject } from './CfDurableObject';

/**
 * This class is a shim for the worker fetch entry point. In production it does nothing,
 * other than provide a required fetch method for the worker. In Base project Durable Objects
 * are deployed as separate workers to avoid meta cross contamination, so this class faciliates that.
 *
 * In development this forwards all the requests to the durable object for local development.
 * This is useful if you want to talk to a durable object directly during, e.g. fetch directly
 * rather than through a seperate script bindings.
 */
export class CfDurableObjectWorker {
    private durableObjectType: string;

    constructor(
        doConstructor: Constructor<CfDurableObject> | Constructor<CfContainer>,
        private readonly forwardingEnvironments: string[] = [],
    ) {
        this.durableObjectType = doConstructor.name;
    }

    fetch = async (
        request: Request,
        environmentVariables: EnvironmentVariables,
        _executionContext: ExecutionContext,
    ): Promise<Response> => {
        let shouldForward = false;
        if (
            environmentVariables.ENVIRONMENT &&
            this.forwardingEnvironments.length > 0
        ) {
            shouldForward = this.forwardingEnvironments.includes(
                environmentVariables.ENVIRONMENT,
            );
        } else {
            shouldForward =
                environmentVariables.EXECUTION_MODE === ExecutionModeType.Local;
        }

        // if we are running locally we want to forward all requests to the DO
        if (shouldForward) {
            // get the durable object from the environment variables
            const objectContainer: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                [key: string]: any;
            } = environmentVariables;
            const id = objectContainer[this.durableObjectType].idFromName(
                this.durableObjectType,
            );
            const stub = objectContainer[this.durableObjectType].get(id);
            Logger.debug(
                LogCategory.Durable,
                'Forwarding request to durable object %s',
                this.durableObjectType,
            );
            return await stub.fetch(request);
        }
        throw HttpErrors.notFound();
    };
}
