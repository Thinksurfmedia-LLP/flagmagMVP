import mongoose from "mongoose";

const SiteSettingsSchema = new mongoose.Schema(
    {
        phone: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, default: "" },
        address: { type: String, trim: true, default: "" },
        facebook: { type: String, trim: true, default: "" },
        twitter: { type: String, trim: true, default: "" },
        instagram: { type: String, trim: true, default: "" },
        youtube: { type: String, trim: true, default: "" },
    },
    { timestamps: true }
);

export default mongoose.models.SiteSettings ||
    mongoose.model("SiteSettings", SiteSettingsSchema);
