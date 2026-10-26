// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '../base/BaseSettings';
import { BaseWorker } from '../worker/BaseWorker';
import { Environment, EnvironmentType } from './Environment';

/**
 * A missing ENVIRONMENT used to fall back to Development — so a worker
 * deployed without it served GraphiQL and schema introspection in
 * production. Base no longer picks an environment for you.
 */
describe('ENVIRONMENT is required', () => {
    it('refuses a missing or empty environment', () => {
        expect(() => new Environment(undefined)).toThrow(
            /ENVIRONMENT is not set/,
        );
        expect(() => new Environment('')).toThrow(/ENVIRONMENT is not set/);
        expect(() => new Environment('   ')).toThrow(/ENVIRONMENT is not set/);
    });

    it('normalizes the two semantic names and keeps custom names verbatim', () => {
        expect(new Environment('production').type).toBe(
            EnvironmentType.Production,
        );
        expect(new Environment('DEVELOPMENT').type).toBe(
            EnvironmentType.Development,
        );
        expect(new Environment('Staging').type).toBe('Staging');
    });

    it('fails the worker at boot rather than serving as Development', async () => {
        const settings: BaseSettings = {
            name: 'no-environment',
            title: 'No Environment',
            version: '1.0.0',
            modules: [],
        };
        const worker = BaseWorker.create(settings);

        // every event initializes first, so no request is ever served
        await expect(
            worker.getBase({ PLATFORM: 'Node' } as never).initialize(),
        ).rejects.toThrow(/ENVIRONMENT is not set/);
    });
});
