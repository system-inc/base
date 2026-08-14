// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import type { OrmTrackingEntity } from '../entity/OrmTrackingEntity';

/**
 * A structural stand-in for an entity: the public methods every
 * `OrmTrackingEntity` carries. We match relations against this rather than
 * against `OrmTrackingEntity` directly because the nominal class has private
 * fields (`_changedFields`), and any mapped form a consumer might use —
 * `Readonly<Entity>`, `Readonly<Entity>[]`, `ReadonlyArray<...>` — strips the
 * private brand and so fails a nominal `extends OrmTrackingEntity` check,
 * misclassifying the relation as a scalar. These public methods survive the
 * mapping, and no scalar column (`string`/`number`/`Date`/…) has all of them,
 * so the structural check recognizes readonly relations while still excluding
 * columns.
 */
type EntityLike = Pick<
    OrmTrackingEntity,
    'getChangedFields' | 'toJSON' | 'clone'
>;

/**
 * The property keys of `TargetType` that hold a relation — a related entity or
 * an array of them (scalar columns excluded).
 */
type RelationKeysOf<TargetType> = {
    [Key in keyof TargetType]-?: NonNullable<TargetType[Key]> extends
        | EntityLike
        | readonly EntityLike[]
        ? Key
        : never;
}[keyof TargetType] &
    string;

/**
 * Used to type `inverseSide` so it must name a real relation on the target
 * entity — compile-checked, autocompleted, and updated by IDE rename-symbol
 * rather than an unchecked string. If no relation keys can be identified for
 * the target (e.g. it doesn't type its relations as entities), this falls back
 * to `string` so the option stays usable instead of becoming `never`.
 */
export type RelationKey<TargetType> = [RelationKeysOf<TargetType>] extends [
    never,
]
    ? string
    : RelationKeysOf<TargetType>;

// Many-to-many is intentionally not modeled. Junction tables are
// declared as explicit entities (an @OrmTable with a composite
// @OrmPrimaryKey) and traversed either through ordinary one-to-many /
// many-to-one relations on the junction entity, or with a two-step
// junction find + inArray() query.
export type OrmRelationMetadata =
    | {
          type: 'many-to-one';
          propertyKey: string;
          target: () => Constructor;
          joinColumn: string; // Column in this table
          inverseSide?: string; // Property on the other entity
          nullable?: boolean;
      }
    | {
          type: 'one-to-many';
          propertyKey: string;
          target: () => Constructor;
          inverseSide: string; // Required - property on the other entity that references back
      }
    | {
          type: 'one-to-one';
          propertyKey: string;
          target: () => Constructor;
          joinColumn: string; // Column in this table
          inverseSide?: string; // Property on the other entity
          nullable?: boolean;
      };

/**
 * Options for the `@OrmManyToOne` decorator. `TargetType` is inferred from the
 * decorator's `() => Target` thunk so `inverseSide` is checked against the
 * target's relation properties.
 */
export interface OrmManyToOneOptions<TargetType = unknown> {
    /**
     * The column in this table that references the foreign entity
     * If not specified, will be inferred as `${propertyKey}Id`
     */
    joinColumn?: string;

    /**
     * The relation on the target entity that points back to this entity.
     */
    inverseSide?: RelationKey<TargetType>;

    /**
     * Whether this relation can be null
     */
    nullable?: boolean;
}

/**
 * Options for the `@OrmOneToMany` decorator.
 */
export interface OrmOneToManyOptions<TargetType = unknown> {
    /**
     * The relation on the target entity that points back to this entity.
     */
    inverseSide: RelationKey<TargetType>;
}

/**
 * Options for the `@OrmOneToOne` decorator.
 */
export interface OrmOneToOneOptions<TargetType = unknown> {
    /**
     * The column in this table that references the foreign entity
     * If not specified, will be inferred as `${propertyKey}Id`
     */
    joinColumn?: string;

    /**
     * The relation on the target entity that points back to this entity.
     */
    inverseSide?: RelationKey<TargetType>;

    /**
     * Whether this relation can be null
     */
    nullable?: boolean;
}
