import mongoose from "mongoose";

const AwardSchema = new mongoose.Schema(
    {
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            required: true,
        },
        name: {
            type: String,
            required: [true, "Award name is required"],
            trim: true,
        },
        image: {
            type: String,
            default: "",
        },
        season: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.models.Award || mongoose.model("Award", AwardSchema);
