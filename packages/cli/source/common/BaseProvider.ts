// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import type { Arguments } from 'yargs';

import { Base } from '@system-inc/base-foundation/base/Base';
import { EnvironmentType } from '@system-inc/base-foundation/configuration/Environment';
import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { ExecutionModeType } from '@system-inc/base-foundation/configuration/ExecutionMode';
// eslint-disable-next-line nexus/no-internal-imports-rule
import { createWorkerContainer } from '@system-inc/base-foundation/internal/dependency-injection/InjectionContainers';
import { BaseWorkerContext } from '@system-inc/base-foundation/worker/BaseWorkerContext';
import {
    BaseSettingsModule,
    BaseWorkerProject,
} from '../project/BaseWorkerProject';

/**
 * Provides instances Base to the CLI, bound to a specific project/worker.
 */
export class BaseProvider {
    private readonly environment: string;

    constructor(private readonly args: Arguments) {
        this.environment =
            typeof args.environment === 'string'
                ? args.environment
                : EnvironmentType.Development;
    }

    get project(): BaseWorkerProject {
        if (!this._project) {
            this._project = BaseWorkerProject.create(this.args);
        }
        return this._project;
    }
    private _project: BaseWorkerProject | undefined;

    private _base: Base | undefined;

    /**
     * The instance of Base for the CLI to use.
     */
    async getBase(): Promise<Base> {
        if (!this._base) {
            this._base = await this.createBase();
        }
        return this._base;
    }

    async createBase(): Promise<Base> {
        // check if the worker folder exists
        if (!fs.existsSync(this.project.workerFolder)) {
            console.error('Worker not found: ', this.project.workerFolder);
            process.exit(1);
        }

        // Load settings and environment if they were passed in
        const [environmentVariables] = this.project.loadEnvironmentVariables(
            this.environment,
            {
                EXECUTION_MODE: ExecutionModeType.CommandLine,
            } satisfies EnvironmentVariables,
        );
        const settings = await this.project.loadSettingsModule(
            this.environment,
        );
        return new Base(
            new BaseWorkerContext(
                environmentVariables,
                settings.settings,
                createWorkerContainer(),
            ),
        );
    }

    loadSettings(): Promise<BaseSettingsModule> {
        return this.project.loadSettingsModule(this.environment);
    }
}
