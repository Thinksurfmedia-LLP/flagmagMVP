import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
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

// Same lookup duplicated across /api/free-agents, /api/teams, /api/admin/import/teams.
async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc =
        (await User.findById(authUser.id).select("organization roleOrganizations").lean()) ||
        (await User.findOne({ email: authUser.email }).select("organization roleOrganizations").lean());

    if (userDoc?.roleOrganizations?.organizer) {
        const orgs = userDoc.roleOrganizations.organizer;
        if (Array.isArray(orgs) && orgs.length > 0) return String(orgs[0]);
        if (typeof orgs === "string") return String(orgs);
    }

    return userDoc?.organization ? String(userDoc.organization) : null;
}

export async function POST(request) {
    const auth = await requireAnyPermission(["manage_players", "player_create"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();

        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || typeof file === "string") {
            return NextResponse.json({ success: false, error: "CSV file is required" }, { status: 400 });
        }

        const text = await file.text();
        const { headers, rows } = parseCsv(text);

        if (rows.length === 0) {
            return NextResponse.json({ success: false, error: "CSV file is empty or has no data rows" }, { status: 400 });
        }

        for (const required of ["name", "email", "password"]) {
            if (!headers.includes(required)) {
                return NextResponse.json(
                    { success: false, error: `CSV must contain a "${required}" column. Found columns: ${headers.join(", ")}` },
                    { status: 400 }
                );
            }
        }

        const allRoles = auth.user.roles?.length ? auth.user.roles : [auth.user.role];
        const isAdmin = allRoles.includes("admin");
        const organizationId = isAdmin
            ? formData.get("organization") || (await getOrgIdForOrganizer(auth.user))
            : await getOrgIdForOrganizer(auth.user);

        if (!organizationId) {
            return NextResponse.json({ success: false, error: "Organization could not be determined" }, { status: 400 });
        }

        const results = { total: rows.length, created: 0, skipped: 0, errors: 0, details: [] };

        for (const row of rows) {
            const name = row.name?.trim();
            const email = row.email?.trim().toLowerCase();
            const password = row.password || "";
            const phone = (row.phone || "").trim();

            if (!name || !email || !password) {
                results.errors++;
                results.details.push({ row: row._rowNum, name: name || "(empty)", status: "error", reason: "Name, email, and password are required" });
                continue;
            }
            if (password.length < 6) {
                results.errors++;
                results.details.push({ row: row._rowNum, name, status: "error", reason: "Password must be at least 6 characters" });
                continue;
            }

            try {
                // Siblings sharing one parent email/login: reuse the existing
                // account rather than reject it — a User can hold more than
                // one Player per org now (see Player.js's unique index). The
                // row's own password only matters for the FIRST row that
                // creates the account; later rows sharing that email are
                // additional kids under the same login, so their password
                // column is inert (documented on the import modal).
                const existingUser = await User.findOne({ email }).select("_id").lean();

                if (existingUser) {
                    const existingPlayer = await Player.findOne({ user: existingUser._id, organization: organizationId, name }).select("_id").lean();
                    if (existingPlayer) {
                        results.skipped++;
                        results.details.push({ row: row._rowNum, name, status: "skipped", reason: "Already registered as a free agent for this organization" });
                        continue;
                    }

                    await Player.create({
                        user: existingUser._id,
                        name,
                        email,
                        phone,
                        organization: organizationId,
                        status: "free_agent",
                    });
                    results.created++;
                    results.details.push({ row: row._rowNum, name, status: "created", reason: "Added under the existing account with this email — password column ignored" });
                    continue;
                }

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                const newUser = await User.create({
                    name,
                    email,
                    phone,
                    password: hashedPassword,
                    role: "free_agent",
                    roles: ["free_agent"],
                    organization: organizationId,
                    roleOrganizations: { free_agent: [organizationId] },
                });

                await Player.create({
                    user: newUser._id,
                    name,
                    email,
                    phone,
                    organization: organizationId,
                    status: "free_agent",
                });

                results.created++;
                results.details.push({ row: row._rowNum, name, status: "created", reason: "" });
            } catch (err) {
                results.errors++;
                results.details.push({ row: row._rowNum, name, status: "error", reason: err.message });
            }
        }

        return NextResponse.json({ success: true, data: results });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
