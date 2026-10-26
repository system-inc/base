// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ScheduledExecutableStatus } from '@system-inc/base-common/scheduled/ScheduledExecutableStatus';
import { getBaseMetadata } from '../base/BaseMetadata';
import { BaseInjectionContainer } from '../dependency-injection/BaseInjectionContainer';
import { ScheduledRunner } from '../internal/scheduled/ScheduledRunner';
import { OrmRepository } from '../orm/database/repository/OrmRepository';
import { OrmTable } from '../orm/decorators/OrmTable';
import { OrmPersistedScheduledExecutable } from './OrmPersistedScheduledExecutable';
import { OrmScheduledExecutableEntity } from './OrmScheduledExecutableEntity';
import { ScheduledExecutableContext } from './ScheduledExecutableContext';

@OrmTable('ps_run')
class PsRun extends OrmScheduledExecutableEntity {}

/**
 * The repository surface the executable uses, recording what each write
 * persisted (a snapshot, since the executable mutates the entity it
 * passes in). `failUpdates` simulates the database going away mid-run.
 */
class RecordingRepository {
    readonly persisted: Array<{ status: string; message: string | null }> = [];
    failUpdates = false;

    async findOne(): Promise<PsRun | null> {
        return null;
    }

    async insert(entity: PsRun): Promise<void> {
        this.persisted.push({ status: entity.status, message: null });
    }

    async update(entity: PsRun): Promise<void> {
        if (this.failUpdates) {
            throw new Error('database unavailable');
        }
        this.persisted[this.persisted.length - 1] = {
            status: entity.status,
            message: entity.message ?? null,
        };
    }
}

let repository: RecordingRepository;
let runBehavior: () => Promise<boolean | void>;

class NightlySync extends OrmPersistedScheduledExecutable<PsRun> {
    constructor() {
        super(
            PsRun,
            repository as unknown as OrmRepository<PsRun>,
            'nightly-sync',
        );
    }

    protected run(): Promise<boolean | void> {
        return runBehavior();
    }
}

const container = {
    resolve: (ctor: unknown) =>
        ctor === NightlySync
            ? new NightlySync()
            : // the runner defers failures onto the event bus
              { defer: () => {} },
} as unknown as BaseInjectionContainer;

const cron = '3 3 3 3 3';
getBaseMetadata().scheduled.addScheduledExecutable(NightlySync, cron);

function runScheduled(): Promise<void> {
    const context: ScheduledExecutableContext = {
        type: 'scheduled',
        cron,
        scheduledTime: 0,
        noRetry: () => {},
        container,
    };
    return new ScheduledRunner(container, [NightlySync], 1).runScheduled(
        context,
        cron,
    );
}

beforeEach(() => {
    repository = new RecordingRepository();
});

/**
 * A thrown error inside a persisted executable was caught, recorded, and
 * swallowed — so the scheduled run reported success, a Durable Object
 * alarm wasn't retried, and unhandled-exception listeners never heard of
 * it. It is now recorded and rethrown.
 */
describe('OrmPersistedScheduledExecutable failures', () => {
    it('records a thrown error as Failed and rethrows it to the platform', async () => {
        runBehavior = async () => {
            throw new Error('upstream API down');
        };

        await expect(runScheduled()).rejects.toThrow('upstream API down');

        const [run] = repository.persisted;
        expect(run?.status).toBe(ScheduledExecutableStatus.Failed);
        expect(run?.message).toContain('upstream API down');
    });

    it('rethrows the original error even when recording the failure fails', async () => {
        runBehavior = async () => {
            // the database goes away mid-run, so the Failed update throws too
            repository.failUpdates = true;
            throw new Error('upstream API down');
        };

        await expect(runScheduled()).rejects.toThrow('upstream API down');
    });

    it('records a non-Error throw that JSON cannot stringify', async () => {
        runBehavior = async () => {
            throw { amount: BigInt(5) };
        };

        await expect(runScheduled()).rejects.toEqual({ amount: BigInt(5) });

        const [run] = repository.persisted;
        expect(run?.status).toBe(ScheduledExecutableStatus.Failed);
    });

    it('treats `return false` as a recorded soft failure, without throwing', async () => {
        runBehavior = async () => false;

        await expect(runScheduled()).resolves.toBeUndefined();

        const [run] = repository.persisted;
        expect(run?.status).toBe(ScheduledExecutableStatus.Failed);
    });

    it('records success as Completed', async () => {
        runBehavior = async () => {};

        await runScheduled();

        const [run] = repository.persisted;
        expect(run?.status).toBe(ScheduledExecutableStatus.Completed);
    });
});
