// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmDiscreteCredentials } from './OrmDiscreteCredentials';
import { OrmUrlCredentials } from './OrmUrlCredentials';

export type OrmCredentials = OrmDiscreteCredentials | OrmUrlCredentials;
