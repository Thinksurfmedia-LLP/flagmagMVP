import mongoose from "mongoose";

// Audit log + undo record for "merge these player records into one player"
// (see lib/playerMerge.js). The merged-away Player documents are deleted from
// `players`, so the full original documents are kept here, together with the
// exact ids of every row that was re-pointed, so a merge can be reversed
// precisely — nothing is lost by merging.
const PlayerMergeSchema = new mongoose.Schema(
    {
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
        target: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
        targetName: { type: String, default: "" },
        mergedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        sources: [
            {
                _id: false,
                // Full original Player document, restored as-is on undo.
                player: { type: mongoose.Schema.Types.Mixed, required: true },
                statLines: [{ type: mongoose.Schema.Types.ObjectId }],
                // { passerPlayer: [playId, ...], receiverPlayer: [...], ... }
                plays: { type: mongoose.Schema.Types.Mixed, default: {} },
                gameStats: [{ type: mongoose.Schema.Types.ObjectId }],
                awards: [{ type: mongoose.Schema.Types.ObjectId }],
                // [{ team, jerseyNumbers }] — the exact retired entries moved.
                retired: [{ _id: false, team: mongoose.Schema.Types.ObjectId, jerseyNumbers: [Number] }],
                registryRows: [{ type: mongoose.Schema.Types.ObjectId }],
            },
        ],
        undone: { type: Boolean, default: false },
        undoneAt: { type: Date, default: null },
        undoneBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true, minimize: false }
);

PlayerMergeSchema.index({ target: 1, createdAt: -1 });
PlayerMergeSchema.index({ organization: 1, createdAt: -1 });

if (mongoose.models.PlayerMerge) mongoose.deleteModel("PlayerMerge");
export default mongoose.model("PlayerMerge", PlayerMergeSchema);
