import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema(
    {
        county: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "County",
            required: true,
        },
        name: {
            type: String,
            required: [true, "Location name is required"],
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
    },
    { timestamps: true }
);

LocationSchema.index({ county: 1, slug: 1 }, { unique: true });

export default mongoose.models.Location || mongoose.model("Location", LocationSchema);
