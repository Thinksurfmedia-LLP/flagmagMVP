const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeAmount, MIN_AMOUNT, MAX_AMOUNT } = require("../src/lib/payments/amount.js");

test("accepts a plain valid amount", () => {
    const result = normalizeAmount(25);
    assert.equal(result.ok, true);
    assert.equal(result.value, 25);
});

test("accepts a numeric string with 2 decimals", () => {
    const result = normalizeAmount("19.99");
    assert.equal(result.ok, true);
    assert.equal(result.value, 19.99);
});

test("rejects missing amount", () => {
    assert.equal(normalizeAmount(undefined).ok, false);
    assert.equal(normalizeAmount(null).ok, false);
    assert.equal(normalizeAmount("").ok, false);
});

test("rejects non-numeric input", () => {
    assert.equal(normalizeAmount("free money please").ok, false);
    assert.equal(normalizeAmount(NaN).ok, false);
});

test("rejects more than 2 decimal places", () => {
    assert.equal(normalizeAmount(12.345).ok, false);
});

test(`rejects below $${MIN_AMOUNT}`, () => {
    const result = normalizeAmount(MIN_AMOUNT - 0.01);
    assert.equal(result.ok, false);
});

test(`accepts exactly $${MIN_AMOUNT} and $${MAX_AMOUNT}`, () => {
    assert.equal(normalizeAmount(MIN_AMOUNT).ok, true);
    assert.equal(normalizeAmount(MAX_AMOUNT).ok, true);
});

test(`rejects above $${MAX_AMOUNT}`, () => {
    const result = normalizeAmount(MAX_AMOUNT + 0.01);
    assert.equal(result.ok, false);
});
