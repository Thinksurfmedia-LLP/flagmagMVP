import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Team from "@/models/Team";
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
        "manage_teams",
        "team_create",
        "manage_organizations",
        "organization_update",
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

        // Validate required header
        if (!headers.includes("name")) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'CSV must contain a "name" column. Found columns: ' + headers.join(", "),
                },
                { status: 400 }
            );
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

        // Get existing team names for this org (for duplicate checking)
        const existingTeams = await Team.find({ organization: organizationId })
            .select("name")
            .lean();
        const existingNames = new Set(
            existingTeams.map((t) => t.name.toLowerCase().trim())
        );

        const results = {
            total: rows.length,
            created: 0,
            skipped: 0,
            errors: 0,
            details: [],
        };

        for (const row of rows) {
            const name = row.name?.trim();

            // Validate
            if (!name) {
                results.errors++;
                results.details.push({
                    row: row._rowNum,
                    name: "(empty)",
                    status: "error",
                    reason: "Team name is required",
                });
                continue;
            }

            // Check duplicate
            if (existingNames.has(name.toLowerCase())) {
                results.skipped++;
                results.details.push({
                    row: row._rowNum,
                    name,
                    status: "skipped",
                    reason: "Team already exists in this organization",
                });
                continue;
            }

            // Build location object — normalize casing to prevent duplicates
            const toTitleCase = (s) =>
                s ? s.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : "";
            const toUpper = (s) => (s ? s.trim().toUpperCase() : "");

            const rawState = row.statename || row.state_name || row.state || "";
            const rawAbbr = row.stateabbr || row.state_abbr || "";
            const rawCounty = row.countyname || row.county_name || row.county || "";
            const rawCity = row.cityname || row.city_name || row.city || "";

            const location = {};
            if (rawState) location.stateName = toTitleCase(rawState);
            if (rawAbbr) location.stateAbbr = toUpper(rawAbbr);
            if (rawCounty) location.countyName = toTitleCase(rawCounty);
            if (rawCity) location.cityName = toTitleCase(rawCity);

            try {
                await Team.create({
                    name,
                    logo: row.logo || "",
                    description: row.description || "",
                    division: row.division || "",
                    location,
                    organization: organizationId,
                    players: [],
                });

                existingNames.add(name.toLowerCase());
                results.created++;
                results.details.push({
                    row: row._rowNum,
                    name,
                    status: "created",
                    reason: "",
                });
            } catch (err) {
                results.errors++;
                results.details.push({
                    row: row._rowNum,
                    name,
                    status: "error",
                    reason: err.message,
                });
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
