// Replaces the League collection's unique index — was {organization, slug},
// now {organization, season, slug} — so the same league name (e.g. "Chino")
// can be created again each new season instead of colliding with last
// season's league of the same name.
//
// Safe to run any time: every existing document is already unique under
// {organization, slug}, which trivially makes it unique under the wider
// {organization, season, slug} key too — no document can violate the new
// index, so this never fails on existing data.
//
//   node scripts/migrate-league-season-index.mjs

import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

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

const OLD_INDEX_NAME = "organization_1_slug_1";
const NEW_INDEX_SPEC = { organization: 1, season: 1, slug: 1 };
const NEW_INDEX_NAME = "organization_1_season_1_slug_1";

async function main() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    console.log(`Connected to database: ${db.databaseName}\n`);

    const leagues = db.collection("leagues");
    const existingIndexes = await leagues.indexes();
    console.log("Current indexes:", existingIndexes.map((i) => i.name).join(", "));

    const hasOld = existingIndexes.some((i) => i.name === OLD_INDEX_NAME);
    const hasNew = existingIndexes.some((i) => i.name === NEW_INDEX_NAME);

    if (hasOld) {
        console.log(`Dropping old index "${OLD_INDEX_NAME}"...`);
        await leagues.dropIndex(OLD_INDEX_NAME);
        console.log("Dropped.");
    } else {
        console.log(`Old index "${OLD_INDEX_NAME}" not present — nothing to drop.`);
    }

    if (hasNew) {
        console.log(`New index "${NEW_INDEX_NAME}" already present — nothing to create.`);
    } else {
        console.log(`Creating new index "${NEW_INDEX_NAME}"...`);
        await leagues.createIndex(NEW_INDEX_SPEC, { unique: true, name: NEW_INDEX_NAME });
        console.log("Created.");
    }

    const finalIndexes = await leagues.indexes();
    console.log("\nFinal indexes:", finalIndexes.map((i) => i.name).join(", "));

    await mongoose.disconnect();
    console.log("\nDone.");
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
