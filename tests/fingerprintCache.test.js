const test = require("node:test");
const assert = require("node:assert/strict");
const { createFingerprintCache } = require("../src/lib/fingerprintCache.js");

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};
const tick = () => new Promise((r) => setImmediate(r));

function setup(overrides = {}) {
    let now = 0;
    const errors = [];
    const cache = createFingerprintCache({
        maxAgeMs: 1000,
        maxEntries: 2,
        now: () => now,
        onBackgroundError: (e) => errors.push(e),
        ...overrides,
    });
    return { cache, errors, advance: (ms) => { now += ms; } };
}

test("computes on first call, then reuses while the fingerprint is unchanged", async () => {
    const { cache } = setup();
    let computes = 0;
    const opts = { fingerprint: async () => "v1", compute: async () => ++computes };
    assert.equal(await cache.get("k", opts), 1);
    assert.equal(await cache.get("k", opts), 1);
    assert.equal(computes, 1);
});

test("concurrent calls for the same key share one fingerprint check and one compute", async () => {
    const { cache } = setup();
    let fingerprints = 0;
    let computes = 0;
    const opts = { fingerprint: async () => { fingerprints++; return "v1"; }, compute: async () => ++computes };
    const results = await Promise.all([cache.get("k", opts), cache.get("k", opts), cache.get("k", opts)]);
    assert.deepEqual(results, [1, 1, 1]);
    assert.equal(fingerprints, 1);
    assert.equal(computes, 1);
});

test("serves the stale value immediately when the fingerprint changes, then the fresh one", async () => {
    const { cache } = setup();
    let version = "v1";
    const slow = deferred();
    let computes = 0;
    const opts = {
        fingerprint: async () => version,
        compute: () => (++computes === 1 ? Promise.resolve("old") : slow.promise),
    };
    assert.equal(await cache.get("k", opts), "old");

    version = "v2";
    assert.equal(await cache.get("k", opts), "old", "stale value returned without waiting");
    assert.equal(await cache.get("k", opts), "old", "refresh is not started twice");
    assert.equal(computes, 2);

    slow.resolve("new");
    await tick();
    assert.equal(await cache.get("k", opts), "new");
});

test("recomputes once an entry is older than maxAgeMs even with the same fingerprint", async () => {
    const { cache, advance } = setup();
    let computes = 0;
    const opts = { fingerprint: async () => "v1", compute: async () => ++computes };
    await cache.get("k", opts);
    advance(1001);
    assert.equal(await cache.get("k", opts), 1, "stale served while refreshing");
    await tick();
    assert.equal(await cache.get("k", opts), 2);
});

test("a failed first compute rejects and is not cached", async () => {
    const { cache } = setup();
    let calls = 0;
    const opts = {
        fingerprint: async () => "v1",
        compute: async () => { if (++calls === 1) throw new Error("boom"); return "ok"; },
    };
    await assert.rejects(cache.get("k", opts), /boom/);
    assert.equal(await cache.get("k", opts), "ok");
});

test("a failed background refresh keeps the stale value and reports the error", async () => {
    const { cache, errors } = setup();
    let version = "v1";
    let calls = 0;
    const opts = {
        fingerprint: async () => version,
        compute: async () => { if (++calls === 2) throw new Error("refresh failed"); return `r${calls}`; },
    };
    assert.equal(await cache.get("k", opts), "r1");
    version = "v2";
    assert.equal(await cache.get("k", opts), "r1");
    await tick();
    assert.equal(errors.length, 1);
    assert.equal(await cache.get("k", opts), "r1", "still stale; retries the refresh");
    await tick();
    assert.equal(await cache.get("k", opts), "r3");
});

test("has() reports whether any value (fresh or stale) is cached for a key", async () => {
    const { cache } = setup();
    assert.equal(cache.has("k"), false);
    await cache.get("k", { fingerprint: async () => "v1", compute: async () => 1 });
    assert.equal(cache.has("k"), true);
});

test("evicts the least recently refreshed key past maxEntries", async () => {
    const { cache } = setup();
    const computes = { a: 0, b: 0, c: 0 };
    const opts = (k) => ({ fingerprint: async () => "v1", compute: async () => ++computes[k] });
    await cache.get("a", opts("a"));
    await cache.get("b", opts("b"));
    await cache.get("c", opts("c"));
    await cache.get("a", opts("a"));
    assert.equal(computes.a, 2, "a was evicted and recomputed");
    assert.equal(computes.c, 1);
});
