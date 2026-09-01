/**
 * Shared input validators used on both client forms and API route handlers.
 */

/**
 * Loosely validates a phone number: optional leading "+", digits/spaces/
 * dashes/dots/parens only, 7–15 digits total (E.164 max length). An empty
 * value is treated as valid since phone fields in this app are optional —
 * callers that require a phone number should check for presence separately.
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhoneNumber(phone) {
    if (!phone || !phone.trim()) return true;
    const trimmed = phone.trim();
    if (!/^\+?[\d\s().-]+$/.test(trimmed)) return false;
    const digitCount = trimmed.replace(/\D/g, "").length;
    return digitCount >= 7 && digitCount <= 15;
}
