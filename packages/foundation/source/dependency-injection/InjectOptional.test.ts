// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import 'reflect-metadata';

import { getGlobalContainer } from '../internal/dependency-injection/InjectionContainers';
import { Injectable } from './decorators/Injectable';
import { InjectAllOptional } from './decorators/InjectAllOptional';
import { InjectOptional } from './decorators/InjectOptional';

// Undecorated classes with a constructor param: tsyringe has no type info for
// them, so resolving throws "TypeInfo not known for <name>" — the case the
// optional factory must catch. (A param-less class would be auto-constructed.)
class MissingOne {
    constructor(readonly value: string) {}
}
class MissingMany {
    constructor(readonly value: string) {}
}

@Injectable()
class OptionalConsumer {
    constructor(
        @InjectOptional(MissingOne)
        readonly one: MissingOne | undefined,
        @InjectAllOptional(MissingMany)
        readonly many: MissingMany[],
    ) {}
}

// Two DISTINCT classes that share the simple name 'Config'.
const ConfigA = class Config {};
const ConfigB = class Config {
    // unresolvable (undecorated with a required param)
    constructor(readonly value: string) {}
};

@Injectable()
class CollisionConsumer {
    constructor(
        @InjectOptional(ConfigA) readonly a: unknown,
        @InjectOptional(ConfigB) readonly b: unknown,
    ) {}
}

describe('InjectOptional / InjectAllOptional', () => {
    it('resolves to undefined / [] for an unresolvable Constructor token', () => {
        // Before the fix the optional factory compared the tsyringe error
        // against token.toString() (a Constructor's source code), never
        // matched, and rethrew — so resolving this consumer would throw.
        const consumer = getGlobalContainer().resolve(OptionalConsumer);
        expect(consumer.one).toBeUndefined();
        expect(consumer.many).toEqual([]);
    });

    it('does not cross-wire two distinct classes that share a name', () => {
        const container = getGlobalContainer();
        // ConfigA is registered/resolvable; ConfigB is not.
        container.register(ConfigA, { useValue: { tag: 'A' } });

        const consumer = container.resolve(CollisionConsumer);

        // Each optional injection resolves its OWN token — before the fix both
        // collapsed to `@optional(Config)`, so the second registration won and
        // ConfigA resolved as undefined too.
        expect(consumer.a).toEqual({ tag: 'A' });
        expect(consumer.b).toBeUndefined();
    });
});
