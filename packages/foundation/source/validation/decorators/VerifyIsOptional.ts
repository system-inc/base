// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Marks the property as optional. When the value is `null` or
 * `undefined`, every other rule on the property is skipped.
 *
 * The rule itself always passes — it serves as a sentinel read by
 * the {@link ValidationEngine}.
 *
 * @example
 * ```ts
 * @VerifyIsOptional()
 * @VerifyIsEmail()
 * email?: string;
 * ```
 */
export const VerifyIsOptional = registerRule<void>({
    name: 'IsOptional',
    check: () => true,
    defaultMessage: '',
});
