// One-off cleanup for leagues created BEFORE generateUniqueLeagueSlug()
// existed (src/lib/leagueSlug.js) — back when the same name could be
// reused across seasons (once the {organization, season, slug} index
// replaced the old {organization, slug} one) without getting a
// disambiguated slug. Those leagues collide on the exact same public URL
// (/organizations/[org]/season/[slug]) and on any {organization, slug}
// lookup with no season filter — this reassigns every collision but the
// first (oldest) league in each group a disambiguated slug, the same way
// generateUniqueLeagueSlug() would have at creation time. Display `name`
// is never touched.
//
// Run modes:
//   node scripts/fix-duplicate-league-slugs.mjs            -> dry run, no writes
//   node scripts/fix-duplicate-league-slugs.mjs --apply     -> performs the writes

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

    const leagues = await db.collection("leagues")
        .find({})
        .project({ organization: 1, slug: 1, season: 1, name: 1, createdAt: 1 })
        .toArray();
    const seasons = await db.collection("seasons").find({}).project({ slug: 1 }).toArray();
    const seasonSlugById = new Map(seasons.map((s) => [String(s._id), s.slug]));

    // Track every slug already in use per org (org -> Set<slug>), seeded
    // from the full current dataset, so reassignments never collide with
    // an untouched sibling league either.
    const slugsByOrg = new Map();
    for (const l of leagues) {
        const orgKey = String(l.organization);
        if (!slugsByOrg.has(orgKey)) slugsByOrg.set(orgKey, new Set());
        slugsByOrg.get(orgKey).add(l.slug);
    }

    const groups = new Map(); // "org|slug" -> [league, ...]
    for (const l of leagues) {
        const key = `${l.organization}|${l.slug}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(l);
    }

    const collisions = [...groups.values()].filter((g) => g.length > 1);
    if (collisions.length === 0) {
        console.log("No colliding (organization, slug) pairs found. Nothing to do.");
        await mongoose.disconnect();
        return;
    }

    console.log(`Found ${collisions.length} colliding slug group(s):\n`);

    const updates = []; // { _id, from, to }
    for (const group of collisions) {
        // Oldest keeps its slug unchanged (whatever already links to it,
        // e.g. bookmarks, stays valid); every later duplicate gets a new one.
        group.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        const [keep, ...rest] = group;
        console.log(`  org=${keep.organization} slug="${keep.slug}" — ${group.length} leagues, keeping "${keep.name}" (${keep._id}) as-is`);

        const orgKey = String(keep.organization);
        const taken = slugsByOrg.get(orgKey);

        for (const dup of rest) {
            const base = dup.slug;
            let candidate = null;

            const seasonSlug = dup.season ? seasonSlugById.get(String(dup.season)) : null;
            if (seasonSlug) {
                const withSeason = `${base}-${seasonSlug}`;
                if (!taken.has(withSeason)) candidate = withSeason;
            }
            if (!candidate) {
                let n = 2;
                while (taken.has(`${base}-${n}`)) n++;
                candidate = `${base}-${n}`;
            }

            taken.add(candidate);
            updates.push({ _id: dup._id, name: dup.name, from: dup.slug, to: candidate });
            console.log(`    -> "${dup.name}" (${dup._id}): "${dup.slug}" => "${candidate}"`);
        }
    }

    console.log(`\n${updates.length} league(s) need a slug reassignment.`);

    if (APPLY) {
        for (const u of updates) {
            await db.collection("leagues").updateOne({ _id: u._id }, { $set: { slug: u.to } });
        }
        console.log(`Applied ${updates.length} update(s).`);
    } else {
        console.log("Dry run only — re-run with --apply to write these changes.");
    }

    await mongoose.disconnect();
    console.log("\nDone.");
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
