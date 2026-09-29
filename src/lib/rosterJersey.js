// Pure, dependency-free jersey-number rules for team rosters. Shared by
// PUT /api/teams/[id], the player create/edit routes, the admin Manage
// Players modal and scripts/find-duplicate-jerseys.mjs. Deliberately
// importable by relative path (no "@/" alias) so it runs under `node --test`.
//
// Roster entries look like Team.players[]: { player, jerseyNumber, active }.
// `player` may be an ObjectId or string; `jerseyNumber` may be a number or
// the raw string from a form input; a missing `active` means active (the
// schema default).

/**
 * Parse a jersey number from user input. 0 is a valid number.
 * @param {unknown} input
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
function parseJerseyNumber(input) {
    if (input === undefined || input === null) return { ok: false, error: "Jersey number is required" };
    const raw = typeof input === "string" ? input.trim() : input;
    if (raw === "") return { ok: false, error: "Jersey number is required" };
    if (typeof raw === "string" && !/^\d+$/.test(raw)) {
        return { ok: false, error: "Jersey number must be a whole number (0 or higher)" };
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
        return { ok: false, error: "Jersey number must be a whole number (0 or higher)" };
    }
    return { ok: true, value };
}

function normalizeEntry(entry) {
    return {
        player: String(entry.player?._id ?? entry.player),
        jerseyNumber: Number(entry.jerseyNumber),
        active: entry.active !== false,
    };
}

/**
 * Every jersey number worn by more than one ACTIVE player.
 * @param {Array<object>} players
 * @returns {Array<{ jerseyNumber: number, playerIds: string[] }>}
 */
function findDuplicateActiveJerseys(players) {
    const byNumber = new Map();
    for (const p of (players || []).map(normalizeEntry)) {
        if (!p.active) continue;
        byNumber.set(p.jerseyNumber, [...(byNumber.get(p.jerseyNumber) || []), p.player]);
    }
    return [...byNumber.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([jerseyNumber, playerIds]) => ({ jerseyNumber, playerIds }));
}

/**
 * Entries in `nextPlayers` that this save actually changes in a way that can
 * create a clash: newly added, jersey number changed, or reactivated.
 * @returns {Array<{ player: string, jerseyNumber: number, active: boolean }>}
 */
function getChangedEntries(prevPlayers, nextPlayers) {
    const prevById = new Map((prevPlayers || []).map(normalizeEntry).map((p) => [p.player, p]));
    return (nextPlayers || []).map(normalizeEntry).filter((p) => {
        const prev = prevById.get(p.player);
        if (!prev) return true;
        if (prev.jerseyNumber !== p.jerseyNumber) return true;
        return !prev.active && p.active;
    });
}

/**
 * Duplicate active jersey numbers that THIS save would introduce.
 *
 * `players[]` is a full-replace array, so the whole roster is resent on every
 * add/remove/toggle. A duplicate that already existed before the save (e.g.
 * legacy data from before validation was added) must not block unrelated
 * edits — otherwise the whole team becomes uneditable. A duplicate only
 * blocks when at least one player in it is new, renumbered or reactivated.
 *
 * @returns {Array<{ jerseyNumber: number, playerIds: string[] }>}
 */
function findBlockingJerseyConflicts(prevPlayers, nextPlayers) {
    const changedIds = new Set(getChangedEntries(prevPlayers, nextPlayers).map((p) => p.player));
    return findDuplicateActiveJerseys(nextPlayers).filter((dup) => dup.playerIds.some((id) => changedIds.has(id)));
}

module.exports = {
    parseJerseyNumber,
    findDuplicateActiveJerseys,
    getChangedEntries,
    findBlockingJerseyConflicts,
};
