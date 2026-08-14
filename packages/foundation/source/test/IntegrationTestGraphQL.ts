// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { gql } from 'graphql-request';

export namespace IntegrationTestGraphQL {
    export const deviceId = gql`
        query MyQuery {
            deviceId {
                success
            }
        }
    `;

    export const account = gql`
        query MyQuery {
            account {
                id
                accessRoles
                createdAt
                defaultProfileId
                enrolledChallenges
                status
                updatedAt
                emailAddress
                emails {
                    createdAt
                    emailAddress
                    id
                    source
                    isVerified
                    type
                    updatedAt
                }
                profiles {
                    birthday
                    createdAt
                    countryCode
                    displayName
                    familyName
                    gender
                    givenName
                    id
                    images {
                        type
                        url
                        variant
                    }
                    middleName
                    preferredName
                    updatedAt
                    username
                }
            }
        }
    `;

    export const accountAuthenticationRegistrationOrSignInCreate = (
        emailAddress: string,
    ) => gql`
    mutation MyMutation {
        accountAuthenticationRegistrationOrSignInCreate(input: { emailAddress: "${emailAddress}" }) {
            emailAddress
            authentication {
                createdAt
                currentChallenge {
                    challengeType
                    status
                }
                scopeType
                status
                updatedAt
            }
        }
    }
`;

    export const accountAuthenticationEmailVerificationVerify = (
        emailVerification: string,
    ) => gql`
    mutation MyMutation {
        accountAuthenticationEmailVerificationVerify(input: {code: "${emailVerification}"}) {
            authentication {
                createdAt
                currentChallenge {
                    challengeType
                    status
                }
                scopeType
                status
                updatedAt
            }
            verification {
                emailAddress
                lastEmailSentAt
                status
            }
        }
    }
`;

    export const accountAuthenticationRegistrationComplete = gql`
        mutation MyMutation {
            accountAuthenticationRegistrationComplete(input: {}) {
                success
            }
        }
    `;

    export const accountAuthenticationSignInComplete = gql`
        mutation MyMutation {
            accountAuthenticationSignInComplete {
                success
            }
        }
    `;

    // Organization queries and mutations

    export const organizationCreate = (
        username: string,
        displayName: string,
        description?: string,
        website?: string,
    ) => {
        const descField = description ? `description: "${description}"` : '';
        const webField = website ? `website: "${website}"` : '';
        const optionalFields = [descField, webField].filter(Boolean).join(', ');
        const inputFields = `username: "${username}", displayName: "${displayName}"${optionalFields ? ', ' + optionalFields : ''}`;
        return gql`
            mutation OrganizationCreate {
                organizationCreate(input: { ${inputFields} }) {
                    id
                    type
                    username
                    displayName
                    description
                    website
                    createdAt
                }
            }
        `;
    };

    export const organizationUpdate = (input: {
        username?: string;
        displayName?: string;
        description?: string;
        website?: string;
    }) => {
        const fields: string[] = [];
        if (input.username) fields.push(`username: "${input.username}"`);
        if (input.displayName)
            fields.push(`displayName: "${input.displayName}"`);
        if (input.description)
            fields.push(`description: "${input.description}"`);
        if (input.website) fields.push(`website: "${input.website}"`);
        return gql`
            mutation OrganizationUpdate {
                organizationUpdate(input: { ${fields.join(', ')} }) {
                    id
                    type
                    username
                    displayName
                    description
                    website
                    updatedAt
                }
            }
        `;
    };

    export const organizationDelete = gql`
        mutation OrganizationDelete {
            organizationDelete {
                success
            }
        }
    `;

    export const organizationTransferOwnership = (
        newOwnerAccountId: string,
    ) => gql`
        mutation OrganizationTransferOwnership {
            organizationTransferOwnership(input: { newOwnerAccountId: "${newOwnerAccountId}" }) {
                success
            }
        }
    `;

    export const organizationMemberList = gql`
        query OrganizationMemberList {
            organizationMemberList {
                accountId
                emailAddress
                joinedAt
                profile {
                    username
                    displayName
                }
            }
        }
    `;

    export const organizationMemberRoles = (accountId: string) => gql`
        query OrganizationMemberRoles {
            organizationMemberRoles(accountId: "${accountId}")
        }
    `;

    export const organizationMemberAdd = (
        emailAddress: string,
        roles: string[],
    ) => gql`
        mutation OrganizationMemberAdd {
            organizationMemberAdd(input: { emailAddress: "${emailAddress}", roles: ${JSON.stringify(roles)} }) {
                accountId
                emailAddress
                joinedAt
                profile {
                    username
                    displayName
                }
            }
        }
    `;

    export const organizationMemberRemove = (accountId: string) => gql`
        mutation OrganizationMemberRemove {
            organizationMemberRemove(input: { accountId: "${accountId}" }) {
                success
            }
        }
    `;

    export const organizationRolesGrant = (
        accountId: string,
        roles: string[],
    ) => gql`
        mutation OrganizationRolesGrant {
            organizationRolesGrant(input: { accountId: "${accountId}", roles: ${JSON.stringify(roles)} }) {
                accountId
                profile {
                    username
                }
            }
        }
    `;

    export const organizationRolesRevoke = (
        accountId: string,
        roles: string[],
    ) => gql`
        mutation OrganizationRolesRevoke {
            organizationRolesRevoke(input: { accountId: "${accountId}", roles: ${JSON.stringify(roles)} }) {
                accountId
                profile {
                    username
                }
            }
        }
    `;

    export const accountSessionSwitchProfile = (profileId: string) => gql`
        mutation AccountSessionSwitchProfile {
            accountSessionSwitchProfile(input: { profileId: "${profileId}" }) {
                id
                profileId
            }
        }
    `;
}
