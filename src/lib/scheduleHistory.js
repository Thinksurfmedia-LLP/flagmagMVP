// Pure helpers for deleting a schedule safely. Deleting a schedule also
// deletes its games, which erases any scores/stats already recorded — so the
// API refuses unless the caller explicitly confirms. Pure CommonJS so it runs
// under `node --test`.

/** Unique, truthy Game ids linked from a schedule's weeks (order preserved). */
function collectGameRefs(schedule) {
    const refs = [];
    for (const week of schedule?.weeks || []) {
        for (const game of week?.games || []) {
            if (game?.gameRef && !refs.includes(game.gameRef)) refs.push(game.gameRef);
        }
    }
    return refs;
}

/** True when deleting would erase played games or recorded stats. */
function hasGameHistory({ completedGames = 0, inProgressGames = 0, plays = 0 }) {
    return completedGames > 0 || inProgressGames > 0 || plays > 0;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** e.g. "12 completed games, 2 in-progress games and 340 recorded plays". */
function describeGameHistory({ completedGames = 0, inProgressGames = 0, plays = 0 }) {
    const parts = [
        completedGames && plural(completedGames, "completed game"),
        inProgressGames && plural(inProgressGames, "in-progress game"),
        plays && plural(plays, "recorded play"),
    ].filter(Boolean);
    if (parts.length <= 1) return parts[0] || "no game history";
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

module.exports = { collectGameRefs, hasGameHistory, describeGameHistory };
