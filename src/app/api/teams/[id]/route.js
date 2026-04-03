import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Team from "@/models/Team";
import Player from "@/models/Player";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";

async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc = await User.findById(authUser.id).select("organization roleOrganizations").lean()
        || await User.findOne({ email: authUser.email }).select("organization roleOrganizations").lean();
        
    if (userDoc?.roleOrganizations?.organizer) {
        const orgs = userDoc.roleOrganizations.organizer;
        if (Array.isArray(orgs) && orgs.length > 0) return String(orgs[0]);
        if (typeof orgs === "string") return String(orgs);
    }
    
    return userDoc?.organization ? String(userDoc.organization) : null;
}

function normalizeObjectId(value) {
    return value ? String(value) : "";
}

async function syncUserRole(userId) {
    const playerDocs = await Player.find({ user: userId }).select("status").lean();
    const hasPlayer = playerDocs.some((p) => p.status === "player");
    const hasFreeAgent = playerDocs.some((p) => p.status === "free_agent");

    const user = await User.findById(userId).select("role roles").lean();
    if (!user || ["admin", "organizer"].includes(user.role)) return;

    const newRole = hasPlayer ? "player" : hasFreeAgent ? "free_agent" : "viewer";
    const newRoles = user.roles.filter((r) => !["player", "free_agent", "viewer"].includes(r));
    if (hasPlayer) newRoles.push("player");
    if (hasFreeAgent) newRoles.push("free_agent");
    if (newRoles.length === 0) newRoles.push("viewer");

    await User.updateOne({ _id: userId }, { $set: { role: newRole, roles: newRoles } });
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
                    status: "player",
                    organization: organizationId,
                    presentTeam: {
                        name: teamName,
                        logo: teamLogo || "",
                    },
                },
            }
        );

        const addedPlayers = await Player.find({ _id: { $in: toAdd }, user: { $ne: null } }).select("user").lean();
        for (const ap of addedPlayers) {
            await syncUserRole(ap.user);
        }
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

        // Demote players back to free_agent if no longer on any team
        const removedPlayers = await Player.find({ _id: { $in: toRemove }, user: { $ne: null } }).select("user").lean();
        for (const rp of removedPlayers) {
            const stillOnTeam = await Team.exists({ "players.player": rp._id });
            if (!stillOnTeam) {
                await Player.updateOne({ _id: rp._id }, { $set: { status: "free_agent" } });
            }
            await syncUserRole(rp.user);
        }
    }
}

async function getTeamForUser(id, user) {
    const team = await Team.findById(id);
    if (!team) return null;

    if (hasRole(user, "organizer")) {
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
        const prevPlayerIds = (team.players || []).map(p => String(p.player));

        // body.players is now an array of { player, jerseyNumber } objects
        const nextPlayersArray = Array.isArray(body.players) ? body.players : null;
        const nextPlayerIds = nextPlayersArray
            ? nextPlayersArray.map(p => typeof p === "object" ? String(p.player) : String(p))
            : prevPlayerIds;

        // Validate jersey numbers when players are provided
        if (nextPlayersArray) {
            for (const entry of nextPlayersArray) {
                if (typeof entry === "object" && (entry.jerseyNumber === undefined || entry.jerseyNumber === null || entry.jerseyNumber === "")) {
                    return NextResponse.json(
                        { success: false, error: "Jersey number is required for all players" },
                        { status: 400 }
                    );
                }
            }
            // Check for duplicate jersey numbers
            const jerseyNumbers = nextPlayersArray.map(p => typeof p === "object" ? Number(p.jerseyNumber) : null).filter(n => n !== null);
            const uniqueJerseys = new Set(jerseyNumbers);
            if (uniqueJerseys.size !== jerseyNumbers.length) {
                return NextResponse.json(
                    { success: false, error: "Duplicate jersey numbers are not allowed within the same team" },
                    { status: 400 }
                );
            }
        }

        if (hasRole(auth.user, "organizer") && nextPlayerIds.length > 0) {
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
        team.description = body.description !== undefined ? (body.description?.trim() || "") : team.description;
        team.division = body.division !== undefined ? (body.division?.trim() || "") : team.division;
        if (body.coachName !== undefined) team.coachName = body.coachName?.trim() || "";
        if (body.coachPhone !== undefined) team.coachPhone = body.coachPhone?.trim() || "";
        if (body.location) team.location = body.location;
        if (body.season !== undefined) team.season = body.season || null;
        if (body.league !== undefined) team.league = body.league || null;
        if (nextPlayersArray) {
            team.players = nextPlayersArray.map(p => ({
                player: typeof p === "object" ? p.player : p,
                jerseyNumber: typeof p === "object" ? Number(p.jerseyNumber) : 0,
            }));
        }
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
            .populate("season", "name")
            .populate("league", "name")
            .populate("players.player", "name photo presentTeam organization")
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

        const teamPlayerIds = (team.players || []).map(p => p.player);
        await Player.updateMany(
            { _id: { $in: teamPlayerIds }, "presentTeam.name": team.name },
            {
                $set: {
                    status: "free_agent",
                    presentTeam: {
                        name: "",
                        logo: "",
                    },
                },
            }
        );

        // Sync user roles for all players on the deleted team
        const teamPlayers = await Player.find({ _id: { $in: teamPlayerIds }, user: { $ne: null } }).select("user").lean();
        await Team.findByIdAndDelete(id);
        for (const tp of teamPlayers) {
            await syncUserRole(tp.user);
        }

        return NextResponse.json({ success: true, message: "Team deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
