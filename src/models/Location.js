import mongoose from "mongoose";

const FieldSubSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        mapEmbed: { type: String, default: "" },
        amenities: { type: [String], default: [] },
        images: { type: [String], default: [] },
    },
    { _id: true }
);

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
        fields: {
            type: [FieldSubSchema],
            default: [],
        },
    },
    { timestamps: true }
);

VenueSchema.index({ county: 1, slug: 1 }, { unique: true });

function getVenueModel() {
    const existing = mongoose.models.Venue;
    if (existing) {
        const hasCityName = Boolean(existing.schema.path("cityName"));
        const hasFields = Boolean(existing.schema.path("fields"));

        if (!hasCityName || !hasFields) {
            delete mongoose.models.Venue;
        }
    }

    return mongoose.models.Venue || mongoose.model("Venue", VenueSchema);
}

export default getVenueModel();
