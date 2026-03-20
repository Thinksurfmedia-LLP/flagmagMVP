import mongoose from "mongoose";

const LeagueSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        name: {
            type: String,
            required: [true, "League name is required"],
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["active", "past"],
            default: "active",
        },
        category: {
            type: String,
            default: "",
        },
        location: {
            type: String,
            default: "",
        },
        locations: {
            type: [String],
            default: [],
        },
        season: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Season",
        },
        seasonOverridden: {
            type: Boolean,
            default: false,
        },
        startDate: {
            type: Date,
        },
        time: {
            type: String,
            default: "",
        },
        divisions: [
            {
                name: { type: String },
                teams: [
                    {
                        name: { type: String },
                        logo: { type: String },
                        wins: { type: Number, default: 0 },
                        losses: { type: Number, default: 0 },
                        pct: { type: Number, default: 0 },
                        pf: { type: Number, default: 0 },
                        pa: { type: Number, default: 0 },
                        diff: { type: Number, default: 0 },
                    },
                ],
            },
        ],
        gameRecords: [
            {
                playerName: { type: String },
                playerImage: { type: String },
                seasonLabel: { type: String },
                statValue: { type: Number },
                statLabel: { type: String },
            },
        ],
    },
    {
        timestamps: true,
    }
);

LeagueSchema.index({ organization: 1, slug: 1 }, { unique: true });

function getLeagueModel() {
    if (mongoose.models.League) {
        const existing = mongoose.models.League;
        if (!existing.schema.paths.divisions || !existing.schema.paths.seasonOverridden) {
            delete mongoose.models.League;
            delete mongoose.connection.models?.League;
            return mongoose.model("League", LeagueSchema);
        }
        return existing;
    }
    return mongoose.model("League", LeagueSchema);
}

export default getLeagueModel();
