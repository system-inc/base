---
title: Containers
description: Run a full Base worker in a Docker container on Cloudflare, for native dependencies and heavy work.
---

Some work doesn't fit a V8 isolate: native libraries (image processing, ffmpeg), long computations, big memory. Cloudflare Containers run Docker images next to your workers, and in Base, the thing inside the container is _another ordinary Base worker_, so your programming model doesn't change at the boundary.

## The layout

A container worker is a worker with a `container/` subfolder holding its own entry, settings, and Dockerfile:

```
workers/image-worker/
├── index.ts              # the container class (Durable Object side)
├── settings.ts           # outer worker settings
├── wrangler.toml
└── container/            # the containerized Base worker
    ├── index.ts          # ordinary BaseWorker.create(...)
    ├── settings.ts       # ordinary BaseSettings — port matches the container
    ├── package.json      # native deps installed inside the image
    ├── env.toml
    └── Dockerfile
```

## The outer worker

Containers sit on Durable Objects, so the outer entry declares a container class:

```ts
import { CfContainer } from '@system-inc/base-foundation/cloudflare/durable-object/container/core/CfContainer';
import { CfContainerWorker } from '@system-inc/base-foundation/cloudflare/durable-object/container/core/CfContainerWorker';

export class ImageWorkerContainer extends CfContainer {
    defaultPort = 8080; // the port the containerized worker listens on
    sleepAfter = '10m'; // stop the instance after 10 idle minutes
}

export default new CfContainerWorker(ImageWorkerContainer, [
    'Development',
    'Integration',
]);
```

`wrangler.toml` pairs a `containers` entry with a `durable_objects` binding for the same class, plus `new_sqlite_classes` in the migrations block:

```toml
[env.Production]
containers = [
    { image = "./container/Dockerfile", class_name = "ImageWorkerContainer", max_instances = 5, instance_type = "basic" }
]
durable_objects = { bindings = [
    { name = "ImageWorkerContainer", class_name = "ImageWorkerContainer" }
] }
```

## The inner worker

`container/index.ts` and `container/settings.ts` are a completely normal Base worker (`BaseWorker.create(settings)`, `services`, RPC, the lot) with `server.port` matching `defaultPort`. Native dependencies go in `container/package.json` and are installed inside the image, where their bindings match the container's architecture.

The Dockerfile consumes the CLI's build output: `base container dist` bundles the worker script and a Node bootstrap into `container/dist/`, and the image's command is `node ./bootstrap.js <worker-name> ./workers ./<worker>.js`. You rarely run that yourself — **`develop`, `deploy`, and `bundle` build the container automatically** whenever a `container/` folder exists.

## Calling into the container

Same shape as [Durable Objects](./03-durable-objects.md) — a provider yields handles with a typed RPC client:

```ts
import { CfContainerProvider } from '@system-inc/base-foundation/cloudflare/durable-object/container/CfContainerProvider';

const provider = CfContainerProvider.create<ImageWorkerInterface>(
    'ImageWorkerContainer',
    configuration,
);

const result = await provider.getContainer().rpc.call().resizeImage(input);
```

With no input, containers default to a shared singleton instance (unlike DOs' unique-per-call); `getContainer({ name })` pins by name, and `getRandomContainer(instances)` fans out across a small pool. Because the interface is a shared TypeScript type, calling into the container reads exactly like calling any other worker — the Docker boundary disappears from the code.
