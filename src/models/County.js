import mongoose from "mongoose";

const CountySchema = new mongoose.Schema(
    {
        state: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "State",
            required: true,
        },
        name: {
            type: String,
            required: [true, "County name is required"],
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
    },
    { timestamps: true }
);

CountySchema.index({ state: 1, slug: 1 }, { unique: true });

export default mongoose.models.County || mongoose.model("County", CountySchema);
