// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { Constructor } from '@system-inc/base-common/type/Constructor';
import { BaseSettings } from '../base/BaseSettings';
import { Injectable } from '../dependency-injection/decorators/Injectable';
import type { BaseMiddleware } from '../middleware/BaseMiddleware';
import { BaseModule } from '../module/BaseModule';
import { OrmPrimaryAutoColumn } from '../orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../orm/decorators/OrmTable';
import { OrmTrackingEntity } from '../orm/entity/OrmTrackingEntity';
import type { WebSocketDelegate } from '../web-socket/WebSocketDelegate';
import { BaseAppManifest } from './BaseAppManifest';
import { BaseModuleKey } from './BaseModuleKey';

@OrmTable('mrm_account')
class MrmAccount extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

@OrmTable('mrm_owned')
class MrmOwned extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

const AccountKey = BaseModuleKey.create('MrmAccount');
const ConsumerKey = BaseModuleKey.create('MrmConsumer');
const ExternalKey = BaseModuleKey.create('MrmExternal');
const MixedKey = BaseModuleKey.create('MrmMixed');
const WiringKey = BaseModuleKey.create('MrmWiring');

function accountModule() {
    return BaseModule.create({
        key: AccountKey,
        settings: { orm: { entities: [MrmAccount] } },
    });
}

function settingsWithModules(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modules: BaseModule<any>[],
): BaseSettings {
    return {
        name: 'mrm-test',
        title: 'Module Registration Modifiers Test',
        version: '1.0.0',
        modules,
    } as unknown as BaseSettings;
}

describe('module registration modifiers', () => {
    it('owns a module’s entities by default', () => {
        const manifest = BaseAppManifest.fromSettings(
            settingsWithModules([accountModule()]),
        );
        expect(manifest.getOrmSettings('@default').entities).toEqual([
            MrmAccount,
        ]);
        expect(manifest.getOrmSettings('@default').externalEntities).toEqual(
            [],
        );
    });

    it('.with({ externalSchema: true }) routes a module’s entities to externalEntities', () => {
        const manifest = BaseAppManifest.fromSettings(
            settingsWithModules([
                accountModule().with({ externalSchema: true }),
            ]),
        );
        expect(manifest.getOrmSettings('@default').entities).toEqual([]);
        expect(manifest.getOrmSettings('@default').externalEntities).toEqual([
            MrmAccount,
        ]);
    });

    it('orm: false skips a module’s entities entirely (neither owned nor external)', () => {
        const manifest = BaseAppManifest.fromSettings(
            settingsWithModules([accountModule().with({ orm: false })]),
        );
        expect(manifest.getOrmSettings('@default').entities).toEqual([]);
        expect(manifest.getOrmSettings('@default').externalEntities).toEqual(
            [],
        );
    });

    it('rejects an unrecognized services class regardless of feature toggles', () => {
        // A class with no recognized base decorator can do nothing — listing
        // it is a mistake (usually a forgotten decorator), and stripping a
        // feature doesn't legitimize it: toggles strip wiring, not classes.
        class NotAnything {}
        const make = (options?: Parameters<BaseModule['with']>[0]) =>
            BaseModule.create({
                key: AccountKey,
                settings: { services: [NotAnything] },
            }).with(options ?? {});

        expect(() =>
            BaseAppManifest.fromSettings(settingsWithModules([make()])),
        ).toThrow(/no recognized base decorator/);
        expect(() =>
            BaseAppManifest.fromSettings(
                settingsWithModules([make({ graphql: false })]),
            ),
        ).toThrow(/no recognized base decorator/);
    });

    describe('database modifier', () => {
        it('registers a module’s entities under the named database', () => {
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([
                    accountModule().with({ database: 'connected' }),
                ]),
            );
            expect(manifest.getOrmSettings('connected').entities).toEqual([
                MrmAccount,
            ]);
            expect(manifest.getOrmSettings('@default').entities).toEqual([]);
        });

        it('composes with externalSchema (external under the named database)', () => {
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([
                    accountModule().with({
                        database: 'connected',
                        externalSchema: true,
                    }),
                ]),
            );
            expect(
                manifest.getOrmSettings('connected').externalEntities,
            ).toEqual([MrmAccount]);
            expect(manifest.getOrmSettings('connected').entities).toEqual([]);
        });

        it('overrides the module’s own settings.orm.databaseName', () => {
            const module = BaseModule.create({
                key: AccountKey,
                settings: {
                    orm: {
                        databaseName: 'module-default',
                        entities: [MrmAccount],
                    },
                },
            }).with({ database: 'connected' });
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([module]),
            );
            expect(manifest.getOrmSettings('connected').entities).toEqual([
                MrmAccount,
            ]);
            expect(manifest.getOrmSettings('module-default').entities).toEqual(
                [],
            );
        });
    });

    describe('module orm.externalEntities', () => {
        it('registers a module’s externalEntities as external (never owned)', () => {
            const module = BaseModule.create({
                key: ExternalKey,
                settings: { orm: { externalEntities: [MrmAccount] } },
            });
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([module]),
            );
            expect(
                manifest.getOrmSettings('@default').externalEntities,
            ).toEqual([MrmAccount]);
            expect(manifest.getOrmSettings('@default').entities).toEqual([]);
        });

        it('routes externalEntities to the module’s resolved database', () => {
            const module = BaseModule.create({
                key: ExternalKey,
                settings: { orm: { externalEntities: [MrmAccount] } },
            }).with({ database: 'connected' });
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([module]),
            );
            expect(
                manifest.getOrmSettings('connected').externalEntities,
            ).toEqual([MrmAccount]);
        });

        it('keeps externalEntities external even when entities are owned', () => {
            const module = BaseModule.create({
                key: MixedKey,
                settings: {
                    orm: {
                        entities: [MrmOwned],
                        externalEntities: [MrmAccount],
                    },
                },
            });
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([module]),
            );
            expect(manifest.getOrmSettings('@default').entities).toEqual([
                MrmOwned,
            ]);
            expect(
                manifest.getOrmSettings('@default').externalEntities,
            ).toEqual([MrmAccount]);
        });
    });

    // The index no longer routes injections (declared membership or the
    // default does) — it powers boot validation of contradictory or missing
    // attribution.
    describe('class → database index (boot validation)', () => {
        @Injectable()
        class IndexedService {}
        @Injectable()
        class SharedService {}

        const serviceModule = (
            name: string,
            database?: string,
            service: new () => object = IndexedService,
        ) =>
            BaseModule.create({
                key: BaseModuleKey.create(name),
                settings: { services: [service] },
            }).with(database ? { database } : {});

        it('maps a module’s classes to the module’s database', () => {
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([serviceModule('M', 'connected')]),
            );
            expect(manifest.getDatabaseForClass(IndexedService)).toBe(
                'connected',
            );
        });

        it('maps a class to @default when the module has no database override', () => {
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([serviceModule('M')]),
            );
            expect(manifest.getDatabaseForClass(IndexedService)).toBe(
                '@default',
            );
        });

        it('returns undefined for a class registered by no module', () => {
            class Unregistered {}
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([accountModule()]),
            );
            expect(manifest.getDatabaseForClass(Unregistered)).toBeUndefined();
        });

        it('throws when one class is registered by modules resolving to different databases', () => {
            expect(() =>
                BaseAppManifest.fromSettings(
                    settingsWithModules([
                        serviceModule('M1', 'connected', SharedService),
                        serviceModule('M2', 'other', SharedService),
                    ]),
                ),
            ).toThrow(/contradictory/);
        });

        it('allows the same class across modules resolving to the same database', () => {
            expect(() =>
                BaseAppManifest.fromSettings(
                    settingsWithModules([
                        serviceModule('M1', 'connected', SharedService),
                        serviceModule('M2', 'connected', SharedService),
                    ]),
                ),
            ).not.toThrow();
        });
    });

    describe('middleware and webSocket toggles', () => {
        class MrmMiddleware implements BaseMiddleware {
            run() {}
        }
        const wsDelegate = {
            name: 'mrm-ws',
            path: '/mrm-ws',
            delegate:
                class MrmWsDelegate {} as unknown as Constructor<WebSocketDelegate>,
        };
        const wiringModule = (options?: Parameters<BaseModule['with']>[0]) =>
            BaseModule.create({
                key: WiringKey,
                settings: {
                    middleware: {
                        global: [MrmMiddleware],
                        handler: [MrmMiddleware],
                    },
                    webSocket: { delegates: [wsDelegate] },
                },
            }).with(options ?? {});

        it('registers middleware and webSocket delegates by default', () => {
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([wiringModule()]),
            );
            expect(manifest.middleware.global).toContain(MrmMiddleware);
            expect(manifest.middleware.handler).toContain(MrmMiddleware);
            expect(manifest.webSocket.delegates).toContain(wsDelegate);
        });

        it('middleware: false strips global and handler middleware, leaving webSocket', () => {
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([wiringModule({ middleware: false })]),
            );
            expect(manifest.middleware.global).toHaveLength(0);
            expect(manifest.middleware.handler).toHaveLength(0);
            expect(manifest.webSocket.delegates).toContain(wsDelegate);
        });

        it('webSocket: false strips delegates, leaving middleware', () => {
            const manifest = BaseAppManifest.fromSettings(
                settingsWithModules([wiringModule({ webSocket: false })]),
            );
            expect(manifest.webSocket.delegates).toHaveLength(0);
            expect(manifest.middleware.global).toContain(MrmMiddleware);
        });
    });

    describe('feature-scoped uses', () => {
        const consumer = (
            options?: Parameters<BaseModule['with']>[0],
            when?: 'graphql',
        ) =>
            BaseModule.create({
                key: ConsumerKey,
                settings: {},
                uses: [{ module: AccountKey, when }],
            }).with(options ?? {});

        it('drops a { module, when } dependency when that feature is stripped', () => {
            // AccountKey is deliberately NOT registered. With graphql off the
            // scoped dependency is dropped, so resolution does not require it.
            expect(() =>
                BaseAppManifest.fromSettings(
                    settingsWithModules([
                        consumer({ graphql: false }, 'graphql'),
                    ]),
                ),
            ).not.toThrow();
        });

        it('requires a { module, when } dependency when the feature is enabled', () => {
            expect(() =>
                BaseAppManifest.fromSettings(
                    settingsWithModules([consumer({}, 'graphql')]),
                ),
            ).toThrow(/was not found in the modules list/);
        });

        it('an unscoped dependency (when omitted) is always required', () => {
            expect(() =>
                BaseAppManifest.fromSettings(
                    settingsWithModules([consumer({ graphql: false })]),
                ),
            ).toThrow(/was not found in the modules list/);
        });
    });

    describe('duplicate module names', () => {
        it('throws when two different modules share a name', () => {
            const first = BaseModule.create({
                key: AccountKey,
                settings: {},
            });
            const second = BaseModule.create({
                key: AccountKey,
                settings: {},
            });
            // silently dropping the second registration (and its settings)
            // would hide a real mistake
            expect(() =>
                BaseAppManifest.fromSettings(
                    settingsWithModules([first, second]),
                ),
            ).toThrow(/Two different modules are registered with the name/);
        });

        it('does not throw when the same module is reached twice (diamond)', () => {
            const shared = accountModule();
            const consumerA = BaseModule.create({
                key: ConsumerKey,
                settings: {},
                uses: [AccountKey],
            });
            const consumerB = BaseModule.create({
                key: MixedKey,
                settings: {},
                uses: [AccountKey],
            });
            // `shared` is reached directly and via both consumers' `uses`, but
            // it is the same object each time — deduped, not a conflict.
            expect(() =>
                BaseAppManifest.fromSettings(
                    settingsWithModules([shared, consumerA, consumerB]),
                ),
            ).not.toThrow();
        });
    });
});
