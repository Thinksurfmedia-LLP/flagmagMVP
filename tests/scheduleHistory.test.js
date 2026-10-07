const test = require("node:test");
const assert = require("node:assert/strict");
const { collectGameRefs, hasGameHistory, describeGameHistory, summarizeGameHistory } = require("../src/lib/scheduleHistory.js");

test("collectGameRefs gathers every linked game id across weeks", () => {
    const schedule = {
        weeks: [
            { games: [{ gameRef: "a" }, { gameRef: "b" }, { gameRef: null }] },
            { games: [{ gameRef: "c" }, {}] },
            { games: undefined },
        ],
    };
    assert.deepEqual(collectGameRefs(schedule), ["a", "b", "c"]);
});

test("collectGameRefs de-duplicates and tolerates missing weeks", () => {
    assert.deepEqual(collectGameRefs({ weeks: [{ games: [{ gameRef: "a" }, { gameRef: "a" }] }] }), ["a"]);
    assert.deepEqual(collectGameRefs({}), []);
    assert.deepEqual(collectGameRefs(null), []);
});

test("hasGameHistory is false when nothing was played or recorded", () => {
    assert.equal(hasGameHistory({ completedGames: 0, inProgressGames: 0, plays: 0 }), false);
});

test("hasGameHistory is true for completed games, live games, or recorded plays", () => {
    assert.equal(hasGameHistory({ completedGames: 1, inProgressGames: 0, plays: 0 }), true);
    assert.equal(hasGameHistory({ completedGames: 0, inProgressGames: 1, plays: 0 }), true);
    assert.equal(hasGameHistory({ completedGames: 0, inProgressGames: 0, plays: 5 }), true);
});

test("describeGameHistory words the counts and pluralises correctly", () => {
    assert.equal(
        describeGameHistory({ completedGames: 1, inProgressGames: 0, plays: 1 }),
        "1 completed game and 1 recorded play"
    );
    assert.equal(
        describeGameHistory({ completedGames: 12, inProgressGames: 2, plays: 340 }),
        "12 completed games, 2 in-progress games and 340 recorded plays"
    );
});

test("summarizeGameHistory maps one game's status and play count to history counts", () => {
    assert.deepEqual(summarizeGameHistory("completed", 40), { completedGames: 1, inProgressGames: 0, plays: 40 });
    assert.deepEqual(summarizeGameHistory("in_progress", 3), { completedGames: 0, inProgressGames: 1, plays: 3 });
    assert.deepEqual(summarizeGameHistory("upcoming", 0), { completedGames: 0, inProgressGames: 0, plays: 0 });
    assert.deepEqual(summarizeGameHistory("cancelled", 0), { completedGames: 0, inProgressGames: 0, plays: 0 });
});

test("an upcoming game with no plays has no history to protect; one with plays does", () => {
    assert.equal(hasGameHistory(summarizeGameHistory("upcoming", 0)), false);
    assert.equal(hasGameHistory(summarizeGameHistory("upcoming", 2)), true);
});
