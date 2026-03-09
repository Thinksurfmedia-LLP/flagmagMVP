import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Role name is required"],
            unique: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
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
        isSystem: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export const DEFAULT_ROLES = [
    {
        name: "Admin",
        slug: "admin",
        permissions: [
            "manage_organizations",
            "manage_seasons",
            "manage_games",
            "manage_players",
            "manage_users",
            "view_dashboard",
        ],
        isSystem: true,
    },
    {
        name: "Organizer",
        slug: "organizer",
        permissions: [
            "manage_organizations",
            "manage_seasons",
            "manage_games",
            "view_dashboard",
        ],
        isSystem: true,
    },
    {
        name: "Player",
        slug: "player",
        permissions: [],
        isSystem: true,
    },
];

export async function seedDefaultRoles() {
    const Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);
    for (const role of DEFAULT_ROLES) {
        await Role.findOneAndUpdate(
            { slug: role.slug },
            { $setOnInsert: role },
            { upsert: true }
        );
    }
}

export default mongoose.models.Role || mongoose.model("Role", RoleSchema);
