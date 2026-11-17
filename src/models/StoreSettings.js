import mongoose from "mongoose";

// Singleton document (key: "store"). Phase 2 adds shipping and tax fields here.
const StoreSettingsSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, default: "store" },
        refundPolicy: { type: String, default: "", maxlength: 5000 },
        sizeGuideText: { type: String, default: "", maxlength: 5000 },
        sizeGuideImage: { type: String, default: "", trim: true },
    },
    { timestamps: true }
);

export default mongoose.models.StoreSettings || mongoose.model("StoreSettings", StoreSettingsSchema);
