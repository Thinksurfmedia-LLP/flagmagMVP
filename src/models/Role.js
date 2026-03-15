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
                "organization_view",
                "organization_create",
                "organization_update",
                "organization_delete",
                "manage_seasons",
                "season_view",
                "season_create",
                "season_update",
                "season_delete",
                "manage_games",
                "game_view",
                "game_create",
                "game_update",
                "game_delete",
                "manage_players",
                "player_view",
                "player_create",
                "player_update",
                "player_delete",
                "manage_users",
                "user_view",
                "user_create",
                "user_update",
                "user_delete",
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
            "organization_view",
            "organization_create",
            "organization_update",
            "organization_delete",
            "manage_seasons",
            "season_view",
            "season_create",
            "season_update",
            "season_delete",
            "manage_games",
            "game_view",
            "game_create",
            "game_update",
            "game_delete",
            "manage_players",
            "player_view",
            "player_create",
            "player_update",
            "player_delete",
            "manage_users",
            "user_view",
            "user_create",
            "user_update",
            "user_delete",
            "view_dashboard",
        ],
        isSystem: true,
    },
    {
        name: "Organizer",
        slug: "organizer",
        permissions: [
            "manage_organizations",
            "organization_view",
            "organization_create",
            "organization_update",
            "organization_delete",
            "manage_seasons",
            "season_view",
            "season_create",
            "season_update",
            "season_delete",
            "manage_games",
            "game_view",
            "game_create",
            "game_update",
            "game_delete",
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
    {
        name: "Viewer",
        slug: "viewer",
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
