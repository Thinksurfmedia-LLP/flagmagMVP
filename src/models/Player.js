import mongoose from "mongoose";

const PlayerSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        status: {
            type: String,
            enum: ["free_agent", "player"],
            default: "free_agent",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            default: null,
        },
        // The division/league this free agent asked to be drafted into at
        // signup time — recorded intent only, same as Team.requestedLeague.
        // Doesn't place them on any roster by itself; an organizer/team
        // still has to actually pick them up.
        requestedLeague: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "League",
            default: null,
        },
        name: {
            type: String,
            required: [true, "Player name is required"],
            trim: true,
        },
        // Denormalized from the signup form so contact info survives even
        // when this player has no linked User (guest free-agent checkout —
        // see lib/registration/fromPayment.js). Kept in sync with `user`'s
        // own email/phone when a user IS linked, but never required.
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: "",
        },
        phone: {
            type: String,
            trim: true,
            default: "",
        },
        photo: {
            type: String,
            default: "",
        },
        bannerImage: {
            type: String,
            default: "",
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        memberCount: {
            type: Number,
            default: 0,
        },
        joinYear: {
            type: Number,
        },
        location: {
            type: String,
            default: "",
        },
        // Street address, collected on the public free-agent signup form.
        // Not shown on the public profile — kept for organizer contact use.
        address: {
            type: String,
            default: "",
        },
        about: {
            type: String,
            default: "",
        },
        locationsDescription: {
            type: String,
            default: "",
        },
        socialLinks: {
            facebook: { type: String, default: "" },
            instagram: { type: String, default: "" },
            youtube: { type: String, default: "" },
        },
        presentTeam: {
            name: { type: String, default: "" },
            logo: { type: String, default: "" },
        },
        overallRating: {
            type: Number,
            default: 0,
        },
        defenseRating: {
            type: Number,
            default: 0,
        },
        quarterbackRating: {
            type: Number,
            default: 0,
        },
        wideReceiverRating: {
            type: Number,
            default: 0,
        },
        stats: {
            totalKills: { type: Number, default: 0 },
            totalDeaths: { type: Number, default: 0 },
            totalAssists: { type: Number, default: 0 },
            totalWins: { type: Number, default: 0 },
        },
        seasonProgress: {
            current: { type: Number, default: 0 },
            max: { type: Number, default: 100 },
        },
        offenseStats: [
            {
                label: { type: String },
                value: { type: String },
            },
        ],
        defenseStats: [
            {
                label: { type: String },
                value: { type: String },
            },
        ],
        specialStats: [
            {
                label: { type: String },
                value: { type: String },
            },
        ],
        teams: [
            {
                name: { type: String },
                logo: { type: String },
                record: { type: String },
                pf: { type: Number, default: 0 },
                pa: { type: Number, default: 0 },
                diff: { type: Number, default: 0 },
                season: { type: String },
            },
        ],
    },
    {
        timestamps: true,
    }
);

PlayerSchema.index({ user: 1, organization: 1 }, { unique: true, sparse: true });

function getPlayerModel() {
    const existing = mongoose.models.Player;
    // Dev HMR can keep a stale compiled model around after a field is added
    // here — same failure mode Team.js guards against. Rebuild rather than
    // silently dropping writes to a field the cached model doesn't know about.
    if (existing && (!existing.schema.path("address") || !existing.schema.path("requestedLeague") || !existing.schema.path("email"))) {
        delete mongoose.models.Player;
    }
    return mongoose.models.Player || mongoose.model("Player", PlayerSchema);
}

export default getPlayerModel();
