// Field validation for free-agent profiles, shared by the admin Add/Edit
// forms (inline errors) and the API routes that save them (the real gate).
// Pure CommonJS so it runs under `node --test`.

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15; // E.164 maximum

// local@domain.tld — no spaces, one "@", dot-separated non-empty domain
// labels, and a TLD of at least two letters.
const EMAIL_RE = /^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
// Digits plus the usual separators: + ( ) - . and spaces.
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;
const HAS_LETTER_RE = /\p{L}/u;

const asTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");

function isValidEmail(email) {
    return typeof email === "string" && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

function isValidPhone(phone) {
    if (typeof phone !== "string" || !PHONE_CHARS_RE.test(phone)) return false;
    const digits = phone.replace(/\D/g, "").length;
    return digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS;
}

/**
 * @param {{ name?: unknown, email?: unknown, phone?: unknown }} input
 * @param {{ requireEmail?: boolean }} [options]
 * @returns {{ values: { name: string, email: string, phone: string }, errors: Record<string, string> }}
 */
function validateFreeAgentFields(input, { requireEmail = false } = {}) {
    const source = input && typeof input === "object" ? input : {};
    const values = {
        name: asTrimmedString(source.name),
        email: asTrimmedString(source.email).toLowerCase(),
        phone: asTrimmedString(source.phone),
    };
    const errors = {};

    if (!values.name) errors.name = "Name is required";
    else if (values.name.length > MAX_NAME_LENGTH) errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer`;
    else if (!HAS_LETTER_RE.test(values.name)) errors.name = "Name must contain letters";

    if (!values.email) {
        if (requireEmail) errors.email = "Email is required";
    } else if (!isValidEmail(values.email)) {
        errors.email = "Enter a valid email address (e.g. name@example.com)";
    }

    if (values.phone && !isValidPhone(values.phone)) {
        errors.phone = `Enter a valid phone number (${MIN_PHONE_DIGITS}-${MAX_PHONE_DIGITS} digits)`;
    }

    return { values, errors };
}

/** Error message for a bad password (and confirmation, when given), or null. */
function validatePassword(password, confirmPassword) {
    if (typeof password !== "string" || !password) return "Password is required";
    if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    if (password.length > MAX_PASSWORD_LENGTH) return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`;
    if (confirmPassword !== undefined && password !== confirmPassword) return "Passwords do not match";
    return null;
}

module.exports = {
    validateFreeAgentFields,
    validatePassword,
    isValidEmail,
    isValidPhone,
    MAX_NAME_LENGTH,
    MIN_PASSWORD_LENGTH,
};
