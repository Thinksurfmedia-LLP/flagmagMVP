import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import Team from "@/models/Team";
import League from "@/models/League";
import Location from "@/models/Location";
import Season from "@/models/Season";
import User from "@/models/User";
import { requireAnyPermission } from "@/lib/apiAuth";

function parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCsv(text) {
    const lines = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .filter((l) => l.trim());

    if (lines.length < 2) return { headers: [], rows: [] };

    const headers = parseCsvLine(lines[0]).map((h) =>
        h.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")
    );

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || "";
        });
        row._rowNum = i + 1;
        rows.push(row);
    }
    return { headers, rows };
}

async function getOrgIdForUser(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc = await User.findById(authUser.id)
        .select("organization roleOrganizations")
        .lean();

    if (userDoc?.roleOrganizations?.organizer) {
        const orgs = userDoc.roleOrganizations.organizer;
        if (Array.isArray(orgs) && orgs.length > 0) return String(orgs[0]);
        if (typeof orgs === "string") return String(orgs);
    }

    return userDoc?.organization ? String(userDoc.organization) : null;
}

export async function POST(request) {
    const auth = await requireAnyPermission([
        "manage_games",
        "game_create",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();

        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || typeof file === "string") {
            return NextResponse.json(
                { success: false, error: "CSV file is required" },
                { status: 400 }
            );
        }

        const text = await file.text();
        const { headers, rows } = parseCsv(text);

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "CSV file is empty or has no data rows" },
                { status: 400 }
            );
        }

        // Validate required headers
        const requiredHeaders = ["date", "teama", "teamb"];
        for (const rh of requiredHeaders) {
            // Allow flexible naming: teamA / team_a / teama
            const found = headers.some((h) => h.replace(/_/g, "") === rh);
            if (!found) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `CSV must contain a "${rh}" column. Found columns: ${headers.join(", ")}`,
                    },
                    { status: 400 }
                );
            }
        }

        // Resolve organization
        const allRoles = auth.user.roles?.length ? auth.user.roles : [auth.user.role];
        const isAdmin = allRoles.includes("admin");
        const organizationId = isAdmin
            ? formData.get("organization") || (await getOrgIdForUser(auth.user))
            : await getOrgIdForUser(auth.user);

        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization could not be determined" },
                { status: 400 }
            );
        }

        // Pre-fetch all org data for lookups (case-insensitive)
        const [orgSeasons, orgLeagues, orgTeams, allVenues] = await Promise.all([
            Season.find({ organization: organizationId }).lean(),
            League.find({ organization: organizationId }).lean(),
            Team.find({ organization: organizationId }).lean(),
            Location.find({}).lean(),
        ]);

        // Build case-insensitive lookup maps
        const seasonMap = {};
        orgSeasons.forEach((s) => {
            seasonMap[s.name.toLowerCase().trim()] = s;
        });

        const leagueMap = {};
        orgLeagues.forEach((l) => {
            leagueMap[l.name.toLowerCase().trim()] = l;
        });

        const teamMap = {};
        orgTeams.forEach((t) => {
            teamMap[t.name.toLowerCase().trim()] = t;
        });

        // Build venue lookup map (name -> venue doc, case-insensitive)
        const venueMap = {};
        allVenues.forEach((v) => {
            venueMap[v.name.toLowerCase().trim()] = v;
        });

        // Helper to get a row value with flexible header names
        const getVal = (row, ...keys) => {
            for (const k of keys) {
                // Try exact key
                if (row[k] !== undefined && row[k] !== "") return row[k];
                // Try without underscores
                const flat = k.replace(/_/g, "");
                for (const h of Object.keys(row)) {
                    if (h.replace(/_/g, "") === flat && row[h] !== undefined && row[h] !== "") {
                        return row[h];
                    }
                }
            }
            return "";
        };

        const results = {
            total: rows.length,
            created: 0,
            skipped: 0,
            errors: 0,
            details: [],
        };

        for (const row of rows) {
            const seasonName = getVal(row, "season", "season_name", "seasonname").trim();
            const leagueName = getVal(row, "league", "league_name", "leaguename").trim();
            const dateStr = getVal(row, "date", "game_date", "gamedate").trim();
            const timeStr = getVal(row, "time", "game_time", "gametime").trim();
            const teamAName = getVal(row, "teama", "team_a", "teamaname", "team_a_name").trim();
            const teamBName = getVal(row, "teamb", "team_b", "teambname", "team_b_name").trim();
            const locationStr = getVal(row, "location", "venue", "venue_name", "venuename").trim();

            const label = `${teamAName || "?"} vs ${teamBName || "?"}`;

            // Validate required fields
            if (!dateStr) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: "Date is required" });
                continue;
            }
            if (!teamAName) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: "Team A is required" });
                continue;
            }
            if (!teamBName) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: "Team B is required" });
                continue;
            }

            // Parse date — DD/MM/YYYY format
            let gameDate = null;
            const normalized = dateStr.replace(/\//g, "-");
            const parts = normalized.split("-");
            if (parts.length === 3) {
                let [dd, mm, yy] = parts.map((p) => p.trim());
                const year = yy.length === 2 ? `20${yy}` : yy;
                gameDate = new Date(`${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00`);
            }
            if (!gameDate || isNaN(gameDate.getTime())) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: `Invalid date: "${dateStr}". Use DD/MM/YYYY format` });
                continue;
            }

            // Resolve league
            let resolvedLeague = null;
            if (leagueName) {
                resolvedLeague = leagueMap[leagueName.toLowerCase()];
                if (!resolvedLeague) {
                    results.errors++;
                    results.details.push({ row: row._rowNum, name: label, status: "error", reason: `League "${leagueName}" not found in this organization` });
                    continue;
                }
            }

            // If no league name given but season name is given, try to find a league in that season
            if (!resolvedLeague && seasonName) {
                const season = seasonMap[seasonName.toLowerCase()];
                if (!season) {
                    results.errors++;
                    results.details.push({ row: row._rowNum, name: label, status: "error", reason: `Season "${seasonName}" not found in this organization` });
                    continue;
                }
                // Find the first league in this season
                const leaguesInSeason = orgLeagues.filter(
                    (l) => String(l.season?._id || l.season) === String(season._id)
                );
                if (leaguesInSeason.length === 0) {
                    results.errors++;
                    results.details.push({ row: row._rowNum, name: label, status: "error", reason: `No leagues found in season "${seasonName}"` });
                    continue;
                }
                if (leaguesInSeason.length === 1) {
                    resolvedLeague = leaguesInSeason[0];
                } else {
                    results.errors++;
                    results.details.push({ row: row._rowNum, name: label, status: "error", reason: `Multiple leagues found in season "${seasonName}". Please specify a league name.` });
                    continue;
                }
            }

            // If season name is given and league name is given, verify the league belongs to that season
            if (resolvedLeague && seasonName) {
                const season = seasonMap[seasonName.toLowerCase()];
                if (season) {
                    const leagueSeasonId = String(resolvedLeague.season?._id || resolvedLeague.season);
                    if (leagueSeasonId !== String(season._id)) {
                        results.errors++;
                        results.details.push({ row: row._rowNum, name: label, status: "error", reason: `League "${leagueName}" does not belong to season "${seasonName}"` });
                        continue;
                    }
                }
            }

            if (!resolvedLeague) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: "A league name (or season name) is required to schedule a game" });
                continue;
            }

            // Validate against league start date
            if (resolvedLeague.startDate) {
                const leagueStart = new Date(resolvedLeague.startDate);
                leagueStart.setHours(0, 0, 0, 0);
                if (gameDate < leagueStart) {
                    const formatted = leagueStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    results.errors++;
                    results.details.push({ row: row._rowNum, name: label, status: "error", reason: `Game date is before league start date (${formatted})` });
                    continue;
                }
            }

            // Resolve venue (required, case-insensitive)
            if (!locationStr) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: "Venue is required" });
                continue;
            }
            const venueDoc = venueMap[locationStr.toLowerCase()];
            if (!venueDoc) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: `Venue "${locationStr}" not found. Check your venue name matches an existing location.` });
                continue;
            }
            const resolvedLocation = venueDoc.name;

            // Resolve teams (case-insensitive)
            const teamADoc = teamMap[teamAName.toLowerCase()];
            const teamBDoc = teamMap[teamBName.toLowerCase()];

            if (!teamADoc) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: `Team A "${teamAName}" not found in this organization` });
                continue;
            }
            if (!teamBDoc) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: `Team B "${teamBName}" not found in this organization` });
                continue;
            }

            // Check for duplicate game (same league + date + teams)
            const existingGame = await Game.findOne({
                league: resolvedLeague._id,
                date: {
                    $gte: new Date(new Date(gameDate).setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date(gameDate).setHours(23, 59, 59, 999)),
                },
                "teamA.name": teamADoc.name,
                "teamB.name": teamBDoc.name,
            }).lean();

            if (existingGame) {
                results.skipped++;
                results.details.push({ row: row._rowNum, name: label, status: "skipped", reason: "Game already exists (same league, date, teams)" });
                continue;
            }

            try {
                await Game.create({
                    league: resolvedLeague._id,
                    date: gameDate,
                    time: timeStr,
                    teamA: {
                        name: teamADoc.name,
                        logo: teamADoc.logo || "",
                        score: null,
                    },
                    teamB: {
                        name: teamBDoc.name,
                        logo: teamBDoc.logo || "",
                        score: null,
                    },
                    location: resolvedLocation,
                    status: "upcoming",
                });

                results.created++;
                results.details.push({ row: row._rowNum, name: `${teamADoc.name} vs ${teamBDoc.name}`, status: "created", reason: "" });
            } catch (err) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: label, status: "error", reason: err.message });
            }
        }

        return NextResponse.json({ success: true, data: results });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
