// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// Migration tags that have been released — never modified after this.
// Squash / regenerate is only allowed for migrations NOT in this list.
//
// Add new tags here (or run `base orm migrations:release`) when ready
// to deploy. `base deploy` refuses any non-Development environment if
// migrations on disk are missing from this list.
export default {
    released: [
        '0000_melted_dust',
        '0001_kind_sir_ram',
        '0002_familiar_gamma_corps',
        '0003_naive_fenris',
    ] as string[],
};
