import mongoose from "mongoose";

const PlaySchema = new mongoose.Schema(
    {
        game: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Game",
            required: true,
        },
        type: {
            type: String,
            enum: ["completion", "incomplete", "interception", "fumble", "sack", "run", "timeout"],
            required: true,
        },
        activeTeam: {
            type: String,
            enum: ["A", "B"],
            required: true,
        },
        teamName: {
            type: String,
            required: true,
        },
        half: {
            type: String,
            default: "1st",
        },
        // Player jersey numbers as entered in mobile app
        passer: { type: String, default: "" },
        receiver: { type: String, default: "" },
        rusher: { type: String, default: "" },
        defender: { type: String, default: "" },
        flagPull: { type: String, default: "" },
        // Resolved player identity, frozen at the moment this play was
        // recorded (see resolvePlayPlayerIds in lib/statsAggregation.js) —
        // a team's roster/jersey assignments are mutable and get reused
        // season to season, so stats aggregation must key off THIS, not by
        // re-resolving the jersey number strings above against whatever the
        // team's roster happens to be at read time. null on a field means
        // that jersey number didn't resolve to anyone on the roster at
        // write time (or this play predates this field's existence).
        passerPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
        receiverPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
        rusherPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
        defenderPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
        flagPullPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
        // Play result data
        yards: { type: Number, default: 0 },
        points: { type: String, default: "" }, // "Touch Down", "1 Pt.", "2 Pt.", "None", or ""
        safety: { type: Boolean, default: false },
        // Scoring
        ptsAdded: { type: Number, default: 0 },
        targetTeam: { type: String, default: "" }, // "A" or "B" — which team got the points
        // Idempotency key to prevent duplicate plays from network retries
        idempotencyKey: { type: String, unique: true, sparse: true },
    },
    { timestamps: true }
);

PlaySchema.index({ game: 1 });
PlaySchema.index({ game: 1, type: 1 });
PlaySchema.index({ idempotencyKey: 1 }, { sparse: true, unique: true });

if (mongoose.models.Play) mongoose.deleteModel("Play");
export default mongoose.model("Play", PlaySchema);
