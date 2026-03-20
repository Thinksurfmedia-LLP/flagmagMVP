import mongoose from "mongoose";

const SeasonSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        name: {
            type: String,
            required: [true, "Season name is required"],
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
        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

SeasonSchema.index({ organization: 1, slug: 1 }, { unique: true });

function getSeasonModel() {
    if (mongoose.models.Season) {
        const existing = mongoose.models.Season;
        if (!existing.schema.paths.isDefault || existing.schema.paths.kind) {
            delete mongoose.models.Season;
            delete mongoose.connection.models?.Season;
            return mongoose.model("Season", SeasonSchema);
        }
        return existing;
    }
    return mongoose.model("Season", SeasonSchema);
}

export default getSeasonModel();
