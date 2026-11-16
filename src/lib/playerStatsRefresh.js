import mongoose from "mongoose";
import ImportedStatLine from "@/models/ImportedStatLine";

/**
 * Leaderboards for imported (old-site) leagues are cached for up to a day and
 * only recomputed when their stat lines change (see statsAggregation.js), so
 * renaming a player or changing their photo would keep showing the old
 * name/photo there. Touching the player's stat lines marks those leagues as
 * changed; they refresh within a few minutes. Stat values are untouched.
 * @param {string} playerId
 */
export async function refreshPlayerStatsDisplay(playerId) {
    if (!mongoose.isValidObjectId(playerId)) return;
    await ImportedStatLine.updateMany(
        { player: new mongoose.Types.ObjectId(String(playerId)) },
        { $currentDate: { updatedAt: true } },
        { timestamps: false }
    );
}
