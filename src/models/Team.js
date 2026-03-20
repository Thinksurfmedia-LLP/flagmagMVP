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
        division: {
            type: String,
            default: "",
        },
        location: {
            stateName: { type: String, default: "" },
            stateAbbr: { type: String, default: "" },
            countyName: { type: String, default: "" },
            cityName: { type: String, default: "" },
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        players: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Player",
            },
        ],
    },
    { timestamps: true }
);

TeamSchema.index({ organization: 1, name: 1 }, { unique: true });

function getTeamModel() {
    const existing = mongoose.models.Team;
    if (existing) {
        const hasPlayers = Boolean(existing.schema.path("players"));
        const hasDescription = Boolean(existing.schema.path("description"));
        if (!hasPlayers || !hasDescription) {
            delete mongoose.models.Team;
        }
    }

    return mongoose.models.Team || mongoose.model("Team", TeamSchema);
}

export default getTeamModel();
