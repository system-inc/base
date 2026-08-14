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
        '0000_crazy_phil_sheldon',
        '0001_mean_nekra',
        '0002_faulty_mongu',
    ] as string[],
};
