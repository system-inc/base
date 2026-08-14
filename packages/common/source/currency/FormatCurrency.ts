// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Formats a number as USD currency, showing decimal places only when needed by default.
 * @param amount The number to format
 * @param locale Optional locale string (defaults to en-US)
 * @returns A formatted string (e.g., "$2,000" or "$2,000.50")
 */
export function formatCurrency(
    amount: number,
    options?: { locale?: string; minDecimals?: number },
): string {
    return amount.toLocaleString(options?.locale ?? 'en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits:
            options?.minDecimals ?? (amount % 1 !== 0 ? 2 : 0),
        maximumFractionDigits: 2,
    });
}
