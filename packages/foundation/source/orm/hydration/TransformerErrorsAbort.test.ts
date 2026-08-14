// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumn } from '../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../decorators/OrmTable';
import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { OrmValueTransformer } from '../interfaces/OrmValueTransformer';
import { ormRequireTable } from '../metadata/OrmSchemaRegistry';
import { OrmEntityHydrator } from './OrmEntityHydrator';

// A transformer that always fails — stands in for e.g. a decrypt/parse step
// that chokes on a malformed value.
const explodingTransformer: OrmValueTransformer = {
    from() {
        throw new Error('decrypt failed');
    },
    to() {
        throw new Error('encrypt failed');
    },
};

@OrmTable('tea_secret')
class TeaSecret extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn(
        { kind: 'varchar', length: 64 },
        { transformer: explodingTransformer },
    )
    declare secret: string;
}

describe('column transformer failures abort instead of keeping the raw value', () => {
    it('throws when the from-database transform fails (hydration)', () => {
        // Must NOT silently leave the raw (still-encrypted) value on the entity.
        expect(() =>
            OrmEntityHydrator.hydrateOne(
                { id: 'i1', secret: 'cipher-text' },
                TeaSecret,
            ),
        ).toThrow(/Failed to transform column 'secret'.*from the database/);
    });

    it('throws when the to-database transform fails (write prep)', () => {
        // Must NOT silently persist the raw (un-encrypted) value.
        expect(() =>
            OrmEntityHydrator.applyTransformersToDatabase(
                { secret: 'plaintext' },
                ormRequireTable(TeaSecret),
            ),
        ).toThrow(/Failed to transform column 'secret'.*for the database/);
    });
});
