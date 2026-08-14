// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as crypto from 'node:crypto';
import * as path from 'node:path';

/**
 * Helpers for locating wrangler's (miniflare's) local simulator state on
 * disk — the sqlite files under `.wrangler/state/v3/` (or a workspace
 * `persistTo` root) that back local D1 databases.
 */

/**
 * Miniflare's `durableObjectNamespaceIdFromName` — the algorithm that
 * derives a Durable Object id (and therefore the on-disk sqlite filename)
 * from a namespace's unique key and an object name. Mirrors
 * `miniflare/src/plugins/shared/index.ts`; must stay byte-identical or
 * local-state paths resolve to files wrangler never writes.
 */
function durableObjectNamespaceIdFromName(
    uniqueKey: string,
    name: string,
): string {
    const key = crypto.createHash('sha256').update(uniqueKey).digest();
    const nameHmac = crypto
        .createHmac('sha256', key)
        .update(name)
        .digest()
        .subarray(0, 16);
    const hmac = crypto
        .createHmac('sha256', key)
        .update(nameHmac)
        .digest()
        .subarray(0, 16);
    return Buffer.concat([nameHmac, hmac]).toString('hex');
}

/**
 * The unique key miniflare registers for the Durable Object class that
 * backs local D1 databases.
 */
const MINIFLARE_D1_UNIQUE_KEY = 'miniflare-D1DatabaseObject';

/**
 * Absolute path of the sqlite file backing a local D1 database, given the
 * state root (`<persistTo>/v3` or `<worker>/.wrangler/state/v3`) and the
 * database's `database_id` from wrangler.toml. Miniflare keys local D1
 * state by `database_id`, so every worker binding the same database maps
 * to the same file.
 */
export function miniflareD1SqlitePath(
    stateRoot: string,
    databaseId: string,
): string {
    return path.join(
        stateRoot,
        'd1',
        MINIFLARE_D1_UNIQUE_KEY,
        `${durableObjectNamespaceIdFromName(MINIFLARE_D1_UNIQUE_KEY, databaseId)}.sqlite`,
    );
}
