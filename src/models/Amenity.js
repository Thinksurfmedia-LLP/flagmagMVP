import mongoose from "mongoose";

const AmenitySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Amenity name is required"],
            trim: true,
            unique: true,
        },
        icon: {
            type: String,
            default: "",
            trim: true,
        },
    },
    { timestamps: true }
);

export default mongoose.models.Amenity || mongoose.model("Amenity", AmenitySchema);
