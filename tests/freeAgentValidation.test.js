const test = require("node:test");
const assert = require("node:assert/strict");
const {
    validateFreeAgentFields,
    validatePassword,
    isValidEmail,
    isValidPhone,
    MAX_NAME_LENGTH,
} = require("../src/lib/freeAgentValidation.js");

test("isValidEmail accepts normal addresses", () => {
    for (const email of ["jordan.lee@example.com", "a+tag@sub.domain.co", "x_y@mail.io"]) {
        assert.equal(isValidEmail(email), true, email);
    }
});

test("isValidEmail rejects malformed addresses", () => {
    for (const email of ["joli", "joli@", "@example.com", "joli@example", "jo li@example.com", "joli@example.c", "joli@@example.com", "joli@.com", "joli@example..com"]) {
        assert.equal(isValidEmail(email), false, email);
    }
});

test("isValidPhone accepts common formats and rejects junk", () => {
    for (const phone of ["555-201-4477", "+1 (555) 201-4477", "5552014477", "+44 20 7946 0958"]) {
        assert.equal(isValidPhone(phone), true, phone);
    }
    for (const phone of ["abc", "12345", "555-CALL-NOW", "1234567890123456"]) {
        assert.equal(isValidPhone(phone), false, phone);
    }
});

test("validateFreeAgentFields trims and normalizes valid input", () => {
    const { values, errors } = validateFreeAgentFields({ name: "  Jordan Lee ", email: " Jordan@Example.COM ", phone: " 555-201-4477 " });
    assert.deepEqual(errors, {});
    assert.deepEqual(values, { name: "Jordan Lee", email: "jordan@example.com", phone: "555-201-4477" });
});

test("validateFreeAgentFields reports a per-field error for each bad field", () => {
    const { errors } = validateFreeAgentFields({ name: "", email: "joli", phone: "abc" });
    assert.ok(errors.name);
    assert.ok(errors.email);
    assert.ok(errors.phone);
});

test("validateFreeAgentFields requires email only when asked", () => {
    assert.equal(validateFreeAgentFields({ name: "Jordan", email: "" }).errors.email, undefined);
    assert.ok(validateFreeAgentFields({ name: "Jordan", email: "" }, { requireEmail: true }).errors.email);
});

test("validateFreeAgentFields rejects names that are too long or have no letters", () => {
    assert.ok(validateFreeAgentFields({ name: "a".repeat(MAX_NAME_LENGTH + 1) }).errors.name);
    assert.ok(validateFreeAgentFields({ name: "12345" }).errors.name);
    assert.equal(validateFreeAgentFields({ name: "Savai'i Cravens" }).errors.name, undefined);
});

test("validateFreeAgentFields tolerates non-string input without throwing", () => {
    const { errors } = validateFreeAgentFields({ name: 42, email: {}, phone: null });
    assert.ok(errors.name);
});

test("validatePassword enforces length and confirmation", () => {
    assert.ok(validatePassword("", ""));
    assert.ok(validatePassword("abc", "abc"));
    assert.ok(validatePassword("changeme123", "changeme124"));
    assert.equal(validatePassword("changeme123", "changeme123"), null);
    assert.equal(validatePassword("changeme123"), null);
});
