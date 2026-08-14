// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '../base/BaseSettings';
import { Injectable } from '../dependency-injection/decorators/Injectable';
import { Provider } from '../dependency-injection/decorators/Provider';
import { TypedInjectionKey } from '../dependency-injection/TypedInjectionKey';
import { GqlResolver } from '../graphql/decorators/GqlResolver';
import { BaseModule } from '../module/BaseModule';
import { HttpService } from '../router/decorators/HttpService';
import { RpcService } from '../rpc/decorators/RpcService';
import { ScheduledExecutable } from '../scheduled/decorators/ScheduledExecutable';
import { BaseAppManifest } from './BaseAppManifest';
import { BaseModuleKey } from './BaseModuleKey';

const UsProviderToken = new TypedInjectionKey<string>('UsProviderToken');
const UsKey = BaseModuleKey.create('UsModule');

@GqlResolver()
class UsResolver {}

@HttpService()
class UsHttpService {}

@RpcService()
class UsRpcService {}

@ScheduledExecutable()
class UsExecutable {
    async execute(): Promise<void> {}
}

// A class may carry several dispatch decorators — it lands in each bucket.
@HttpService()
@RpcService()
class UsDualService {}

// No dispatch decorator — loaded (recognized via @Injectable), never
// dispatched.
@Injectable()
class UsHelper {}

function settingsWith(overrides: Partial<BaseSettings>): BaseSettings {
    return {
        name: 'us-test',
        title: 'Unified Services Test',
        version: '1.0.0',
        ...overrides,
    } as unknown as BaseSettings;
}

describe('unified services slot', () => {
    it('sorts a module’s services into dispatch buckets by decorator', () => {
        const module = BaseModule.create({
            key: UsKey,
            settings: {
                services: [
                    UsResolver,
                    UsHttpService,
                    UsRpcService,
                    UsExecutable,
                    UsHelper,
                ],
            },
        });
        const manifest = BaseAppManifest.fromSettings(
            settingsWith({ modules: [module] }),
        );

        expect(manifest.graphql.resolvers).toEqual([UsResolver]);
        expect(manifest.router.services).toEqual([UsHttpService]);
        expect(manifest.rpc.services).toEqual([UsRpcService]);
        expect(manifest.scheduled.executables).toEqual([UsExecutable]);
    });

    it('loads but does not dispatch an injectable-only class, still indexing it', () => {
        const module = BaseModule.create({
            key: UsKey,
            settings: { services: [UsHelper] },
        });
        const manifest = BaseAppManifest.fromSettings(
            settingsWith({ modules: [module] }),
        );

        expect(manifest.router.services).toEqual([]);
        expect(manifest.getDatabaseForClass(UsHelper)).toBe('@default');
    });

    it('lands a multi-decorator class in every matching bucket', () => {
        const module = BaseModule.create({
            key: UsKey,
            settings: { services: [UsDualService] },
        });
        const manifest = BaseAppManifest.fromSettings(
            settingsWith({ modules: [module] }),
        );

        expect(manifest.router.services).toEqual([UsDualService]);
        expect(manifest.rpc.services).toEqual([UsDualService]);
    });

    it('honors feature toggles when sorting a module’s services', () => {
        const module = BaseModule.create({
            key: UsKey,
            settings: { services: [UsResolver, UsHttpService] },
        }).with({ graphql: false });
        const manifest = BaseAppManifest.fromSettings(
            settingsWith({ modules: [module] }),
        );

        expect(manifest.graphql.resolvers).toEqual([]);
        expect(manifest.router.services).toEqual([UsHttpService]);
    });

    it('sorts worker-level (top-level settings) services the same way', () => {
        const manifest = BaseAppManifest.fromSettings(
            settingsWith({
                services: [UsResolver, UsHttpService, UsRpcService],
            }),
        );

        expect(manifest.graphql.resolvers).toEqual([UsResolver]);
        expect(manifest.router.services).toEqual([UsHttpService]);
        expect(manifest.rpc.services).toEqual([UsRpcService]);
        expect(manifest.getDatabaseForClass(UsHttpService)).toBe('@default');
    });

    it('throws for a services class with no recognized base decorator', () => {
        class UsBareClass {}

        const module = BaseModule.create({
            key: UsKey,
            settings: { services: [UsBareClass] },
        });
        expect(() =>
            BaseAppManifest.fromSettings(settingsWith({ modules: [module] })),
        ).toThrow(/no recognized base decorator/);
    });

    it('recognizes a @Provider host class', () => {
        class UsProviderHost {
            @Provider(UsProviderToken)
            provideValue(): string {
                return 'provided';
            }
        }

        const module = BaseModule.create({
            key: UsKey,
            settings: { services: [UsProviderHost] },
        });
        expect(() =>
            BaseAppManifest.fromSettings(settingsWith({ modules: [module] })),
        ).not.toThrow();
    });
});
