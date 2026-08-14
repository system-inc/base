---
title: Unit Tests
description: Plain jest, plain constructors, and no container, worker, or framework setup.
---

Base's testing model has a hard split: **unit tests** are ordinary jest, colocated with the code, run with `npm test`; **integration tests** need a live worker and run with `base test` ([next guide](./02-integration-tests.md)). This guide is the easy half — deliberately easy, because the architecture does the work.

## Test services directly

`@Injectable()` doesn't change how a class constructs. Unit tests just `new` it:

```ts
// source/services/GreetingService.test.ts
import { GreetingService } from './GreetingService';

describe('GreetingService', () => {
    const service = new GreetingService();

    test('greets the world by default', () => {
        expect(service.greet()).toBe('Hello, world!');
    });

    test('greets a provided name, trimmed', () => {
        expect(service.greet('  Ada  ')).toBe('Hello, Ada!');
    });
});
```

For a service with dependencies, pass fakes straight into the constructor — DI's whole promise is that dependencies arrive as parameters:

```ts
const service = new NoteService(fakeRepository as OrmRepository<NoteEntity>);
```

This is why the guides keep saying "logic in services, orchestration in handlers": every rule you push into a plain service becomes testable at this level, with zero setup.

## Conventions

- Unit tests live **next to the code**: `GreetingService.ts` + `GreetingService.test.ts`.
- Integration tests live in the worker's `test/` folder and end in `.integration.test.ts` — the jest config excludes that suffix from `npm test`, so unit runs stay fast and worker-free.
- `npm test` (or `npx jest`) runs them; nothing Base-specific is involved.

## The scaffold's jest config, explained

Three settings in the scaffolded `jest.config.js` are load-bearing:

- `testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$']` — the unit/integration split.
- `transformIgnorePatterns: ['/node_modules/(?!@system-inc/base-)']`: the framework packages ship **TypeScript source**, so ts-jest must be allowed to transform them.
- `jest.setup.ts` loads the framework's integration setup **only when** `TEST_WORKER_NAME` is set, so plain `npm test` never pays for it.

Leave those in place and both halves of the split keep working.
