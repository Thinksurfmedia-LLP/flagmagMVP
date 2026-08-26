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
        leagueType: {
            type: String,
            enum: ["league", "playoffs"],
            default: "league",
        },
        // Whether placeholder teams (TBD, Winner, Losers, etc.) show up in
        // this league's team dropdown — opt-in per league instead of every
        // league showing them, since most regular-season leagues never need
        // a bracket placeholder.
        allowPlaceholderTeams: {
            type: Boolean,
            default: false,
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
        endDate: {
            type: Date,
        },
        time: {
            type: String,
            default: "",
        },
        image: {
            type: String,
            default: "",
        },
        // Whether this league is shown as a selectable option on the public
        // sign-up page — organizers opt in per league.
        showOnSignup: {
            type: Boolean,
            default: false,
        },
        // Player/free-agent fee the organizer must set for this league.
        playerFee: {
            type: Number,
            default: 0,
            min: 0,
        },
        // Team deposit. Defaults to playerFee x 4 whenever the organizer
        // hasn't explicitly set their own value (see teamDepositOverridden).
        teamDeposit: {
            type: Number,
            default: 0,
            min: 0,
        },
        // True once the organizer has typed a custom team deposit — keeps
        // the auto (playerFee x 4) calculation from clobbering it later.
        teamDepositOverridden: {
            type: Boolean,
            default: false,
        },
        // Flat team registration fee.
        teamFee: {
            type: Number,
            default: 0,
            min: 0,
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
        if (!existing.schema.paths.divisions || !existing.schema.paths.seasonOverridden || !existing.schema.paths.image || !existing.schema.paths.endDate || !existing.schema.paths.allowPlaceholderTeams || !existing.schema.paths.playerFee) {
            delete mongoose.models.League;
            delete mongoose.connection.models?.League;
            return mongoose.model("League", LeagueSchema);
        }
        return existing;
    }
    return mongoose.model("League", LeagueSchema);
}

export default getLeagueModel();
