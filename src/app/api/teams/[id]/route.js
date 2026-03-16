import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Team from "@/models/Team";
import Player from "@/models/Player";
import User from "@/models/User";
import { requireAnyPermission } from "@/lib/apiAuth";

async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc = await User.findById(authUser.id).select("organization").lean()
        || await User.findOne({ email: authUser.email }).select("organization").lean();
    return userDoc?.organization ? String(userDoc.organization) : null;
}

function normalizeObjectId(value) {
    return value ? String(value) : "";
}

async function syncAssignedPlayers({ teamName, teamLogo, organizationId, nextPlayerIds = [], prevPlayerIds = [] }) {
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

async function getTeamForUser(id, user) {
    const team = await Team.findById(id);
    if (!team) return null;

    if (user.role === "organizer") {
        const organizerOrgId = await getOrgIdForOrganizer(user);
        if (!organizerOrgId || String(team.organization) !== organizerOrgId) {
            return "forbidden";
        }
    }

    return team;
}

export async function PUT(request, { params }) {
    const auth = await requireAnyPermission([
        "manage_teams",
        "team_update",
        "manage_players",
        "player_update",
        "manage_organizations",
        "organization_update",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const team = await getTeamForUser(id, auth.user);
        if (!team) {
            return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
        }
        if (team === "forbidden") {
            return NextResponse.json({ success: false, error: "You cannot manage teams outside your organization" }, { status: 403 });
        }

        const prevName = team.name;
        const prevPlayerIds = team.players || [];
        const nextPlayerIds = Array.isArray(body.players) ? body.players : prevPlayerIds;

        if (auth.user.role === "organizer" && nextPlayerIds.length > 0) {
            const organizerOrgId = await getOrgIdForOrganizer(auth.user);
            const disallowed = await Player.countDocuments({
                _id: { $in: nextPlayerIds },
                organization: { $nin: [null, organizerOrgId] },
            });

            if (disallowed > 0) {
                return NextResponse.json(
                    { success: false, error: "You can only assign players from your organization" },
                    { status: 403 }
                );
            }
        }

        team.name = body.name?.trim() || team.name;
        team.logo = body.logo ?? team.logo;
        team.players = nextPlayerIds;
        await team.save();

        if (prevName !== team.name) {
            await Player.updateMany(
                { _id: { $in: nextPlayerIds }, "presentTeam.name": prevName },
                {
                    $set: {
                        presentTeam: {
                            name: team.name,
                            logo: team.logo || "",
                        },
                    },
                }
            );
        }

        await syncAssignedPlayers({
            teamName: team.name,
            teamLogo: team.logo,
            organizationId: team.organization,
            nextPlayerIds,
            prevPlayerIds,
        });

        const updated = await Team.findById(team._id)
            .populate("organization", "name slug")
            .populate("players", "name photo presentTeam organization")
            .lean();

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const auth = await requireAnyPermission([
        "manage_teams",
        "team_delete",
        "manage_players",
        "player_delete",
        "manage_organizations",
        "organization_delete",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;

        const team = await getTeamForUser(id, auth.user);
        if (!team) {
            return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
        }
        if (team === "forbidden") {
            return NextResponse.json({ success: false, error: "You cannot manage teams outside your organization" }, { status: 403 });
        }

        await Player.updateMany(
            { _id: { $in: team.players }, "presentTeam.name": team.name },
            {
                $set: {
                    presentTeam: {
                        name: "",
                        logo: "",
                    },
                },
            }
        );

        await Team.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Team deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
