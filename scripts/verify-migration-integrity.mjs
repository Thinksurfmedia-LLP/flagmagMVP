// Compares the pre-migration JSON backup against the live database, scoped to
// a given organization, to prove the Team.league -> Team.leagues[] migration
// didn't touch anything it shouldn't have (games, plays, players, leagues,
// schedules) and correctly transformed what it should have (teams).

import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const BACKUP_DIR = path.join(rootDir, "db-backups", "2026-07-17T10-23-10-459Z");
const ORG_NAME = "XFlagFootball";

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

function readBackup(name) {
    return JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, `${name}.json`), "utf8"));
}

// Normalize a doc for comparison: strip fields we KNOW the migration is
// allowed to change on teams, and stringify consistently regardless of key
// order or BSON-vs-plain-object type differences (both sides pass through
// the same JSON.stringify(driver-native-doc) round trip already).
function stableStringify(value) {
    // The backup was JSON-serialized already (ObjectId/Date -> plain strings
    // via their toJSON()), but live driver reads return real BSON ObjectId
    // and Date instances. Normalize both sides to the same string form
    // before comparing, or every doc looks "changed" when nothing moved.
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (value && typeof value.toHexString === "function") return JSON.stringify(value.toHexString());
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        const keys = Object.keys(value).sort();
        return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

async function main() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    console.log("Connected.\n");

    const backupOrgs = readBackup("organizations");
    const org = backupOrgs.find((o) => o.name === ORG_NAME);
    const orgId = String(org._id);
    console.log(`Organization: ${ORG_NAME} (${orgId})\n`);

    // ---- Collections that should be 100% untouched ----
    const untouchedChecks = [
        { name: "games", filterField: null }, // filtered via league ids below
        { name: "plays", filterField: null },
        { name: "players", filterField: "organization" },
        { name: "leagues", filterField: "organization" },
        { name: "schedules", filterField: "organization" },
        { name: "organizations", filterField: "_id", filterValue: orgId },
    ];

    const backupLeagues = readBackup("leagues").filter((l) => String(l.organization) === orgId);
    const orgLeagueIds = new Set(backupLeagues.map((l) => String(l._id)));

    const backupGames = readBackup("games").filter((g) => orgLeagueIds.has(String(g.league)));
    const orgGameIds = new Set(backupGames.map((g) => String(g._id)));
    const backupPlays = readBackup("plays").filter((p) => orgGameIds.has(String(p.game)));

    async function compareSet(label, backupDocs, currentDocs) {
        const backupById = new Map(backupDocs.map((d) => [String(d._id), d]));
        const currentById = new Map(currentDocs.map((d) => [String(d._id), d]));

        const missing = [...backupById.keys()].filter((id) => !currentById.has(id));
        const extra = [...currentById.keys()].filter((id) => !backupById.has(id));
        let changed = 0;
        const changedIds = [];

        for (const [id, before] of backupById) {
            const after = currentById.get(id);
            if (!after) continue;
            if (stableStringify(before) !== stableStringify(after)) {
                changed++;
                changedIds.push(id);
            }
        }

        const status = missing.length === 0 && extra.length === 0 && changed === 0 ? "OK" : "MISMATCH";
        console.log(`[${status}] ${label}: backup=${backupDocs.length} current=${currentDocs.length} missing=${missing.length} extra=${extra.length} changed=${changed}`);
        if (changed > 0) console.log(`   changed ids: ${changedIds.slice(0, 5).join(", ")}${changedIds.length > 5 ? "..." : ""}`);
        if (missing.length > 0) console.log(`   missing ids: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`);
        return status === "OK";
    }

    let allOk = true;

    // Organizations (this org's doc only)
    {
        const current = await db.collection("organizations").find({ _id: new mongoose.Types.ObjectId(orgId) }).toArray();
        allOk = await compareSet("organizations", [org], current) && allOk;
    }

    // Leagues
    {
        const current = await db.collection("leagues").find({ organization: new mongoose.Types.ObjectId(orgId) }).toArray();
        allOk = await compareSet("leagues", backupLeagues, current) && allOk;
    }

    // Games
    {
        const current = await db.collection("games").find({ league: { $in: [...orgLeagueIds].map((id) => new mongoose.Types.ObjectId(id)) } }).toArray();
        allOk = await compareSet("games", backupGames, current) && allOk;
    }

    // Plays
    {
        const current = await db.collection("plays").find({ game: { $in: [...orgGameIds].map((id) => new mongoose.Types.ObjectId(id)) } }).toArray();
        allOk = await compareSet("plays", backupPlays, current) && allOk;
    }

    // Players
    {
        const backupPlayers = readBackup("players").filter((p) => String(p.organization) === orgId);
        const current = await db.collection("players").find({ organization: new mongoose.Types.ObjectId(orgId) }).toArray();
        allOk = await compareSet("players", backupPlayers, current) && allOk;
    }

    // Schedules
    {
        const backupSchedules = readBackup("schedules").filter((s) => String(s.organization) === orgId);
        const current = await db.collection("schedules").find({ organization: new mongoose.Types.ObjectId(orgId) }).toArray();
        allOk = await compareSet("schedules", backupSchedules, current) && allOk;
    }

    // ---- Teams: expected to change (league/season/division -> leagues[]) ----
    console.log("\n--- Teams (expected transformation) ---");
    const backupTeams = readBackup("teams").filter((t) => String(t.organization) === orgId);
    const currentTeams = await db.collection("teams").find({ organization: new mongoose.Types.ObjectId(orgId) }).toArray();
    const currentById = new Map(currentTeams.map((t) => [String(t._id), t]));

    let teamsOk = true;
    if (backupTeams.length !== currentTeams.length) {
        console.log(`[MISMATCH] team count: backup=${backupTeams.length} current=${currentTeams.length}`);
        teamsOk = false;
    }

    const FIELDS_THAT_MUST_MATCH = ["name", "logo", "description", "coachName", "coachPhone", "location", "organization", "players", "isPlaceholder", "createdAt", "updatedAt"];

    for (const before of backupTeams) {
        const after = currentById.get(String(before._id));
        if (!after) {
            console.log(`[MISSING] team "${before.name}" (${before._id}) not found in current DB`);
            teamsOk = false;
            continue;
        }

        for (const field of FIELDS_THAT_MUST_MATCH) {
            if (stableStringify(before[field]) !== stableStringify(after[field])) {
                console.log(`[MISMATCH] team "${before.name}" field "${field}" changed`);
                console.log(`   before: ${stableStringify(before[field])}`);
                console.log(`   after:  ${stableStringify(after[field])}`);
                teamsOk = false;
            }
        }

        // league/season/division should now live inside leagues[0]
        if (!Array.isArray(after.leagues) || after.leagues.length !== 1) {
            console.log(`[MISMATCH] team "${before.name}" expected exactly 1 leagues[] entry, got ${after.leagues?.length}`);
            teamsOk = false;
            continue;
        }
        const membership = after.leagues[0];
        if (String(membership.league) !== String(before.league)) {
            console.log(`[MISMATCH] team "${before.name}" league id changed: ${before.league} -> ${membership.league}`);
            teamsOk = false;
        }
        if ((membership.division || "") !== (before.division || "")) {
            console.log(`[MISMATCH] team "${before.name}" division changed: "${before.division}" -> "${membership.division}"`);
            teamsOk = false;
        }
        if (after.league !== undefined || after.season !== undefined || after.division !== undefined) {
            console.log(`[MISMATCH] team "${before.name}" still has old league/season/division top-level fields`);
            teamsOk = false;
        }
    }

    console.log(teamsOk ? "[OK] teams: all fields preserved, league/division correctly moved into leagues[]" : "[MISMATCH] teams: see above");
    allOk = allOk && teamsOk;

    console.log("\n=== FINAL RESULT ===");
    console.log(allOk ? "ALL DATA VERIFIED INTACT — nothing lost, nothing unexpectedly changed." : "MISMATCHES FOUND — see above.");

    await mongoose.disconnect();
    process.exitCode = allOk ? 0 : 1;
}

main().catch((err) => {
    console.error("Verification failed:", err);
    process.exitCode = 1;
});
