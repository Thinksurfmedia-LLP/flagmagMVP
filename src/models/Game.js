import mongoose from "mongoose";

const GameSchema = new mongoose.Schema(
    {
        league: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "League",
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        time: {
            type: String,
            default: "",
        },
        teamA: {
            name: { type: String, required: true },
            logo: { type: String, default: "" },
            score: { type: Number, default: null },
        },
        teamB: {
            name: { type: String, required: true },
            logo: { type: String, default: "" },
            score: { type: Number, default: null },
        },
        location: {
            type: String,
            default: "",
        },
        status: {
            type: String,
            enum: ["upcoming", "in_progress", "completed", "cancelled"],
            default: "upcoming",
        },
        gameType: {
            type: String,
            enum: ["main", "practice"],
            default: "main",
        },
    },
    {
        timestamps: true,
    }
);

GameSchema.index({ league: 1, date: 1 });

/**
 * Safety guard: prevent any code path from accidentally wiping game scores to null.
 *
 * Root cause history: the schedule PUT handler previously replaced the entire
 * teamA/teamB subdocument (including score: null) on every save — meaning any
 * admin action like renaming a week would silently zero-out all game scores.
 * The route has been fixed, but this middleware is a belt-and-suspenders defence
 * that makes score-wipes impossible at the database driver level.
 *
 * Legitimate score resets MUST use the dedicated score endpoint or the mobile app.
 */
function stripNullScores(update) {
    if (!update) return;
    // Direct dot-notation:  { "teamA.score": null }
    if (update["teamA.score"] === null) delete update["teamA.score"];
    if (update["teamB.score"] === null) delete update["teamB.score"];
    // Nested object replacement:  { teamA: { score: null } }  ← the original bug
    if (update.teamA?.score === null) delete update.teamA.score;
    if (update.teamB?.score === null) delete update.teamB.score;
    // Via $set operator:  { $set: { "teamA.score": null } }
    if (update.$set) {
        if (update.$set["teamA.score"] === null) delete update.$set["teamA.score"];
        if (update.$set["teamB.score"] === null) delete update.$set["teamB.score"];
        if (update.$set.teamA?.score === null) delete update.$set.teamA.score;
        if (update.$set.teamB?.score === null) delete update.$set.teamB.score;
    }
}

GameSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function () {
    stripNullScores(this.getUpdate());
});

export default mongoose.models.Game || mongoose.model("Game", GameSchema);
