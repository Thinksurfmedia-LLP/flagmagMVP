const test = require("node:test");
const assert = require("node:assert/strict");
const {
    parseJerseyNumber,
    findDuplicateActiveJerseys,
    findBlockingJerseyConflicts,
    getChangedEntries,
} = require("../src/lib/rosterJersey.js");

const entry = (player, jerseyNumber, active = true) => ({ player, jerseyNumber, active });

// ── parseJerseyNumber ──────────────────────────────────────────────

test("parseJerseyNumber accepts integers and numeric strings, including 0", () => {
    assert.deepEqual(parseJerseyNumber(0), { ok: true, value: 0 });
    assert.deepEqual(parseJerseyNumber("0"), { ok: true, value: 0 });
    assert.deepEqual(parseJerseyNumber(" 42 "), { ok: true, value: 42 });
    assert.deepEqual(parseJerseyNumber("07"), { ok: true, value: 7 });
});

test("parseJerseyNumber rejects blank, missing, non-numeric, negative and decimal values", () => {
    for (const bad of [undefined, null, "", "   ", "abc", "-1", -3, "4.5", 4.5]) {
        assert.equal(parseJerseyNumber(bad).ok, false, `expected ${JSON.stringify(bad)} to be rejected`);
    }
});

// ── findDuplicateActiveJerseys ─────────────────────────────────────

test("findDuplicateActiveJerseys returns empty array for a clean roster", () => {
    assert.deepEqual(findDuplicateActiveJerseys([entry("a", 1), entry("b", 2)]), []);
});

test("findDuplicateActiveJerseys groups active players sharing a number", () => {
    const result = findDuplicateActiveJerseys([entry("troy", 7), entry("ian", 88), entry("mikey", "7")]);
    assert.deepEqual(result, [{ jerseyNumber: 7, playerIds: ["troy", "mikey"] }]);
});

test("findDuplicateActiveJerseys ignores inactive players", () => {
    assert.deepEqual(findDuplicateActiveJerseys([entry("troy", 7, false), entry("mikey", 7)]), []);
});

test("findDuplicateActiveJerseys treats a missing active flag as active", () => {
    const result = findDuplicateActiveJerseys([{ player: "a", jerseyNumber: 3 }, { player: "b", jerseyNumber: 3 }]);
    assert.equal(result.length, 1);
});

// ── getChangedEntries ──────────────────────────────────────────────

test("getChangedEntries flags new players, number changes and reactivations only", () => {
    const prev = [entry("same", 1), entry("renumbered", 2), entry("reactivated", 3, false), entry("deactivated", 4)];
    const next = [entry("same", 1), entry("renumbered", 20), entry("reactivated", 3), entry("deactivated", 4, false), entry("new", 5)];
    const changed = getChangedEntries(prev, next).map((e) => e.player).sort();
    assert.deepEqual(changed, ["new", "reactivated", "renumbered"]);
});

// ── findBlockingJerseyConflicts (the GOAT bug) ─────────────────────

const goatPrev = [entry("troy", 7), entry("ian", 88), entry("mikey", 7), entry("tommy", 6)];

test("pre-existing duplicate does NOT block assigning an unused number (GOAT #42 case)", () => {
    const next = [...goatPrev, entry("charles", "42")];
    assert.deepEqual(findBlockingJerseyConflicts(goatPrev, next), []);
});

test("pre-existing duplicate does NOT block assigning #0 (GOAT #0 case)", () => {
    const next = [...goatPrev, entry("juan", "0")];
    assert.deepEqual(findBlockingJerseyConflicts(goatPrev, next), []);
});

test("pre-existing duplicate does NOT block removing an unrelated player", () => {
    const next = goatPrev.filter((p) => p.player !== "ian");
    assert.deepEqual(findBlockingJerseyConflicts(goatPrev, next), []);
});

test("pre-existing duplicate does NOT block deactivating an unrelated player", () => {
    const next = goatPrev.map((p) => (p.player === "tommy" ? { ...p, active: false } : p));
    assert.deepEqual(findBlockingJerseyConflicts(goatPrev, next), []);
});

test("adding a player onto a number already in use IS blocked", () => {
    const prev = [entry("ian", 88)];
    const next = [...prev, entry("charles", 88)];
    assert.deepEqual(findBlockingJerseyConflicts(prev, next), [{ jerseyNumber: 88, playerIds: ["ian", "charles"] }]);
});

test("adding a third player onto an existing duplicate IS blocked", () => {
    const next = [...goatPrev, entry("charles", 7)];
    const result = findBlockingJerseyConflicts(goatPrev, next);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].playerIds, ["troy", "mikey", "charles"]);
});

test("renumbering onto a taken number IS blocked", () => {
    const next = goatPrev.map((p) => (p.player === "tommy" ? { ...p, jerseyNumber: 88 } : p));
    assert.equal(findBlockingJerseyConflicts(goatPrev, next).length, 1);
});

test("reactivating onto a number now worn by someone else IS blocked", () => {
    const prev = [entry("old", 5, false), entry("current", 5)];
    const next = [entry("old", 5, true), entry("current", 5)];
    assert.equal(findBlockingJerseyConflicts(prev, next).length, 1);
});

test("resolving an existing duplicate by renumbering one side is allowed", () => {
    const next = goatPrev.map((p) => (p.player === "mikey" ? { ...p, jerseyNumber: 17 } : p));
    assert.deepEqual(findBlockingJerseyConflicts(goatPrev, next), []);
});

test("duplicate submitted in a brand-new roster (no previous roster) IS blocked", () => {
    const next = [entry("a", 9), entry("b", 9)];
    assert.equal(findBlockingJerseyConflicts([], next).length, 1);
});

test("accepts ObjectId-like player values by comparing as strings", () => {
    const oid = (s) => ({ toString: () => s });
    const prev = [{ player: oid("troy"), jerseyNumber: 7, active: true }, { player: oid("mikey"), jerseyNumber: 7, active: true }];
    const next = [entry("troy", "7"), entry("mikey", "7"), entry("new", "42")];
    assert.deepEqual(findBlockingJerseyConflicts(prev, next), []);
});
