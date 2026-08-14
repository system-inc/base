// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsOptional } from './VerifyIsOptional';

describe('VerifyIsOptional', () => {
    // VerifyIsOptional is a sentinel — its `.check` always returns true.
    // The short-circuit behavior on null/undefined lives in the engine
    // itself and is covered by ValidationEngine.test.ts.
    test('.check always returns true', () => {
        expect(VerifyIsOptional.check(undefined)).toBe(true);
        expect(VerifyIsOptional.check(null)).toBe(true);
        expect(VerifyIsOptional.check('anything')).toBe(true);
        expect(VerifyIsOptional.check(0)).toBe(true);
    });
});
