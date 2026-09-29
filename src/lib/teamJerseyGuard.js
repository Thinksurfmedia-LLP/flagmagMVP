import mongoose from "mongoose";
import { parseJerseyNumber } from "@/lib/rosterJersey";

// ── Atomic roster writes ───────────────────────────────────────────
//
// validateTeamJerseyRequests below reads the team, checks, and only THEN
// does the caller write — two requests racing on the same team could both
// pass the read and both write, creating a duplicate. The helpers here make
// the check part of the write itself: the filter only matches if the number
// is still free at the moment MongoDB applies the update, so at most one of
// two racing requests can succeed. Every one also bumps the team's version
// key (__v), which PUT /api/teams/[id] checks on save (team.increment()) —
// so a full-roster save from a stale modal is rejected instead of silently
// overwriting a change made here in the meantime.

export class RosterConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "RosterConflictError";
        this.status = 409;
    }
}

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Someone OTHER than `pid` is actively wearing `num` on this team.
const worn = (num, pid) => ({ $elemMatch: { jerseyNumber: num, active: { $ne: false }, player: { $ne: pid } } });
// `num` is retired on this team and not reserved for `pid`.
const retired = (num, pid) => ({ $elemMatch: { jerseyNumber: num, player: { $ne: pid } } });

const conflictMessage = (num, teamName) =>
    `Couldn't save #${num} on "${teamName}" — that roster was just changed by someone else and the number is no longer free. Reload and try again.`;

/** Add a player who is NOT yet on the team, only if `num` is still free. */
export async function pushPlayerAtomic(TeamModel, { teamId, teamName, playerId, jerseyNumber, session }) {
    const pid = toObjectId(playerId);
    const res = await TeamModel.updateOne(
        {
            _id: teamId,
            "players.player": { $ne: pid },
            players: { $not: worn(jerseyNumber, pid) },
            retiredNumbers: { $not: retired(jerseyNumber, pid) },
        },
        { $push: { players: { player: pid, jerseyNumber } }, $inc: { __v: 1 } },
        { session }
    );
    if (res.matchedCount === 0) throw new RosterConflictError(conflictMessage(jerseyNumber, teamName));
}

/** Change the number of a player already on the team, only if `num` is still free. */
export async function renumberPlayerAtomic(TeamModel, { teamId, teamName, playerId, jerseyNumber, session }) {
    const pid = toObjectId(playerId);
    const res = await TeamModel.updateOne(
        {
            _id: teamId,
            "players.player": pid,
            players: { $not: worn(jerseyNumber, pid) },
            retiredNumbers: { $not: retired(jerseyNumber, pid) },
        },
        { $set: { "players.$[me].jerseyNumber": jerseyNumber }, $inc: { __v: 1 } },
        { arrayFilters: [{ "me.player": pid }], session }
    );
    if (res.matchedCount === 0) throw new RosterConflictError(conflictMessage(jerseyNumber, teamName));
}

/**
 * Reactivate a player on one team, only if nobody else actively wears their
 * number there. Returns false (instead of throwing) on conflict — callers
 * report those teams back to the organizer rather than failing outright.
 */
export async function reactivatePlayerAtomic(TeamModel, { teamId, playerId, jerseyNumber, session }) {
    const pid = toObjectId(playerId);
    const res = await TeamModel.updateOne(
        { _id: teamId, "players.player": pid, players: { $not: worn(jerseyNumber, pid) } },
        { $set: { "players.$[me].active": true }, $inc: { __v: 1 } },
        { arrayFilters: [{ "me.player": pid }], session }
    );
    return res.matchedCount > 0;
}

/**
 * Run `fn(session)` in a MongoDB transaction, so a multi-team assignment
 * either fully applies or not at all (a conflict on the 2nd team no longer
 * leaves the 1st already written). Transient write conflicts between racing
 * transactions are retried by withTransaction, which re-runs the filters
 * above against the winner's committed state.
 */
export async function inTransaction(fn) {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => { result = await fn(session); });
        return result;
    } finally {
        await session.endSession();
    }
}

/**
 * Validate a player's requested team assignments ([{ teamId, jerseyNumber }])
 * BEFORE any roster write, for the player-side routes that $push straight
 * into Team.players (POST /api/organizations/[slug]/players and
 * PUT /api/players/[id]). Mirrors the rules PUT /api/teams/[id] enforces:
 *   - jersey number required (blank no longer silently becomes 0)
 *   - unique among the team's ACTIVE players
 *   - not a retired number, unless reserved for this same player
 * An assignment that keeps this player's existing number on a team is left
 * alone, so a legacy duplicate doesn't block unrelated profile edits.
 *
 * @param {import("mongoose").Model} TeamModel
 * @param {Array<{ teamId: string, jerseyNumber: unknown }>} requests
 * @param {string|null} playerId - null when the player is being created
 * @returns {Promise<{ ok: true, numbers: Map<string, number> } | { ok: false, status: number, error: string }>}
 */
export async function validateTeamJerseyRequests(TeamModel, requests, playerId) {
    const numbers = new Map();
    for (const tReq of requests || []) {
        const team = await TeamModel.findById(tReq.teamId).select("name players retiredNumbers").lean();
        if (!team) continue;

        const parsed = parseJerseyNumber(tReq.jerseyNumber);
        if (!parsed.ok) {
            return { ok: false, status: 400, error: `${parsed.error} for team "${team.name}"` };
        }
        const num = parsed.value;
        numbers.set(String(tReq.teamId), num);

        const self = playerId
            ? (team.players || []).find((p) => String(p.player) === String(playerId))
            : null;
        if (self && self.jerseyNumber === num) continue;

        const duplicate = (team.players || []).find(
            (p) => p.jerseyNumber === num && String(p.player) !== String(playerId) && p.active !== false
        );
        if (duplicate) {
            return { ok: false, status: 409, error: `Jersey number ${num} is already taken on team "${team.name}"` };
        }

        const retired = (team.retiredNumbers || []).find((r) => r.jerseyNumber === num);
        const reservedForThisPlayer = retired?.player && playerId && String(retired.player) === String(playerId);
        if (retired && !reservedForThisPlayer) {
            return {
                ok: false,
                status: 409,
                error: `Jersey #${num} is retired for team "${team.name}"${retired.reason ? ` (${retired.reason})` : ""}`,
            };
        }
    }
    return { ok: true, numbers };
}
