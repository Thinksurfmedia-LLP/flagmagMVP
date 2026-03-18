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
                "manage_leagues",
                "league_view",
                "league_create",
                "league_update",
                "league_delete",
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
                "manage_teams",
                "team_view",
                "team_create",
                "team_update",
                "team_delete",
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

const REQUIRED_PERMISSION_KEYS = [
    "organization_view",
    "league_view",
    "season_view",
    "game_view",
    "player_view",
    "team_view",
    "user_view",
];

function getRoleModel() {
    const existing = mongoose.models.Role;
    if (existing) {
        const enumValues = existing.schema.path("permissions")?.caster?.enumValues || [];
        const hasLatestSchema = REQUIRED_PERMISSION_KEYS.every((perm) => enumValues.includes(perm));

        // In dev, HMR can keep an outdated compiled model; rebuild it when enum keys changed.
        if (!hasLatestSchema) {
            delete mongoose.models.Role;
        }
    }

    return mongoose.models.Role || mongoose.model("Role", RoleSchema);
}

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
            "manage_leagues",
            "league_view",
            "league_create",
            "league_update",
            "league_delete",
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
            "manage_teams",
            "team_view",
            "team_create",
            "team_update",
            "team_delete",
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
            "manage_leagues",
            "league_view",
            "league_create",
            "league_update",
            "league_delete",
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
            "manage_teams",
            "team_view",
            "team_create",
            "team_update",
            "team_delete",
            "view_dashboard",
        ],
        isSystem: true,
    },
    {
        name: "Free Agent",
        slug: "free_agent",
        permissions: [],
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
    const Role = getRoleModel();
    for (const role of DEFAULT_ROLES) {
        await Role.findOneAndUpdate(
            { slug: role.slug },
            { $set: { permissions: role.permissions, isSystem: role.isSystem } },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }
}

export default getRoleModel();
