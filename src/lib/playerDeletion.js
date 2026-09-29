import mongoose from "mongoose";
import Player from "@/models/Player";
import Team from "@/models/Team";
import Play from "@/models/Play";
import Award from "@/models/Award";
import { inTransaction } from "@/lib/teamJerseyGuard";
import { syncUserRole } from "@/lib/userRoleSync";

const FROZEN_PLAYER_FIELDS = ["passerPlayer", "receiverPlayer", "rusherPlayer", "defenderPlayer", "flagPullPlayer"];

/**
 * Delete a player profile without leaving anything dangling.
 *
 * The old delete only removed the Player doc: the player stayed in every
 * Team.players[] as "(unknown player)" still holding their jersey number,
 * and plays linked to them fell back to a jersey-number lookup — crediting
 * their history to whoever wears that number now.
 *
 * Refuses (409) when the player has recorded plays or awards: that history
 * would be orphaned. Organizers should remove them from teams instead
 * (they then show up as a free agent with their history intact).
 *
 * @returns {Promise<{ ok: true, player: object } | { ok: false, status: number, error: string }>}
 */
export async function deletePlayer(playerId) {
    const player = await Player.findById(playerId).lean();
    if (!player) return { ok: false, status: 404, error: "Player not found" };

    const pid = new mongoose.Types.ObjectId(String(playerId));
    const [plays, awards] = await Promise.all([
        Play.countDocuments({ $or: FROZEN_PLAYER_FIELDS.map((f) => ({ [f]: pid })) }),
        Award.countDocuments({ player: pid }),
    ]);
    if (plays > 0 || awards > 0) {
        const what = [plays && `${plays} recorded play${plays === 1 ? "" : "s"}`, awards && `${awards} award${awards === 1 ? "" : "s"}`]
            .filter(Boolean).join(" and ");
        return {
            ok: false,
            status: 409,
            error: `${player.name} has ${what}, so deleting would erase that history. Remove them from their teams instead — they'll stay available as a free agent.`,
        };
    }

    await inTransaction(async (session) => {
        await Team.updateMany(
            { "players.player": pid },
            { $pull: { players: { player: pid } }, $inc: { __v: 1 } },
            { session }
        );
        // A number retired in their honor stays retired, just no longer
        // reserved for a profile that doesn't exist.
        await Team.updateMany(
            { "retiredNumbers.player": pid },
            { $set: { "retiredNumbers.$[r].player": null }, $inc: { __v: 1 } },
            { arrayFilters: [{ "r.player": pid }], session }
        );
        await Player.deleteOne({ _id: pid }, { session });
    });

    if (player.user) await syncUserRole(player.user);
    return { ok: true, player };
}
