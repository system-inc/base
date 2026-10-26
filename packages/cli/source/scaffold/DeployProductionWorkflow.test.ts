// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';

const template = fs.readFileSync(
    path.resolve(
        __dirname,
        '../../templates/workspace/.github/workflows/deploy-production.yml.template',
    ),
    'utf8',
);

/**
 * The scaffolded production deploy runs on `workflow_run` after
 * Integration passes. A bare `actions/checkout` there checks out the
 * default branch's latest commit — which can be newer than, and untested
 * by, the run that triggered it — and cancelling an in-progress
 * production deploy can strand it half-applied.
 */
describe('scaffolded deploy-production workflow', () => {
    it('deploys the commit the Integration run tested', () => {
        expect(template).toMatch(
            /uses: actions\/checkout@v4\n\s+with:\n\s+ref: \$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}/,
        );
    });

    it('never cancels a production deploy in progress', () => {
        expect(template).toMatch(
            /group: deploy-production\n\s+cancel-in-progress: false/,
        );
        expect(template).not.toMatch(/cancel-in-progress: true/);
    });
});
