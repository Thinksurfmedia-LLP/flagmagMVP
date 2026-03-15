import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Team from "@/models/Team";
import Player from "@/models/Player";
import { requireAnyPermission } from "@/lib/apiAuth";

function normalizeObjectId(value) {
    return value ? String(value) : "";
}

async function syncAssignedPlayers({ teamId, teamName, teamLogo, organizationId, nextPlayerIds = [], prevPlayerIds = [] }) {
    const nextSet = new Set(nextPlayerIds.map(normalizeObjectId));
    const prevSet = new Set(prevPlayerIds.map(normalizeObjectId));

    const toAdd = [...nextSet].filter((id) => !prevSet.has(id));
    const toRemove = [...prevSet].filter((id) => !nextSet.has(id));

    if (toAdd.length > 0) {
        await Player.updateMany(
            { _id: { $in: toAdd } },
            {
                $set: {
                    organization: organizationId,
                    presentTeam: {
                        name: teamName,
                        logo: teamLogo || "",
                    },
                },
            }
        );
    }

    if (toRemove.length > 0) {
        await Player.updateMany(
            { _id: { $in: toRemove }, "presentTeam.name": teamName },
            {
                $set: {
                    presentTeam: {
                        name: "",
                        logo: "",
                    },
                },
            }
        );
    }
}

export async function GET(request) {
    const auth = await requireAnyPermission([
        "manage_teams",
        "team_view",
        "team_update",
        "manage_players",
        "player_view",
        "player_update",
        "manage_organizations",
        "organization_view",
        "organization_update",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const organization = searchParams.get("organization");
        const filter = {};

        if (auth.user.role === "organizer") {
            if (!auth.user.organization?.id) {
                return NextResponse.json({ success: false, error: "Organizer is not assigned to an organization" }, { status: 400 });
            }
            filter.organization = auth.user.organization.id;
        } else if (organization) {
            filter.organization = organization;
        }

        const teams = await Team.find(filter)
            .populate("organization", "name slug")
            .populate("players", "name photo presentTeam organization")
            .sort({ name: 1 })
            .lean();

        return NextResponse.json({ success: true, data: teams });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const auth = await requireAnyPermission([
        "manage_teams",
        "team_create",
        "team_update",
        "manage_players",
        "player_create",
        "player_update",
        "manage_organizations",
        "organization_update",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const body = await request.json();

        const playerIds = Array.isArray(body.players) ? body.players : [];
        const organizationId = auth.user.role === "organizer"
            ? auth.user.organization?.id
            : body.organization;

        if (!organizationId) {
            return NextResponse.json({ success: false, error: "Organization is required" }, { status: 400 });
        }

        if (!body.name?.trim()) {
            return NextResponse.json({ success: false, error: "Team name is required" }, { status: 400 });
        }

        if (auth.user.role === "organizer" && playerIds.length > 0) {
            const disallowed = await Player.countDocuments({
                _id: { $in: playerIds },
                organization: { $nin: [null, organizationId] },
            });

            if (disallowed > 0) {
                return NextResponse.json(
                    { success: false, error: "You can only assign players from your organization" },
                    { status: 403 }
                );
            }
        }

        const team = await Team.create({
            name: body.name.trim(),
            logo: body.logo || "",
            organization: organizationId,
            players: playerIds,
        });

        await syncAssignedPlayers({
            teamId: team._id,
            teamName: team.name,
            teamLogo: team.logo,
            organizationId,
            nextPlayerIds: playerIds,
            prevPlayerIds: [],
        });

        const created = await Team.findById(team._id)
            .populate("organization", "name slug")
            .populate("players", "name photo presentTeam organization")
            .lean();

        return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
