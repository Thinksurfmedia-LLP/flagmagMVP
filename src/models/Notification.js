import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
        },
        triggeredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export default mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
