// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Credentials for the database stored individually.
 */
export interface OrmDiscreteCredentials {
    /**
     * Credentials stored as individual fields.
     */
    readonly type: 'discrete';

    /**
     * Database host.
     */
    readonly host: string;

    /**
     * Database port. Defaults to 3306.
     */
    readonly port?: number;

    /**
     * Database username.
     */
    readonly username: string;

    /**
     * Database password.
     */
    readonly password: string;

    /**
     * Database name to connect to.
     */
    readonly database: string;
}
