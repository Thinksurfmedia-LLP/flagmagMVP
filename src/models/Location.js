import mongoose from "mongoose";

const VenueSchema = new mongoose.Schema(
    {
        county: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "County",
            required: true,
        },
        name: {
            type: String,
            required: [true, "Venue name is required"],
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        address: {
            type: String,
            default: "",
        },
        fieldCount: {
            type: Number,
            default: null,
            min: 0,
        },
        managerName: {
            type: String,
            default: "",
            trim: true,
        },
        managerPhone: {
            type: String,
            default: "",
            trim: true,
        },
        cityName: {
            type: String,
            default: "",
            trim: true,
        },
    },
    { timestamps: true }
);

VenueSchema.index({ county: 1, slug: 1 }, { unique: true });

function getVenueModel() {
    const existing = mongoose.models.Venue;
    if (existing) {
        const hasFieldCount = Boolean(existing.schema.path("fieldCount"));
        const hasCityName = Boolean(existing.schema.path("cityName"));

        // In dev, HMR can keep an outdated compiled model; rebuild it when schema changes.
        if (!hasFieldCount || !hasCityName) {
            delete mongoose.models.Venue;
        }
    }

    return mongoose.models.Venue || mongoose.model("Venue", VenueSchema);
}

export default getVenueModel();
