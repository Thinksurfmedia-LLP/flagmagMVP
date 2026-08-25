// Pure, dependency-free amount validation for the custom-payment flow.
// Deliberately importable by relative path (no "@/" alias) so it can run
// under `node --test` without the Next.js module resolver.

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 5000;

/**
 * Validate a user-submitted payment amount.
 * @param {unknown} input - raw amount from the client (string or number)
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
function normalizeAmount(input) {
    if (input === null || input === undefined || input === "") {
        return { ok: false, error: "Amount is required" };
    }

    const value = typeof input === "string" ? Number(input.trim()) : input;

    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
        return { ok: false, error: "Amount must be a valid number" };
    }

    // Reject more than 2 decimal places (e.g. 12.345) instead of silently
    // rounding — rounding money without the caller asking for it hides the
    // fact their input didn't mean what they typed.
    const rounded = Math.round(value * 100) / 100;
    if (Math.abs(rounded - value) > Number.EPSILON) {
        return { ok: false, error: "Amount can have at most 2 decimal places" };
    }

    if (rounded < MIN_AMOUNT) {
        return { ok: false, error: `Amount must be at least $${MIN_AMOUNT.toFixed(2)}` };
    }

    if (rounded > MAX_AMOUNT) {
        return { ok: false, error: `Amount cannot exceed $${MAX_AMOUNT.toFixed(2)}` };
    }

    return { ok: true, value: rounded };
}

module.exports = { normalizeAmount, MIN_AMOUNT, MAX_AMOUNT };
