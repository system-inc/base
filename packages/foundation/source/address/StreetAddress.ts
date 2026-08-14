// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { GqlField } from '../graphql/decorators/GqlField';
import { GqlInputType } from '../graphql/decorators/GqlInputType';
import { GqlInterfaceType } from '../graphql/decorators/GqlInterfaceType';
import { GqlObjectType } from '../graphql/decorators/GqlObjectType';

/**
 * A shared GraphQL + database value type. Entities store it inside a
 * `json` column; it is not a table of its own.
 */
@GqlInterfaceType()
@GqlInputType('StreetAddressInput')
@GqlObjectType('StreetAddressObject')
export class StreetAddress {
    @GqlField(() => String, { nullable: true })
    company: string | null;

    @GqlField(() => String)
    line1: string;

    @GqlField(() => String, { nullable: true })
    line2: string | null;

    @GqlField(() => String)
    city: string;

    @GqlField(() => String)
    state: string;

    @GqlField(() => String)
    postalCode: string;

    @GqlField(() => String)
    country: string;

    @GqlField(() => String)
    firstName: string;

    @GqlField(() => String)
    lastName: string;

    @GqlField(() => String, { nullable: true })
    phoneNumber: string | null;

    static isSameAddress(
        addressA: StreetAddress | Readonly<StreetAddress>,
        addressB: StreetAddress | Readonly<StreetAddress>,
    ): boolean {
        return (
            addressA.line1.toLocaleLowerCase() ===
                addressB.line1.toLocaleLowerCase() &&
            addressA.line2?.toLocaleLowerCase() ===
                addressB.line2?.toLocaleLowerCase() &&
            addressA.city.toLocaleLowerCase() ===
                addressB.city.toLocaleLowerCase() &&
            addressA.state.toLocaleLowerCase() ===
                addressB.state.toLocaleLowerCase() &&
            addressA.postalCode.toLocaleLowerCase() ===
                addressB.postalCode.toLocaleLowerCase() &&
            addressA.country.toLocaleLowerCase() ===
                addressB.country.toLocaleLowerCase()
        );
    }

    static simpleAddressKey(
        address: StreetAddress | Readonly<StreetAddress>,
    ): string {
        return [
            address.line1.toLocaleLowerCase(),
            address.line2?.toLocaleLowerCase() ?? '',
            address.city.toLocaleLowerCase(),
            address.state.toLocaleLowerCase(),
            address.postalCode.toLocaleLowerCase(),
        ].join('|');
    }
}
