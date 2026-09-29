// READ-ONLY report: every team where two or more ACTIVE players share a
// jersey number. These legacy duplicates predate server-side validation on
// the player create/edit routes. They no longer lock the team's roster
// (PUT /api/teams/[id] only blocks duplicates a save introduces), but the
// stats app resolves plays by jersey number, so one player of each pair
// silently gets the other's stats until an organizer fixes it.
//
// This script never writes. Fixing is an organizer decision (renumber or
// deactivate one player) from the team's Manage Players modal.
//
// Usage: node scripts/find-duplicate-jerseys.mjs [--json]

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { findDuplicateActiveJerseys } = require("../src/lib/rosterJersey.js");

try {
    const lines = readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n");
    for (const line of lines) {
        const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
        if (m) { const k = m[1], v = m[2].replace(/^["']|["']$/g, ""); if (!process.env[k]) process.env[k] = v; }
    }
} catch { /**/ }

if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
}

const asJson = process.argv.includes("--json");

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
    const db = mongoose.connection.db;
    const teams = await db.collection("teams")
        .find({}, { projection: { name: 1, organization: 1, players: 1 } })
        .toArray();

    const findings = teams
        .map((t) => ({ team: t, duplicates: findDuplicateActiveJerseys(t.players || []) }))
        .filter((f) => f.duplicates.length > 0);

    const playerIds = findings.flatMap((f) => f.duplicates.flatMap((d) => d.playerIds));
    const [players, orgs] = await Promise.all([
        db.collection("players")
            .find({ _id: { $in: playerIds.map((id) => new mongoose.Types.ObjectId(id)) } }, { projection: { name: 1 } })
            .toArray(),
        db.collection("organizations")
            .find({ _id: { $in: findings.map((f) => f.team.organization).filter(Boolean) } }, { projection: { name: 1 } })
            .toArray(),
    ]);
    const playerName = new Map(players.map((p) => [String(p._id), p.name]));
    const orgName = new Map(orgs.map((o) => [String(o._id), o.name]));

    const report = findings.map(({ team, duplicates }) => ({
        teamId: String(team._id),
        team: team.name,
        organization: orgName.get(String(team.organization)) || "",
        duplicates: duplicates.map((d) => ({
            jerseyNumber: d.jerseyNumber,
            players: d.playerIds.map((id) => ({ id, name: playerName.get(id) || "(unknown)" })),
        })),
    }));

    if (asJson) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(`\nScanned ${teams.length} teams — ${report.length} with duplicate active jersey numbers\n`);
        for (const r of report) {
            console.log(`${r.team}${r.organization ? `  [${r.organization}]` : ""}  (${r.teamId})`);
            for (const d of r.duplicates) {
                console.log(`   #${d.jerseyNumber}: ${d.players.map((p) => p.name).join(", ")}`);
            }
        }
        console.log("\nRead-only. Fix from each team's Manage Players modal (renumber or deactivate one player).");
    }
} finally {
    await mongoose.disconnect();
}
