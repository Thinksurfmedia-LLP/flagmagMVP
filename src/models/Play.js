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
            enum: ["completion", "incomplete", "interception", "fumble", "sack", "run"],
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
        // Play result data
        yards: { type: Number, default: 0 },
        points: { type: String, default: "" }, // "Touch Down", "1 Pt.", "2 Pt.", "None", or ""
        safety: { type: Boolean, default: false },
        // Scoring
        ptsAdded: { type: Number, default: 0 },
        targetTeam: { type: String, default: "" }, // "A" or "B" — which team got the points
    },
    { timestamps: true }
);

PlaySchema.index({ game: 1 });
PlaySchema.index({ game: 1, type: 1 });

export default mongoose.models.Play || mongoose.model("Play", PlaySchema);
