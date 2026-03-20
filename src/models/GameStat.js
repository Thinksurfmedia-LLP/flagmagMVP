import mongoose from "mongoose";

const GameStatSchema = new mongoose.Schema(
    {
        game: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Game",
            required: true,
        },
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            required: true,
        },
        teamName: {
            type: String,
            required: true,
        },
        statType: {
            type: String,
            enum: ["passing", "rushing", "receiving"],
            required: true,
        },
        rate: { type: Number, default: 0 },
        atts: { type: Number, default: 0 },
        comp: { type: Number, default: 0 },
        tds: { type: Number, default: 0 },
        pct: { type: Number, default: 0 },
        xp2: { type: Number, default: 0 },
        yards: { type: Number, default: 0 },
        ten: { type: Number, default: 0 },
        twenty: { type: Number, default: 0 },
        forty: { type: Number, default: 0 },
        ints: { type: Number, default: 0 },
        intOpen: { type: Number, default: 0 },
        intXp: { type: Number, default: 0 },
    },
    { timestamps: true }
);

GameStatSchema.index({ game: 1, player: 1, statType: 1 }, { unique: true });
GameStatSchema.index({ game: 1, teamName: 1, statType: 1 });

export default mongoose.models.GameStat ||
    mongoose.model("GameStat", GameStatSchema);
