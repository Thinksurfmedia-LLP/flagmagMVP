import mongoose from "mongoose";

const DemoRequestSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true, trim: true },
        workEmail: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, required: true, trim: true },
        organizationName: { type: String, required: true, trim: true },
        preferredDateTime: { type: String, trim: true, default: "" },
        agreedToContact: { type: Boolean, required: true },
        status: {
            type: String,
            enum: ["new", "contacted", "scheduled", "closed"],
            default: "new",
        },
    },
    { timestamps: true }
);

export default mongoose.models.DemoRequest ||
    mongoose.model("DemoRequest", DemoRequestSchema);
