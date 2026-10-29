const test = require("node:test");
const assert = require("node:assert/strict");
const { deleteAccount, managedTeamsBlocker } = require("../src/lib/accountDeletion.js");

// Minimal stand-in for a mongoose query: awaitable, with chainable select/lean.
const query = (value) => {
    const q = Promise.resolve(value);
    q.select = () => q;
    q.lean = () => q;
    return q;
};

function fakeDeps({
    user = { _id: "u1", password: "hash" },
    teams = [],
    teamsInTransaction = teams,
    passwordOk = true,
    playerUpdateError = null,
} = {}) {
    const calls = [];
    const model = (name) => ({
        deleteMany: async (filter) => { calls.push([name, "deleteMany", filter]); },
        deleteOne: async (filter) => { calls.push([name, "deleteOne", filter]); },
        updateMany: async (filter, update) => {
            if (name === "Player" && playerUpdateError) throw playerUpdateError;
            calls.push([name, "updateMany", filter, update]);
        },
    });
    return {
        calls,
        deps: {
            User: { ...model("User"), findById: () => query(user) },
            // Outside the transaction (no session) vs. the re-check inside it.
            Team: { find: (_filter, _proj, opts) => query(opts?.session === "tx" ? teamsInTransaction : teams) },
            Activity: model("Activity"),
            Notification: model("Notification"),
            Payment: model("Payment"),
            Player: model("Player"),
            comparePassword: async () => passwordOk,
            inTransaction: async (fn) => fn("tx"),
        },
    };
}

test("deletes the user and cleans up everything that pointed at them", async () => {
    const { deps, calls } = fakeDeps();

    const result = await deleteAccount({ userId: "u1", password: "secret" }, deps);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(calls, [
        ["Activity", "deleteMany", { user: "u1" }],
        ["Notification", "updateMany", { triggeredBy: "u1" }, { $unset: { triggeredBy: 1 } }],
        ["Payment", "updateMany", { user: "u1" }, { $set: { user: null } }],
        ["Player", "updateMany", { user: "u1" }, { $unset: { user: 1 }, $set: { email: "", phone: "" } }],
        ["User", "deleteOne", { _id: "u1" }],
    ]);
});

test("keeps payments, only unlinking them from the user", async () => {
    const { deps, calls } = fakeDeps();

    await deleteAccount({ userId: "u1", password: "secret" }, deps);

    assert.equal(calls.some(([model, op]) => model === "Payment" && op.startsWith("delete")), false);
});

test("rejects a wrong password without touching any data", async () => {
    const { deps, calls } = fakeDeps({ passwordOk: false });

    const result = await deleteAccount({ userId: "u1", password: "wrong" }, deps);

    assert.deepEqual(result, { ok: false, status: 401, error: "Incorrect password" });
    assert.equal(calls.length, 0);
});

test("requires a password", async () => {
    const { deps, calls } = fakeDeps();

    const result = await deleteAccount({ userId: "u1", password: "" }, deps);

    assert.equal(result.status, 400);
    assert.equal(calls.length, 0);
});

test("returns 404 when the account no longer exists", async () => {
    const { deps } = fakeDeps({ user: null });

    const result = await deleteAccount({ userId: "u1", password: "secret" }, deps);

    assert.equal(result.status, 404);
});

test("refuses while the user manages a team, naming the team", async () => {
    const { deps, calls } = fakeDeps({ teams: [{ name: "Raiders" }] });

    const result = await deleteAccount({ userId: "u1", password: "secret" }, deps);

    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
    assert.match(result.error, /Raiders/);
    assert.equal(calls.length, 0);
});

test("refuses when the user became a team manager after the first check", async () => {
    const { deps, calls } = fakeDeps({ teams: [], teamsInTransaction: [{ name: "Late Team" }] });

    const result = await deleteAccount({ userId: "u1", password: "secret" }, deps);

    assert.equal(result.status, 409);
    assert.match(result.error, /Late Team/);
    assert.equal(calls.some(([model]) => model === "User"), false);
});

test("a player-profile index collision returns a clean 409 instead of a raw Mongo error", async () => {
    const dup = Object.assign(new Error("E11000 duplicate key error collection: players"), { code: 11000 });
    const { deps } = fakeDeps({ playerUpdateError: dup });

    const result = await deleteAccount({ userId: "u1", password: "secret" }, deps);

    assert.equal(result.status, 409);
    assert.doesNotMatch(result.error, /E11000/);
});

test("other errors still propagate", async () => {
    const { deps } = fakeDeps({ playerUpdateError: new Error("connection lost") });

    await assert.rejects(deleteAccount({ userId: "u1", password: "secret" }, deps), /connection lost/);
});

test("blocker message: null with no teams, lists every managed team otherwise", () => {
    assert.equal(managedTeamsBlocker([]), null);
    assert.equal(managedTeamsBlocker(undefined), null);
    assert.match(managedTeamsBlocker([{ name: "A" }, { name: "B" }]), /teams A, B/);
});
