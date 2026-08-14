// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '../base/BaseSettings';
import { Injectable } from '../dependency-injection/decorators/Injectable';
import { BaseModule } from '../module/BaseModule';
import { OrmDatabase } from '../orm/database/OrmDatabase';
import { InjectDatabase } from '../orm/decorators/InjectDatabase';
import { BaseAppManifest } from './BaseAppManifest';
import { BaseConfiguration } from './BaseConfiguration';
import { BaseModuleKey } from './BaseModuleKey';
import { EnvironmentVariables } from './EnvironmentVariables';

const FilesKey = BaseModuleKey.create('MdrFiles');
const BillingKey = BaseModuleKey.create('MdrBilling');
const UnregisteredKey = BaseModuleKey.create('MdrNowhere');

function filesModule(
    services?: Parameters<typeof BaseModule.create>[0]['settings']['services'],
) {
    return BaseModule.create({
        key: FilesKey,
        settings: { services },
    });
}

function billingModule(
    services?: Parameters<typeof BaseModule.create>[0]['settings']['services'],
) {
    return BaseModule.create({
        key: BillingKey,
        settings: { services },
    });
}

function makeConfiguration(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modules: BaseModule<any>[],
    orm?: Record<string, object>,
): BaseConfiguration {
    return new BaseConfiguration(
        {} as EnvironmentVariables,
        {
            name: 'mdr-test',
            title: 'Module Database Resolution Test',
            version: '1.0.0',
            modules,
            orm,
        } as unknown as BaseSettings,
    );
}

const singleDatabase = { '@default': {} };
const multiDatabase = { '@default': {}, connected: {} };

describe('module database resolution ladder', () => {
    it('resolves a declared member to its module database, honoring the worker override', () => {
        @Injectable(FilesKey)
        class Helper {}

        const configuration = makeConfiguration(
            [filesModule().with({ database: 'connected' })],
            multiDatabase,
        );
        expect(configuration.getDatabaseNameForClass(Helper)).toBe('connected');
    });

    it('resolves a declared member of a default-database module to @default', () => {
        @Injectable(FilesKey)
        class Helper {}

        const configuration = makeConfiguration(
            [filesModule()],
            singleDatabase,
        );
        expect(configuration.getDatabaseNameForClass(Helper)).toBe('@default');
    });

    it('resolves a module member to the single non-default database (the default in spirit)', () => {
        @Injectable(FilesKey)
        class Helper {}

        // one database configured under a non-default name — a module that
        // declares no database must resolve here, not a phantom '@default'
        const configuration = makeConfiguration([filesModule()], {
            primary: {},
        });
        expect(configuration.getDatabaseNameForClass(Helper)).toBe('primary');
    });

    it('throws when the declared module is not registered in the worker', () => {
        @Injectable(UnregisteredKey)
        class Helper {}

        const configuration = makeConfiguration(
            [filesModule()],
            singleDatabase,
        );
        expect(() => configuration.getDatabaseNameForClass(Helper)).toThrow(
            /no module with that name is registered/,
        );
    });

    it('ignores registration for resolution — an undeclared registered class resolves to default', () => {
        // Registration is discovery/exposure, not attribution. (A registered
        // class like this one that also carried token-less ORM injections
        // would be rejected at boot instead — see the validation suite.)
        @Injectable()
        class RegisteredService {}

        const configuration = makeConfiguration(
            [
                filesModule([RegisteredService]).with({
                    database: 'connected',
                }),
            ],
            multiDatabase,
        );
        expect(configuration.getDatabaseNameForClass(RegisteredService)).toBe(
            '@default',
        );
    });

    it('declared membership wins over an explicit binding-free default in a single-database worker', () => {
        @Injectable()
        class Unattributed {}

        const configuration = makeConfiguration(
            [filesModule()],
            singleDatabase,
        );
        expect(configuration.getDatabaseNameForClass(Unattributed)).toBe(
            '@default',
        );
    });

    it('resolves an unattributed class to the only configured database, even when named', () => {
        @Injectable()
        class Unattributed {}

        const configuration = makeConfiguration([filesModule()], {
            main: {},
        });
        expect(configuration.getDatabaseNameForClass(Unattributed)).toBe(
            'main',
        );
    });

    it('resolves an unattributed class to the default database even in a multi-database worker', () => {
        // Token-less + unattributed = default is a uniform contract: the same
        // helper class resolves identically regardless of how many databases
        // the worker configures. A misrouted default is caught by the runtime
        // entity guard, not by guessing here.
        @Injectable()
        class Unattributed {}

        const configuration = makeConfiguration([filesModule()], multiDatabase);
        expect(configuration.getDatabaseNameForClass(Unattributed)).toBe(
            '@default',
        );
    });

    it('resolves a worker-level (top-level settings) class to the default database', () => {
        @Injectable()
        class WorkerService {}

        const configuration = new BaseConfiguration(
            {} as EnvironmentVariables,
            {
                name: 'mdr-worker-level',
                title: 'Worker Level Test',
                version: '1.0.0',
                modules: [filesModule().with({ database: 'connected' })],
                services: [WorkerService],
                orm: multiDatabase,
            } as unknown as BaseSettings,
        );
        expect(configuration.getDatabaseNameForClass(WorkerService)).toBe(
            '@default',
        );
    });
});

describe('module database map', () => {
    it('maps each registered module to its resolved database', () => {
        const manifest = BaseAppManifest.fromSettings({
            name: 'mdr-map-test',
            title: 'Map Test',
            version: '1.0.0',
            modules: [
                filesModule().with({ database: 'connected' }),
                billingModule(),
            ],
        } as unknown as BaseSettings);

        expect(manifest.getDatabaseForModule(FilesKey.name)).toBe('connected');
        expect(manifest.getDatabaseForModule(BillingKey.name)).toBe('@default');
        expect(manifest.getDatabaseForModule('MdrAbsent')).toBeUndefined();
    });
});

describe('declared membership boot validation', () => {
    it('accepts a class registered by the module it declares', () => {
        @Injectable(FilesKey)
        class Helper {}

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-ok',
                title: 'Validate',
                version: '1.0.0',
                modules: [
                    filesModule([Helper]).with({ database: 'connected' }),
                ],
            } as unknown as BaseSettings),
        ).not.toThrow();
    });

    it('throws when a registered class declares a module resolving to a different database', () => {
        @Injectable(BillingKey)
        class Helper {}

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-conflict',
                title: 'Validate',
                version: '1.0.0',
                modules: [
                    filesModule([Helper]).with({ database: 'connected' }),
                    billingModule(),
                ],
            } as unknown as BaseSettings),
        ).toThrow(
            /declares membership in module "MdrBilling".*resolving to database "connected"/s,
        );
    });

    it('throws when a registered class declares a module absent from the worker', () => {
        @Injectable(UnregisteredKey)
        class Helper {}

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-absent',
                title: 'Validate',
                version: '1.0.0',
                modules: [filesModule([Helper])],
            } as unknown as BaseSettings),
        ).toThrow(/no module with that name is registered/);
    });

    it('accepts registration by a different module resolving to the same database', () => {
        @Injectable(BillingKey)
        class Helper {}

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-same-db',
                title: 'Validate',
                version: '1.0.0',
                modules: [filesModule([Helper]), billingModule()],
            } as unknown as BaseSettings),
        ).not.toThrow();
    });

    it('throws when a non-default-database module registers an undeclared class with token-less injections', () => {
        @Injectable()
        class ForgotTheKey {
            constructor(@InjectDatabase() readonly db: OrmDatabase) {}
        }

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-tokenless',
                title: 'Validate',
                version: '1.0.0',
                modules: [
                    filesModule([ForgotTheKey]).with({
                        database: 'connected',
                    }),
                ],
            } as unknown as BaseSettings),
        ).toThrow(/does not declare its module membership/);
    });

    it('accepts token-less injections in a non-default-database module when membership is declared', () => {
        @Injectable(FilesKey)
        class DeclaredService {
            constructor(@InjectDatabase() readonly db: OrmDatabase) {}
        }

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-tokenless-declared',
                title: 'Validate',
                version: '1.0.0',
                modules: [
                    filesModule([DeclaredService]).with({
                        database: 'connected',
                    }),
                ],
            } as unknown as BaseSettings),
        ).not.toThrow();
    });

    it('catches token-less injections in class-based global middleware (previously never indexed)', () => {
        @Injectable()
        class AuthMiddleware {
            constructor(@InjectDatabase() readonly db: OrmDatabase) {}
            run() {}
        }

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-mw-global',
                title: 'Validate',
                version: '1.0.0',
                modules: [
                    BaseModule.create({
                        key: FilesKey,
                        settings: { middleware: { global: [AuthMiddleware] } },
                    }).with({ database: 'connected' }),
                ],
            } as unknown as BaseSettings),
        ).toThrow(/does not declare its module membership/);
    });

    it('catches token-less injections in class-based handler middleware', () => {
        @Injectable()
        class AuthHandlerMiddleware {
            constructor(@InjectDatabase() readonly db: OrmDatabase) {}
            run() {}
        }

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-mw-handler',
                title: 'Validate',
                version: '1.0.0',
                modules: [
                    BaseModule.create({
                        key: FilesKey,
                        settings: {
                            middleware: { handler: [AuthHandlerMiddleware] },
                        },
                    }).with({ database: 'connected' }),
                ],
            } as unknown as BaseSettings),
        ).toThrow(/does not declare its module membership/);
    });

    it('accepts class middleware with declared membership in a non-default-database module', () => {
        @Injectable(FilesKey)
        class DeclaredMiddleware {
            constructor(@InjectDatabase() readonly db: OrmDatabase) {}
            run() {}
        }

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-mw-declared',
                title: 'Validate',
                version: '1.0.0',
                modules: [
                    BaseModule.create({
                        key: FilesKey,
                        settings: {
                            middleware: { global: [DeclaredMiddleware] },
                        },
                    }).with({ database: 'connected' }),
                ],
            } as unknown as BaseSettings),
        ).not.toThrow();
    });

    it('does not index plain function middleware (no injections to attribute)', () => {
        const functionMiddleware = () => {};

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-mw-function',
                title: 'Validate',
                version: '1.0.0',
                modules: [
                    BaseModule.create({
                        key: FilesKey,
                        settings: {
                            middleware: { global: [functionMiddleware] },
                        },
                    }).with({ database: 'connected' }),
                ],
            } as unknown as BaseSettings),
        ).not.toThrow();
    });

    it('accepts undeclared token-less injections in a default-database module', () => {
        @Injectable()
        class DefaultService {
            constructor(@InjectDatabase() readonly db: OrmDatabase) {}
        }

        expect(() =>
            BaseAppManifest.fromSettings({
                name: 'mdr-validate-tokenless-default',
                title: 'Validate',
                version: '1.0.0',
                modules: [filesModule([DefaultService])],
            } as unknown as BaseSettings),
        ).not.toThrow();
    });
});
