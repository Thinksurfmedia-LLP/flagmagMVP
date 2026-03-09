import mongoose from "mongoose";

const StateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "State name is required"],
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        abbreviation: {
            type: String,
            uppercase: true,
            trim: true,
            default: "",
        },
    },
    { timestamps: true }
);

export default mongoose.models.State || mongoose.model("State", StateSchema);
