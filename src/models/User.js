import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please provide your full name"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Please provide an email"],
            unique: true,
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        password: {
            type: String,
            required: [true, "Please provide a password"],
            minlength: 6,
        },
        role: {
            type: String,
            enum: ["player", "organizer", "admin"],
            default: "player",
        },
        permissions: {
            type: [String],
            enum: [
                "manage_organizations",
                "manage_seasons",
                "manage_games",
                "manage_players",
                "manage_users",
                "view_dashboard",
            ],
            default: [],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
