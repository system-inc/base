// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmTrackingEntity } from './OrmTrackingEntity';

/**
 * The constructor type for an ORM entity class.
 *
 * Every entity extends {@link OrmTrackingEntity} (directly or via
 * `OrmBaseEntity` / `OrmMutableBaseEntity`), which installs the per-column
 * change-tracking accessors the repository and hydrator rely on. Registration
 * and data-access APIs are typed against this so a class that forgets to extend
 * the base is rejected where it is registered, not at first use.
 */
export type OrmEntityClass = Constructor<OrmTrackingEntity>;
