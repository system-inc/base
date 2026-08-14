// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * The platform is the system the worker is going to be running on.
 */
export enum PlatformType {
    CloudflareWorker = 'CloudflareWorker',
    CloudflareDurableObject = 'CloudflareDurableObject',
    Node = 'Node',
}

/**
 * The platform the worker is running on, parsed from the `PLATFORM`
 * environment variable. Defaults to Cloudflare (which sets no platform
 * variable); `Base` switches on this to select the platform delegate.
 */
export class Platform {
    readonly type: PlatformType;

    constructor(platform?: PlatformType) {
        // if the platform isn't specified, then default to Cloudflare
        // we need this because Cloudflare doesn't specify a platform
        // in the environment variables
        this.type = platform ?? PlatformType.CloudflareWorker;
    }

    /**
     * True if running on the Cloudflare platform.
     *
     * @returns boolean true if the platform is Cloudflare.
     */
    get isCloudflare(): boolean {
        return (
            this.type === PlatformType.CloudflareWorker ||
            this.type === PlatformType.CloudflareDurableObject
        );
    }

    /**
     * True if running on the Node platform.
     *
     * @returns boolean true if the platform is Node.
     */
    get isNode(): boolean {
        return this.type === PlatformType.Node;
    }
}
