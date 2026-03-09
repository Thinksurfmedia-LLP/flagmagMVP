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
    },
    { timestamps: true }
);

VenueSchema.index({ county: 1, slug: 1 }, { unique: true });

export default mongoose.models.Venue || mongoose.model("Venue", VenueSchema);
