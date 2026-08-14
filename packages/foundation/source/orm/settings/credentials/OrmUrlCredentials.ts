// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Credentials for the database formatted in a URL.
 */
export interface OrmUrlCredentials {
    /**
     * Credentials stored in a URL.
     */
    readonly type: 'url';

    /**
     * The url parameter that should contain all credentials required to connect to the database.
     *
     * The format of the url parameter is:
     * [connector]://[user_name]:[password]@[host]:[port]/[database]?[arguments]
     *
     * [connector] can be one of the following:
     * mysql: MySQL database.
     * planetscale-serverless: PlanetScale Serverless database.
     *
     * [user_name] is the username to connect to the database.
     * [password] is the password to connect to the database.
     * [host] is the host of the database.
     * [port] is the port of the database.
     * [database] is the name of the database to connect to.
     * [arguments] is a key/value pair list of arguments to pass to the database connector.
     */
    readonly url: string;
}
