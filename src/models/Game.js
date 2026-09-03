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
        // Snapshot of the placeholder team (e.g. "TBD", "Winner of D1 Semi") that
        // teamA/teamB held before a real team was assigned. Set once, at the moment
        // of resolution, so the fixture can be reverted later without losing which
        // placeholder it originally was. Cleared once reverted.
        originalTeamA: {
            teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
            name: { type: String, default: "" },
            logo: { type: String, default: "" },
        },
        originalTeamB: {
            teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
            name: { type: String, default: "" },
            logo: { type: String, default: "" },
        },
        // Set when a team forfeits and the organizer schedules a live "No
        // Stats Game" against a stand-in opponent so the real team's players
        // still get game reps/stats. `noStatsSide` marks which side (A or B)
        // is occupied by the stand-in — permanent once set, so stats and
        // standings can keep excluding that side's plays even long after the
        // game is completed and the fixture reverted. `noStatsOriginalTeam`
        // snapshots the real (forfeiting) team that side belongs to, so it
        // can be restored — with its score forced back to 0 — when the game
        // is completed. This is separate from originalTeamA/B above, which
        // serves the unrelated placeholder-team (TBD/Winner) resolution flow.
        noStatsSide: {
            type: String,
            enum: ["A", "B", null],
            default: null,
        },
        noStatsOriginalTeam: {
            teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
            name: { type: String, default: "" },
            logo: { type: String, default: "" },
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
        sectionName: {
            type: String,
            default: "",
        },
        currentHalf: { type: String, enum: ["1st", "2nd"], default: "1st" },
        firstHalfCompleted: { type: Boolean, default: false },
        halfOneScoreA: { type: Number, default: 0 },
        halfOneScoreB: { type: Number, default: 0 },
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

function getGameModel() {
    if (mongoose.models.Game) {
        const existing = mongoose.models.Game;
        if (!existing.schema.path("originalTeamA.name") || !existing.schema.path("originalTeamB.name") || !existing.schema.path("noStatsSide")) {
            delete mongoose.models.Game;
            return mongoose.model("Game", GameSchema);
        }
        return existing;
    }
    return mongoose.model("Game", GameSchema);
}

export default getGameModel();
