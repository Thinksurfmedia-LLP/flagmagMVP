// Migrates Team.league (single ref) + Team.season + Team.division into
// Team.leagues[] (array of {league, division, joinedAt}), so a team can
// belong to more than one league (e.g. a regular league + playoffs) at once
// while keeping one persistent identity across every league it ever played.
//
// Run modes:
//   node scripts/migrate-team-leagues.mjs            -> dry run, no writes
//   node scripts/migrate-team-leagues.mjs --apply     -> performs the writes

import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const APPLY = process.argv.includes("--apply");

function loadEnv(envPath) {
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
}

loadEnv(path.join(rootDir, ".env"));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
}

async function main() {
    console.log(APPLY ? "Mode: APPLY (will write changes)" : "Mode: DRY RUN (no writes)");
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    console.log(`Connected to database: ${db.databaseName}\n`);

    const teams = await db.collection("teams").find({}).toArray();
    console.log(`Found ${teams.length} team documents.\n`);

    let alreadyMigrated = 0;
    let toMigrateWithLeague = 0;
    let toMigrateNoLeague = 0;
    let applied = 0;

    for (const team of teams) {
        if (Array.isArray(team.leagues)) {
            alreadyMigrated++;
            continue;
        }

        const newLeagues = team.league
            ? [{
                league: team.league,
                division: team.division || "",
                joinedAt: team.createdAt || new Date(),
            }]
            : [];

        if (team.league) toMigrateWithLeague++;
        else toMigrateNoLeague++;

        console.log(
            `${APPLY ? "MIGRATING" : "WOULD MIGRATE"}: "${team.name}" (org ${team.organization}) ` +
            `-> leagues: ${JSON.stringify(newLeagues)}`
        );

        if (APPLY) {
            await db.collection("teams").updateOne(
                { _id: team._id },
                {
                    $set: { leagues: newLeagues },
                    $unset: { league: "", season: "", division: "" },
                }
            );
            applied++;
        }
    }

    console.log("\n--- Summary ---");
    console.log("Already migrated (skipped):", alreadyMigrated);
    console.log("Teams with a league to migrate:", toMigrateWithLeague);
    console.log("Teams with no league (migrated to empty array):", toMigrateNoLeague);
    if (APPLY) console.log("Documents updated:", applied);
    else console.log("\nNo writes performed. Re-run with --apply to perform the migration.");

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
});
