// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { MediaObjectType } from './MediaObjectType';

export interface MediaObject {
    type: MediaObjectType;
    variant: string | null;
    url: string;
}
