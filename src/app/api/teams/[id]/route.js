import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Team from "@/models/Team";
import Player from "@/models/Player";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { reconcilePlayerStatuses } from "@/lib/playerRosterSync";
import { parseJerseyNumber, findBlockingJerseyConflicts, getChangedEntries } from "@/lib/rosterJersey";

function populateTeam(query) {
    return query
        .populate("organization", "name slug")
        // Same league shape as GET /api/teams, so pickers that swap in this
        // response keep their "Trojans — SD Thu (Fall 2026)" label (teamLabel.js).
        .populate({ path: "leagues.league", select: "name season type", populate: { path: "season", select: "name" } })
        .populate("players.player", "name photo presentTeam organization")
        .populate("retiredNumbers.player", "name")
        .lean();
}

// 409 carrying the team as it is NOW, so the client can show the current
// roster instead of letting the organizer keep editing a stale copy.
async function rosterConflictResponse(teamId) {
    return NextResponse.json(
        {
            success: false,
            code: "ROSTER_CONFLICT",
            error: "Someone else changed this team's roster while you were editing. The latest roster has been loaded — please check it and try again.",
            data: await populateTeam(Team.findById(teamId)),
        },
        { status: 409 }
    );
}

// "Jersey #7 is already worn by Troy Cordova and Mikey Birk" — names the
// actual clash instead of a generic message the organizer can't act on.
async function describeJerseyConflicts(conflicts) {
    const ids = [...new Set(conflicts.flatMap((c) => c.playerIds))];
    const docs = await Player.find({ _id: { $in: ids } }).select("name").lean();
    const nameById = new Map(docs.map((p) => [String(p._id), p.name]));
    const parts = conflicts.map((c) => {
        const names = c.playerIds.map((id) => nameById.get(id) || "another player");
        return `#${c.jerseyNumber} (${names.join(", ")})`;
    });
    return `Duplicate jersey number among active players on this team: ${parts.join("; ")}`;
}

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
        if (team.isPlaceholder) {
            return NextResponse.json({ success: false, error: "Placeholder teams cannot be edited" }, { status: 403 });
        }

        // Stale-editor check: the Manage Players modal / retired-numbers page
        // send the __v of the team they're showing. If the team has changed
        // since (another admin, a player-page assignment), their full-replace
        // arrays are based on old data — reject instead of overwriting.
        if (body.expectedVersion !== undefined && body.expectedVersion !== null
            && Number(body.expectedVersion) !== (team.__v ?? 0)) {
            return rosterConflictResponse(team._id);
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
                if (typeof entry !== "object") continue;
                const parsed = parseJerseyNumber(entry.jerseyNumber);
                if (!parsed.ok) {
                    return NextResponse.json(
                        { success: false, error: `${parsed.error} for all players` },
                        { status: 400 }
                    );
                }
            }
            // Validate exactly what gets saved below — legacy plain-ID entries
            // are stored as #0/active, so they must be checked as such too.
            const objectEntries = nextPlayersArray.map(p =>
                typeof p === "object" ? p : { player: p, jerseyNumber: 0, active: true }
            );

            // Duplicate jersey numbers — only among ACTIVE players (a
            // deactivated player's number is free for someone else while
            // they're inactive; GET .../roster and POST/PUT .../plays gate on
            // `active`). And only duplicates THIS save introduces: players[]
            // is a full replace resent on every add/remove/toggle, so a
            // pre-existing duplicate from legacy data must not lock the whole
            // team — see findBlockingJerseyConflicts.
            const conflicts = findBlockingJerseyConflicts(team.players || [], objectEntries);
            if (conflicts.length > 0) {
                return NextResponse.json(
                    { success: false, error: await describeJerseyConflicts(conflicts) },
                    { status: 400 }
                );
            }

            // A retired number stays off-limits for anyone except the player
            // it's reserved for (re-joining the team) — unless the caller
            // explicitly overrides it. Like the duplicate check, only entries
            // this save adds/renumbers/reactivates are checked, so a legacy
            // holder of a since-retired number doesn't block unrelated edits.
            if (!body.allowRetiredNumbers) {
                for (const entry of getChangedEntries(team.players || [], objectEntries)) {
                    const num = entry.jerseyNumber;
                    const retired = (team.retiredNumbers || []).find((r) => r.jerseyNumber === num);
                    if (!retired) continue;
                    const reservedForThisPlayer = retired.player && String(retired.player) === String(entry.player);
                    if (!reservedForThisPlayer) {
                        return NextResponse.json(
                            {
                                success: false,
                                error: `Jersey #${num} is retired for this team${retired.reason ? ` (${retired.reason})` : ""} — pass allowRetiredNumbers to reassign it anyway`,
                            },
                            { status: 409 }
                        );
                    }
                }
            }
        }

        // Full replace, same pattern as `players[]` above — the organizer's
        // retire/un-retire UI always sends the complete current list.
        if (Array.isArray(body.retiredNumbers)) {
            for (const entry of body.retiredNumbers) {
                if (entry.jerseyNumber === undefined || entry.jerseyNumber === null || entry.jerseyNumber === "") {
                    return NextResponse.json(
                        { success: false, error: "Jersey number is required for a retired-number entry" },
                        { status: 400 }
                    );
                }
            }
            team.retiredNumbers = body.retiredNumbers.map((r) => ({
                jerseyNumber: Number(r.jerseyNumber),
                player: r.player || null,
                reason: (r.reason || "").trim(),
                retiredAt: r.retiredAt || new Date(),
            }));
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
        if (body.coachName !== undefined) team.coachName = body.coachName?.trim() || "";
        if (body.coachPhone !== undefined) team.coachPhone = body.coachPhone?.trim() || "";
        if (body.location) team.location = body.location;
        // League membership is managed from the Leagues admin page
        // (/api/leagues/[id]/teams), not here — a team can belong to several
        // leagues at once, so there's no single "the league" to overwrite.
        if (nextPlayersArray) {
            team.players = nextPlayersArray.map(p => ({
                player: typeof p === "object" ? p.player : p,
                jerseyNumber: typeof p === "object" ? Number(p.jerseyNumber) : 0,
                // Defaults true (on the field's own schema default) for any
                // caller that still sends the old {player, jerseyNumber}
                // shape without `active` at all.
                active: typeof p === "object" && p.active === false ? false : true,
            }));
        }

        // Optimistic concurrency: players[]/retiredNumbers[] are full
        // replacements computed from what THIS request loaded. increment()
        // makes save() match on the loaded __v, so if anyone changed the
        // team in between (another modal, a player-page assignment — those
        // all bump __v, see teamJerseyGuard.js) this save is rejected
        // instead of silently undoing their change or saving a duplicate
        // that the validation above never saw.
        team.increment();
        try {
            await team.save();
        } catch (err) {
            if (err?.name !== "VersionError") throw err;
            return rosterConflictResponse(team._id);
        }

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

        // Defense-in-depth: re-check that every touched player's status
        // agrees with actual roster membership, in case syncAssignedPlayers
        // raced with a concurrent edit elsewhere.
        const touchedPlayerIds = [...new Set([...nextPlayerIds, ...prevPlayerIds])];
        if (touchedPlayerIds.length > 0) {
            await reconcilePlayerStatuses(touchedPlayerIds);
        }

        const updated = await populateTeam(Team.findById(team._id));

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
        if (team.isPlaceholder) {
            return NextResponse.json({ success: false, error: "Placeholder teams cannot be deleted" }, { status: 403 });
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
