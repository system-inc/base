---
title: Create a Module
description: Bundle entities, services, and configuration into a reusable unit any worker can register.
---

A module is a self-contained bundle of functionality — entities, services (HTTP, GraphQL, RPC, queue processors, scheduled jobs), middleware, providers — that a worker registers with one line. Everything in System, Inc.'s companion module library (Account, Post, …) is built this way, and your application features can be too.

## The smallest module

Three parts: a **key**, a **factory** that calls `BaseModule.create`, and the module's contents:

```ts
import { BaseModuleKey } from '@system-inc/base-foundation/configuration/BaseModuleKey';
import { BaseModule } from '@system-inc/base-foundation/module/BaseModule';
import { NoteEntity } from './entities/NoteEntity';
import { NoteService } from './services/NoteService';

export const NotesModuleKey = BaseModuleKey.create('Notes');

export function Notes(): BaseModule<unknown> {
    return BaseModule.create({
        key: NotesModuleKey,
        settings: {
            orm: { entities: [NoteEntity] },
            services: [NoteService],
        },
    });
}
```

- The **key** is the module's identity: used for dependency declarations, settings lookup, and [module membership](../orm/07-multiple-databases.md#module-aware-routing).
- `BaseModule.create` is the only way in; the constructor is private.
- `services` is the same single self-describing list as at the worker level: each class's decorator declares its role, and a listed class with no recognized decorator is a boot error.

A worker registers it by calling the factory in `settings.ts`:

```ts
    modules: [Notes()],
```

## A module with settings

Give the key a settings type and the factory a parameter — the generic flows through so consumers get typed configuration:

```ts
export interface NotesModuleSettings {
    readonly maxNoteLength?: number;
    readonly enableSharing?: boolean;
}

export const NotesModuleKey =
    BaseModuleKey.create<NotesModuleSettings>('Notes');

export function Notes(
    settings?: NotesModuleSettings,
): BaseModule<NotesModuleSettings> {
    const services: Constructor[] = [NoteService];
    if (settings?.enableSharing) {
        services.push(NoteSharingService);
    }
    return BaseModule.create<NotesModuleSettings>({
        key: NotesModuleKey,
        settings: {
            orm: { entities: [NoteEntity] },
            services,
            ...settings,
        },
    });
}
```

```ts
    modules: [Notes({ enableSharing: true })],
```

At runtime, any service reads the merged settings back through the key: `configuration.getModuleSettings(NotesModuleKey)` — fully typed.

One hazard in this pattern: `...settings` spread **last** will clobber any framework key (`orm`, `services`, …) that happens to exist on your settings interface. Keep module-specific settings interfaces free of the framework's key names, or spread first and place framework keys after.

## Lifecycle

`BaseModule.create` accepts two hooks:

- **`onInitialize(settings, configuration)`**: runs during worker boot, once configuration exists. The place for startup work; may be async.
- **`onCreate(settings)`**: runs synchronously at `create()` time, before boot. Useful for decoration-time metadata (registering roles, validating a cron expression from settings) — fail fast here and a misconfigured worker won't even construct.

Next: [the full settings surface and dependencies](./02-settings-and-dependencies.md).
