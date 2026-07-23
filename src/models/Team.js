import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Team name is required"],
            trim: true,
        },
        logo: {
            type: String,
            default: "",
        },
        description: {
            type: String,
            default: "",
        },
        location: {
            stateName: { type: String, default: "" },
            stateAbbr: { type: String, default: "" },
            countyName: { type: String, default: "" },
            cityName: { type: String, default: "" },
        },
        coachName: {
            type: String,
            default: "",
            trim: true,
        },
        coachPhone: {
            type: String,
            default: "",
            trim: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        // A team keeps one identity across every league/season it ever played —
        // this array lets it belong to more than one league at once (e.g. a
        // regular league and a playoffs bracket running concurrently) and
        // preserves every past membership instead of overwriting it.
        leagues: [
            {
                league: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "League",
                    required: true,
                },
                division: {
                    type: String,
                    default: "",
                },
                // Playoff seed/bracket number for this specific league
                // membership only (playoffs leagues use this; regular
                // leagues leave it null). The same team can hold a
                // different, unrelated number in another playoffs league —
                // it lives on the membership entry, not on the team itself.
                seedNumber: {
                    type: Number,
                    default: null,
                },
                joinedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        players: [
            {
                player: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Player",
                },
                jerseyNumber: {
                    type: Number,
                    required: [true, "Jersey number is required"],
                },
            },
        ],
        isPlaceholder: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

TeamSchema.index({ organization: 1, name: 1 }, { unique: true });
TeamSchema.index({ organization: 1, "leagues.league": 1 });

function getTeamModel() {
    const existing = mongoose.models.Team;
    if (existing) {
        const hasPlayers = Boolean(existing.schema.path("players"));
        const hasDescription = Boolean(existing.schema.path("description"));
        const hasJerseyNumber = Boolean(existing.schema.path("players.jerseyNumber"));
        const hasCoachName = Boolean(existing.schema.path("coachName"));
        const hasLeagues = Boolean(existing.schema.path("leagues"));
        const hasIsPlaceholder = Boolean(existing.schema.path("isPlaceholder"));
        const hasSeedNumber = Boolean(existing.schema.path("leagues.seedNumber"));
        if (!hasPlayers || !hasDescription || !hasJerseyNumber || !hasCoachName || !hasLeagues || !hasIsPlaceholder || !hasSeedNumber) {
            delete mongoose.models.Team;
        }
    }

    return mongoose.models.Team || mongoose.model("Team", TeamSchema);
}

export default getTeamModel();
