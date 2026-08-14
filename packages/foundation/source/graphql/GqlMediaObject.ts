// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { MediaObject } from '@system-inc/base-common/media/MediaObject';
import { MediaObjectType } from '@system-inc/base-common/media/MediaObjectType';
import { GqlField } from './decorators/GqlField';
import { GqlObjectType } from './decorators/GqlObjectType';
import { gqlRegisterEnumType } from './types/GqlRegisterEnumType';

gqlRegisterEnumType(MediaObjectType, {
    name: 'MediaObjectType',
});

@GqlObjectType()
export class GqlMediaObject implements MediaObject {
    @GqlField(() => MediaObjectType)
    type: MediaObjectType;

    @GqlField(() => String, { nullable: true })
    variant: string | null;

    @GqlField(() => String)
    url: string;
}
