// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { PartialDictionary } from '@system-inc/base-common/type/Dictionary';
import {
    HttpParameterMetadata,
    HttpRouteMetadata,
} from './RouterMetadataTypes';

export interface RouterServiceMetadata {
    serviceCtor: Constructor;
    routes: PartialDictionary<RouterRouteMetadata>;
}

export interface RouterRouteMetadata extends HttpRouteMetadata {
    parameters: HttpParameterMetadata[];
}

const META = new Map<Constructor, RouterServiceMetadata>();

export function routerMetadataAddService(
    service: Constructor,
): RouterServiceMetadata {
    let serviceMetadata = META.get(service);
    if (!serviceMetadata) {
        serviceMetadata = {
            serviceCtor: service,
            routes: {},
        };
        META.set(service, serviceMetadata);
    }
    return serviceMetadata;
}

export function routerMetadataAddRoute(
    service: Constructor,
    route: HttpRouteMetadata,
): RouterServiceMetadata {
    const serviceMetadata = routerMetadataAddService(service);
    if (!serviceMetadata.routes[route.routeHandler]) {
        serviceMetadata.routes[route.routeHandler] = {
            ...route,
            parameters: [],
        };
    } else {
        const existingRoute = serviceMetadata.routes[route.routeHandler];
        serviceMetadata.routes[route.routeHandler] = {
            ...existingRoute,
            ...route,
            parameters: existingRoute?.parameters || [],
        };
    }
    return serviceMetadata;
}

export function routerMetadataAddParameter(
    service: Constructor,
    routeHandler: string,
    parameter: HttpParameterMetadata,
): RouterServiceMetadata {
    const serviceMetadata = routerMetadataAddService(service);
    let routeMeta = serviceMetadata.routes[routeHandler];
    if (!routeMeta) {
        routeMeta = {
            method: 'GET',
            parameters: [],
            path: '',
            routeHandler: '',
            parameterLength: 0,
        };
        serviceMetadata.routes[routeHandler] = routeMeta;
    }
    routeMeta.parameters[parameter.index] = parameter;
    return serviceMetadata;
}

export function routerMetadataGetServices(): RouterServiceMetadata[] {
    return Array.from(META.values());
}

/**
 * Collect the route metadata for a service, including routes it inherits
 * from base classes. Route metadata is keyed by the constructor that
 * declared the method, so a subclass registered as the `@HttpService`
 * would otherwise expose none of its base class's `@HttpRoute` methods.
 * Walks the prototype chain base-first, so a subclass overriding a
 * route handler by name wins.
 */
export function routerMetadataGetRoutesWithInherited(
    service: Constructor,
): PartialDictionary<RouterRouteMetadata> {
    const chain: Constructor[] = [];
    let constructor: Constructor | undefined = service;
    while (constructor && constructor.name) {
        chain.push(constructor);
        constructor = Object.getPrototypeOf(constructor) as
            | Constructor
            | undefined;
    }

    const merged: PartialDictionary<RouterRouteMetadata> = {};
    // base-first so the most-derived declaration overrides on name collision
    for (let index = chain.length - 1; index >= 0; index--) {
        const serviceMetadata = META.get(chain[index]);
        if (!serviceMetadata) {
            continue;
        }
        for (const [routeHandler, route] of Object.entries(
            serviceMetadata.routes,
        )) {
            if (route) {
                merged[routeHandler] = route;
            }
        }
    }
    return merged;
}

export function routerMetadataGetService(
    service: Constructor,
): RouterServiceMetadata | undefined {
    return META.get(service);
}
