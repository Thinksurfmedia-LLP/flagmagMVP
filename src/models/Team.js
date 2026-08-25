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
        // Collected on the public team signup form — not shown on the
        // public team profile, kept for organizer contact use.
        address: {
            type: String,
            default: "",
        },
        // "How else did you hear about us?" from the same form. Free text
        // rather than an enum — the option list on the form itself is what
        // constrains it in practice, this just avoids a schema migration
        // every time that list changes.
        hearAboutUs: {
            type: String,
            default: "",
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        // Set when a team is created through public self-serve registration
        // (see lib/registration/team.js) — the user account that owns it.
        // Admin-created teams leave this null.
        manager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        // The league the manager asked to join at signup time. Intentionally
        // NOT added to `leagues[]` below — that array means "actually placed
        // in this league by an organizer." This field just records intent so
        // the organizer sees it without the team appearing in a live league
        // unvetted.
        requestedLeague: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "League",
            default: null,
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
        const hasManager = Boolean(existing.schema.path("manager"));
        const hasRequestedLeague = Boolean(existing.schema.path("requestedLeague"));
        const hasAddress = Boolean(existing.schema.path("address"));
        const hasHearAboutUs = Boolean(existing.schema.path("hearAboutUs"));
        if (!hasPlayers || !hasDescription || !hasJerseyNumber || !hasCoachName || !hasLeagues || !hasIsPlaceholder || !hasSeedNumber || !hasManager || !hasRequestedLeague || !hasAddress || !hasHearAboutUs) {
            delete mongoose.models.Team;
        }
    }

    return mongoose.models.Team || mongoose.model("Team", TeamSchema);
}

export default getTeamModel();
