import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Organization from "@/models/Organization";
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

function toTitleCase(s) {
    return s
        ? s.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        : "";
}

function generatePassword(name) {
    // First name in CAPS + '@' + 'FLAGMAG' + current year
    const firstName = (name || "User").split(/\s+/)[0].toUpperCase();
    const year = new Date().getFullYear();
    return `${firstName}@FLAGMAG${year}`;
}

export async function POST(request) {
    const auth = await requireAnyPermission(["manage_users"]);
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

        if (!headers.includes("name")) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'CSV must contain a "name" column. Found columns: ' + headers.join(", "),
                },
                { status: 400 }
            );
        }

        if (!headers.includes("email")) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'CSV must contain an "email" column. Found columns: ' + headers.join(", "),
                },
                { status: 400 }
            );
        }

        // Pre-load all organizations for name → ID lookup (case-insensitive)
        const allOrgs = await Organization.find({}).select("name").lean();
        const orgMap = {};
        for (const org of allOrgs) {
            orgMap[org.name.toLowerCase().trim()] = String(org._id);
        }

        // Pre-load existing emails for duplicate checking
        const existingEmails = new Set(
            (await User.find({}).select("email").lean()).map((u) => u.email.toLowerCase().trim())
        );

        const results = {
            total: rows.length,
            created: 0,
            skipped: 0,
            errors: 0,
            details: [],
        };

        const VALID_ROLES = ["free_agent", "viewer", "statistician", "organizer"];

        for (const row of rows) {
            const name = toTitleCase(row.name);
            const email = (row.email || "").toLowerCase().trim();
            const phone = (row.phone || "").trim();
            const orgName = (row.organization || "").trim();
            const rawRole = (row.role || "").toLowerCase().trim().replace(/\s+/g, "_");

            // Validate name
            if (!name) {
                results.errors++;
                results.details.push({
                    row: row._rowNum,
                    name: "(empty)",
                    status: "error",
                    reason: "Name is required",
                });
                continue;
            }

            // Validate email
            if (!email) {
                results.errors++;
                results.details.push({
                    row: row._rowNum,
                    name,
                    status: "error",
                    reason: "Email is required",
                });
                continue;
            }

            // Determine role — default to free_agent if not specified or invalid
            let primaryRole = rawRole && VALID_ROLES.includes(rawRole) ? rawRole : "free_agent";

            if (rawRole && !VALID_ROLES.includes(rawRole)) {
                results.errors++;
                results.details.push({
                    row: row._rowNum,
                    name,
                    status: "error",
                    reason: `Invalid role "${rawRole}". Allowed: ${VALID_ROLES.join(", ")}`,
                });
                continue;
            }

            // Build roles array — always include viewer
            const rolesArray = [...new Set([primaryRole, "viewer"])];

            // Check duplicate email
            if (existingEmails.has(email)) {
                results.skipped++;
                results.details.push({
                    row: row._rowNum,
                    name,
                    status: "skipped",
                    reason: `User with email ${email} already exists`,
                });
                continue;
            }

            // Resolve organization by name (case-insensitive)
            let organizationId = null;
            if (orgName) {
                organizationId = orgMap[orgName.toLowerCase().trim()];
                if (!organizationId) {
                    results.errors++;
                    results.details.push({
                        row: row._rowNum,
                        name,
                        status: "error",
                        reason: `Organization "${orgName}" not found`,
                    });
                    continue;
                }
            }

            // Roles like organizer, statistician, free_agent require an organization
            if (primaryRole !== "viewer" && !organizationId) {
                results.errors++;
                results.details.push({
                    row: row._rowNum,
                    name,
                    status: "error",
                    reason: `Organization is required for role "${primaryRole}"`,
                });
                continue;
            }

            // Auto-generate password: FIRSTNAME@FLAGMAGyyyy
            const rawPassword = generatePassword(name);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(rawPassword, salt);

            try {
                const userData = {
                    name,
                    email,
                    phone,
                    password: hashedPassword,
                    role: primaryRole,
                    roles: rolesArray,
                    isActive: true,
                };

                // Set organization and roleOrganizations
                if (organizationId) {
                    userData.organization = organizationId;
                    const roleOrgs = {};
                    // Map each non-viewer role to the organization
                    for (const r of rolesArray) {
                        if (r !== "viewer") {
                            roleOrgs[r] = [organizationId];
                        }
                    }
                    userData.roleOrganizations = roleOrgs;
                }

                await User.create(userData);

                existingEmails.add(email);
                results.created++;
                results.details.push({
                    row: row._rowNum,
                    name,
                    status: "created",
                    reason: `Role: ${primaryRole} | Password: ${rawPassword}`,
                });
            } catch (err) {
                if (err.code === 11000) {
                    results.skipped++;
                    results.details.push({
                        row: row._rowNum,
                        name,
                        status: "skipped",
                        reason: "Email already exists",
                    });
                } else {
                    results.errors++;
                    results.details.push({
                        row: row._rowNum,
                        name,
                        status: "error",
                        reason: err.message,
                    });
                }
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
