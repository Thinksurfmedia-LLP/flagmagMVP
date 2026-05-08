import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        role: {
            type: String,
            required: true,
        },
        action: {
            type: String,
            required: true,
            trim: true,
        },
        details: {
            type: String,
            required: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

delete mongoose.models.Activity;
export default mongoose.model("Activity", ActivitySchema);
