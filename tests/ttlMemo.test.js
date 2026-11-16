const test = require("node:test");
const assert = require("node:assert/strict");
const { createTtlMemo } = require("../src/lib/ttlMemo.js");

const tick = () => new Promise((r) => setImmediate(r));

function setup(overrides = {}) {
    let now = 0;
    const errors = [];
    const memo = createTtlMemo({ ttlMs: 1000, now: () => now, onError: (e) => errors.push(e), ...overrides });
    return { memo, errors, advance: (ms) => { now += ms; } };
}

test("loads once and reuses the value while fresh", async () => {
    const { memo, advance } = setup();
    let loads = 0;
    const loader = async () => ++loads;
    assert.equal(await memo.get("k", loader), 1);
    advance(999);
    assert.equal(await memo.get("k", loader), 1);
    assert.equal(loads, 1);
});

test("concurrent first calls share one load", async () => {
    const { memo } = setup();
    let loads = 0;
    const loader = async () => { await tick(); return ++loads; };
    assert.deepEqual(await Promise.all([memo.get("k", loader), memo.get("k", loader)]), [1, 1]);
    assert.equal(loads, 1);
});

test("a stale value is returned immediately and reloaded in the background", async () => {
    const { memo, advance } = setup();
    let loads = 0;
    const loader = async () => ++loads;
    await memo.get("k", loader);
    advance(1000);
    assert.equal(await memo.get("k", loader), 1);
    await tick();
    assert.equal(await memo.get("k", loader), 2);
});

test("keys are independent", async () => {
    const { memo } = setup();
    assert.equal(await memo.get("a", async () => "A"), "A");
    assert.equal(await memo.get("b", async () => "B"), "B");
    assert.equal(await memo.get("a", async () => "other"), "A");
});

test("a failed first load rejects and is not cached", async () => {
    const { memo } = setup();
    await assert.rejects(memo.get("k", async () => { throw new Error("boom"); }), /boom/);
    assert.equal(await memo.get("k", async () => "ok"), "ok");
});

test("a failed background reload keeps serving the stale value and reports the error", async () => {
    const { memo, errors, advance } = setup();
    await memo.get("k", async () => "old");
    advance(1000);
    assert.equal(await memo.get("k", async () => { throw new Error("boom"); }), "old");
    await tick();
    assert.equal(errors.length, 1);
    assert.equal(await memo.get("k", async () => "new"), "old"); // still stale → serves old, reloads
    await tick();
    assert.equal(await memo.get("k", async () => "unused"), "new");
});

test("evicts the least recently loaded key past maxEntries", async () => {
    const { memo } = setup({ maxEntries: 2 });
    await memo.get("a", async () => 1);
    await memo.get("b", async () => 2);
    await memo.get("c", async () => 3);
    assert.equal(await memo.get("a", async () => "reloaded"), "reloaded");
    assert.equal(await memo.get("c", async () => "unused"), 3);
});
