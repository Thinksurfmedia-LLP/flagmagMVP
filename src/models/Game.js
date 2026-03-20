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
            enum: ["upcoming", "in_progress", "completed"],
            default: "upcoming",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.models.Game || mongoose.model("Game", GameSchema);
