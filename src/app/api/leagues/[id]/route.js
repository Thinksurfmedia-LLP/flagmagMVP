import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import League from "@/models/League";
import User from "@/models/User";
import Organization from "@/models/Organization";
import Venue from "@/models/Location";
import Team from "@/models/Team";
import Game from "@/models/Game";
import Schedule from "@/models/Schedule";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";

function normalizeText(value = "") {
    return String(value).trim().toLowerCase();
}

// UPDATE league
export async function PUT(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_leagues", "league_update"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const existing = await League.findById(id).select("organization allowPlaceholderTeams").lean();
        if (!existing) {
            return NextResponse.json({ success: false, error: "League not found" }, { status: 404 });
        }

        if (hasRole(auth.user, "organizer")) {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.includes(String(existing.organization))) {
                return NextResponse.json(
                    { success: false, error: "You can only update leagues for your assigned organization" },
                    { status: 403 },
                );
            }

            const organization = await Organization.findById(existing.organization).select("categories locations").lean();
            if (!organization) {
                return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
            }

            if (body.category !== undefined) {
                const allowedCategorySet = new Set(
                    (organization.categories || []).map((entry) => normalizeText(entry)).filter(Boolean)
                );
                if (body.category && !allowedCategorySet.has(normalizeText(body.category))) {
                    return NextResponse.json(
                        { success: false, error: "Category must be one of your organization's registered categories" },
                        { status: 400 },
                    );
                }
            }

            if (body.locations !== undefined) {
                const locations = Array.isArray(body.locations)
                    ? body.locations.map((entry) => String(entry).trim()).filter(Boolean)
                    : [];
                const orgLocationKeys = new Set(
                    (organization.locations || [])
                        .filter((loc) => loc.countyName && loc.stateAbbr)
                        .map((loc) => `${normalizeText(loc.countyName)}|${normalizeText(loc.stateAbbr)}`)
                );

                const venues = await Venue.find({ name: { $in: locations } })
                    .populate({ path: "county", populate: { path: "state" } })
                    .lean();

                const hasInvalidLocation = locations.some((venueName) => {
                    const venue = venues.find((v) => normalizeText(v.name) === normalizeText(venueName));
                    if (!venue || !venue.county) return true;
                    const key = `${normalizeText(venue.county.name)}|${normalizeText(venue.county.state?.abbreviation || "")}`;
                    return !orgLocationKeys.has(key);
                });
                if (hasInvalidLocation) {
                    return NextResponse.json(
                        { success: false, error: "Location must be selected from your organization's configured locations" },
                        { status: 400 },
                    );
                }

                body.locations = locations;
                body.location = locations[0] || "";
            }
        }

        delete body.time;
        delete body.organization; // Don't allow changing organization

        if (body.season !== undefined) {
            body.seasonOverridden = body.seasonOverridden || false;
        }

        // Turning the option off while games in this league still use a
        // placeholder team would silently orphan those matchups from the
        // team dropdown — block it and tell the admin exactly which games
        // are still relying on placeholders.
        if (body.allowPlaceholderTeams === false && existing.allowPlaceholderTeams) {
            const placeholderTeams = await Team.find({ organization: existing.organization, isPlaceholder: true })
                .select("name")
                .lean();
            const placeholderNames = placeholderTeams.map((t) => t.name);
            const placeholderIds = placeholderTeams.map((t) => String(t._id));

            if (placeholderNames.length > 0) {
                const conflictingGames = await Game.find({
                    league: id,
                    $or: [
                        { "teamA.name": { $in: placeholderNames } },
                        { "teamB.name": { $in: placeholderNames } },
                    ],
                })
                    .select("teamA.name teamB.name date")
                    .sort({ date: 1 })
                    .lean();

                const examples = conflictingGames
                    .slice(0, 3)
                    .map((g) => `${g.teamA?.name} vs ${g.teamB?.name} (${new Date(g.date).toLocaleDateString()})`);

                // A schedule row can have a placeholder picked for team1/team2
                // before it's been given a date — that row never gets synced
                // into a Game document (see schedules/[id]/route.js, which
                // skips syncing until date is set), so it wouldn't show up in
                // the Game query above. Check schedule rows directly too.
                const nameById = new Map(placeholderTeams.map((t) => [String(t._id), t.name]));
                const schedulesWithPlaceholders = await Schedule.find({
                    leagueId: id,
                    $or: [
                        { "weeks.games.team1": { $in: placeholderIds } },
                        { "weeks.games.team2": { $in: placeholderIds } },
                    ],
                }).lean();

                let scheduleRowCount = 0;
                for (const sch of schedulesWithPlaceholders) {
                    for (const week of sch.weeks || []) {
                        for (const g of week.games || []) {
                            if (g.gameRef) continue; // already counted via the Game query above
                            const t1Id = g.team1 ? String(g.team1) : null;
                            const t2Id = g.team2 ? String(g.team2) : null;
                            const usesPlaceholder = (t1Id && nameById.has(t1Id)) || (t2Id && nameById.has(t2Id));
                            if (!usesPlaceholder) continue;
                            scheduleRowCount++;
                            if (examples.length < 3) {
                                const t1Name = t1Id && nameById.has(t1Id) ? nameById.get(t1Id) : "?";
                                const t2Name = t2Id && nameById.has(t2Id) ? nameById.get(t2Id) : "?";
                                examples.push(`${t1Name} vs ${t2Name} (${g.date || "no date yet"})`);
                            }
                        }
                    }
                }

                const totalConflicts = conflictingGames.length + scheduleRowCount;
                if (totalConflicts > 0) {
                    const more = totalConflicts > examples.length ? ` and ${totalConflicts - examples.length} more` : "";
                    return NextResponse.json(
                        {
                            success: false,
                            error: `Can't turn off placeholder teams — ${totalConflicts} game(s)/schedule row(s) in this league still use one: ${examples.join(", ")}${more}. Reassign or remove those first.`,
                        },
                        { status: 409 },
                    );
                }
            }
        }

        const league = await League.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!league) {
            return NextResponse.json({ success: false, error: "League not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: league }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE league
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_leagues", "league_delete"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const league = await League.findById(id).select("organization");

        if (!league) {
            return NextResponse.json({ success: false, error: "League not found" }, { status: 404 });
        }

        if (hasRole(auth.user, "organizer")) {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.includes(String(league.organization))) {
                return NextResponse.json(
                    { success: false, error: "You can only delete leagues for your assigned organization" },
                    { status: 403 },
                );
            }
        }

        await League.deleteOne({ _id: id });

        return NextResponse.json({ success: true, message: "League deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
