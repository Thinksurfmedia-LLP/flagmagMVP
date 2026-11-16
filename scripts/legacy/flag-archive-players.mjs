// Mark every player the legacy imports created (and that has no login) as
// Player.legacyArchive, so they're listed under Admin → Archive Players
// instead of Free Agents. Imports from now on set the flag themselves
// (import-season.mjs); this backfills the players imported before that.
//
// Only adds/clears one boolean — no stats, rosters or names are touched.
//
//   node --import ./scripts/lib/alias-loader.mjs scripts/legacy/flag-archive-players.mjs            # dry run
//   node --import ./scripts/lib/alias-loader.mjs scripts/legacy/flag-archive-players.mjs --apply
//   node --import ./scripts/lib/alias-loader.mjs scripts/legacy/flag-archive-players.mjs --undo     # clear the flag again

import mongoose from "mongoose";
import Player from "@/models/Player";
import { loadEnv, REGISTRY } from "./common.mjs";
import { isStandInName } from "@/lib/playerMergePlan";

const BATCH_SIZE = 5000;

async function candidateIds(db) {
    const rows = await db.collection(REGISTRY)
        .find({ entity: "player", created: true }, { projection: { docId: 1 } })
        .toArray();
    // A registry row can point at a real player after "Merge Player Records"
    // moved an imported record into them — never archive a merge target.
    const targets = new Set((await db.collection("playermerges").distinct("target", { undone: false })).map(String));
    return [...new Set(rows.map((r) => String(r.docId)))].filter((id) => !targets.has(id));
}

async function main() {
    const apply = process.argv.includes("--apply");
    const undo = process.argv.includes("--undo");
    loadEnv();
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    if (undo) {
        const filter = { legacyArchive: true };
        const count = await Player.countDocuments(filter);
        console.log(`${count} players flagged as archive.`);
        if (apply || process.argv.includes("--yes")) {
            const res = await Player.updateMany(filter, { $set: { legacyArchive: false } }, { timestamps: false });
            console.log(`Cleared the flag on ${res.modifiedCount} players.`);
        } else {
            console.log("Dry run — add --yes to clear it.");
        }
        await mongoose.disconnect();
        return;
    }

    const ids = (await candidateIds(db)).map((id) => new mongoose.Types.ObjectId(id));
    const players = await Player.find({ _id: { $in: ids }, user: null, legacyArchive: { $ne: true } })
        .select("name status").lean();
    const summary = { importedPlayers: ids.length, toFlag: players.length, freeAgents: 0, onRosters: 0, jerseyOnly: 0, named: 0 };
    for (const p of players) {
        if (p.status === "free_agent") summary.freeAgents++;
        else summary.onRosters++;
        if (isStandInName(p.name)) summary.jerseyOnly++;
        else summary.named++;
    }
    console.log(summary);
    console.log(`Free Agents would drop by ${summary.freeAgents}; players on a current roster stay on the Players page.`);

    if (!apply) {
        console.log("Dry run — nothing changed. Re-run with --apply.");
        await mongoose.disconnect();
        return;
    }

    let flagged = 0;
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
        const batch = players.slice(i, i + BATCH_SIZE).map((p) => p._id);
        // timestamps: false — a bookkeeping flag, not an edit to the player.
        const res = await Player.updateMany(
            { _id: { $in: batch }, user: null },
            { $set: { legacyArchive: true } },
            { timestamps: false }
        );
        flagged += res.modifiedCount;
        console.log(`  ${Math.min(i + BATCH_SIZE, players.length)}/${players.length}`);
    }
    console.log(`Flagged ${flagged} players as archive.`);
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
