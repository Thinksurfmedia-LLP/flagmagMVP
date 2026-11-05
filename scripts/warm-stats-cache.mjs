// Fill the persisted league stats cache (the `statscaches` collection, see
// statsAggregation.js) for every league of an organization, so no visitor
// waits for a cold compute — each one pulls a league's raw plays / imported
// stat lines over the Atlas link, which takes 10s+ for the busiest leagues.
// Re-run after bumping STATS_CACHE_VERSION.
//
//   node --import ./scripts/lib/alias-loader.mjs scripts/warm-stats-cache.mjs [--org xflagfootball]

import mongoose from "mongoose";
import Organization from "@/models/Organization";
import League from "@/models/League";
import { computeSeasonStats } from "@/lib/statsAggregation";
import { loadEnv } from "./legacy/common.mjs";

// Leagues computed at once — enough to overlap round trips without
// saturating the (bandwidth-bound) Atlas link.
const CONCURRENCY = 3;
// computeSeasonStats saves in the background; give the last saves time to land.
const SAVE_GRACE_MS = 5000;

async function main() {
    const argv = process.argv.slice(2);
    const slug = argv.includes("--org") ? argv[argv.indexOf("--org") + 1] : "xflagfootball";
    loadEnv();
    await mongoose.connect(process.env.MONGODB_URI);

    const org = await Organization.findOne({ slug }).select("_id").lean();
    if (!org) throw new Error(`Organization ${slug} not found`);
    const leagues = await League.find({ organization: org._id }).select("_id name").lean();
    console.log(`Warming ${leagues.length} league(s) of ${slug}…`);

    const queue = [...leagues];
    let done = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length) {
            const league = queue.shift();
            const started = Date.now();
            try {
                await computeSeasonStats(league._id, org._id);
                console.log(`[${++done}/${leagues.length}] ${league.name}: ${Date.now() - started}ms`);
            } catch (error) {
                console.error(`[${++done}/${leagues.length}] ${league.name}: FAILED`, error.message);
            }
        }
    }));

    await new Promise((r) => setTimeout(r, SAVE_GRACE_MS));
    const saved = await mongoose.connection.db.collection("statscaches").countDocuments();
    console.log(`Done. statscaches now holds ${saved} entr${saved === 1 ? "y" : "ies"}.`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
