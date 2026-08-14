// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseModuleKey } from '../configuration/BaseModuleKey';
import { ContainerScoped } from './decorators/ContainerScoped';
import { Injectable } from './decorators/Injectable';
import { ResolutionScoped } from './decorators/ResolutionScoped';
import { Singleton } from './decorators/Singleton';
import { WorkerScoped } from './decorators/WorkerScoped';
import { getModuleMembership } from './ModuleMembership';

const FilesKey = BaseModuleKey.create('MmFiles');
const BillingKey = BaseModuleKey.create('MmBilling');

describe('declared module membership', () => {
    it('is declared through @Injectable(moduleKey)', () => {
        @Injectable(FilesKey)
        class Helper {}

        expect(getModuleMembership(Helper)).toBe(FilesKey);
    });

    it('is declared through every injectable-family decorator', () => {
        @ContainerScoped(FilesKey)
        class A {}
        @ResolutionScoped(FilesKey)
        class B {}
        @WorkerScoped(FilesKey)
        class C {}
        @Singleton(FilesKey)
        class D {}

        for (const ctor of [A, B, C, D]) {
            expect(getModuleMembership(ctor)).toBe(FilesKey);
        }
    });

    it('is undefined for a class that never declared one', () => {
        @Injectable()
        class Unattributed {}

        expect(getModuleMembership(Unattributed)).toBeUndefined();
    });

    it('is inherited by subclasses', () => {
        @Injectable(FilesKey)
        class BaseHelper {}
        @Injectable()
        class SpecializedHelper extends BaseHelper {}

        expect(getModuleMembership(SpecializedHelper)).toBe(FilesKey);
    });

    it('lets a subclass declare its own module', () => {
        @Injectable(FilesKey)
        class BaseHelper {}
        @Injectable(BillingKey)
        class BillingHelper extends BaseHelper {}

        expect(getModuleMembership(BillingHelper)).toBe(BillingKey);
        expect(getModuleMembership(BaseHelper)).toBe(FilesKey);
    });

    it('throws when one class declares two different modules', () => {
        expect(() => {
            @Injectable(FilesKey)
            @ContainerScoped(BillingKey)
            class _Conflicted {}
        }).toThrow(/exactly one module/);
    });

    it('accepts the same module declared twice', () => {
        expect(() => {
            @Injectable(FilesKey)
            @ContainerScoped(FilesKey)
            class _Doubled {}
        }).not.toThrow();
    });
});
