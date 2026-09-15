// One-time backfill for the new "League.type is auto-derived from the
// org's default season" rule (src/lib/leagueSeasonSync.js). Every existing
// league has typeOverridden: false (the field is brand new), so without
// this, the retroactive reclassification would only happen lazily, org by
// org, the next time someone happened to touch that org's default season —
// silently, with no visibility into what's about to flip. This applies it
// to every organization up front, in one visible pass.
//
// For each organization: finds its default Season (skips orgs with none),
// then for every League in that org — active if its season is that
// default season, past otherwise. Leagues with no season at all are left
// untouched (nothing to compare against).
//
// Run modes:
//   node scripts/sync-league-types-to-default-season.mjs            -> dry run, no writes
//   node scripts/sync-league-types-to-default-season.mjs --apply     -> performs the writes

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

    const orgs = await db.collection("organizations").find({}).project({ name: 1 }).toArray();
    let totalToActive = 0;
    let totalToPast = 0;
    let totalUnchanged = 0;
    let totalOverridden = 0;
    let totalNoSeason = 0;

    for (const org of orgs) {
        const defaultSeason = await db.collection("seasons").findOne({ organization: org._id, isDefault: true });
        const leagues = await db.collection("leagues")
            .find({ organization: org._id })
            .project({ name: 1, type: 1, typeOverridden: 1, season: 1 })
            .toArray();

        if (leagues.length === 0) continue;

        const changes = []; // { league, from, to }
        let orgOverridden = 0;
        let orgNoSeason = 0;

        for (const league of leagues) {
            if (league.typeOverridden === true) { orgOverridden++; continue; }
            if (!league.season) { orgNoSeason++; continue; }
            const isCurrentSeason = defaultSeason && String(league.season) === String(defaultSeason._id);
            const nextType = isCurrentSeason ? "active" : "past";
            const currentType = league.type || "active";
            if (nextType !== currentType) {
                changes.push({ league, from: currentType, to: nextType });
            }
        }

        totalOverridden += orgOverridden;
        totalNoSeason += orgNoSeason;
        totalUnchanged += leagues.length - orgOverridden - orgNoSeason - changes.length;

        if (changes.length === 0 && orgOverridden === 0 && orgNoSeason === 0) continue;

        console.log(`\n${org.name} — default season: ${defaultSeason ? defaultSeason.name : "(none set)"}`);
        if (orgOverridden > 0) console.log(`  ${orgOverridden} league(s) manually overridden — left alone`);
        if (orgNoSeason > 0) console.log(`  ${orgNoSeason} league(s) with no season — left alone`);
        for (const c of changes) {
            console.log(`  "${c.league.name}": ${c.from} -> ${c.to}`);
            if (c.to === "active") totalToActive++;
            else totalToPast++;
        }

        if (APPLY && changes.length > 0) {
            for (const c of changes) {
                await db.collection("leagues").updateOne({ _id: c.league._id }, { $set: { type: c.to } });
            }
        }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Flipped to active: ${totalToActive}`);
    console.log(`Flipped to past:   ${totalToPast}`);
    console.log(`Already correct:   ${totalUnchanged}`);
    console.log(`Manually overridden (skipped): ${totalOverridden}`);
    console.log(`No season set (skipped): ${totalNoSeason}`);
    if (!APPLY) console.log("\nDry run only — re-run with --apply to write these changes.");

    await mongoose.disconnect();
    console.log("\nDone.");
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
