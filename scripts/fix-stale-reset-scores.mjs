// Finds games that are "upcoming" (i.e. were reset via /api/games/[gameId]/reset)
// but still carry a leftover non-zero score from before the stripNullScores bug fix,
// and zeroes them out properly. Run with: node scripts/fix-stale-reset-scores.mjs
// Add --apply to actually write changes; without it, runs as a dry-run report only.
import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
    const lines = readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n");
    for (const line of lines) {
        const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
        if (m) { const k = m[1], v = m[2].replace(/^["']|["']$/g, ""); if (!process.env[k]) process.env[k] = v; }
    }
} catch { /**/ }

const apply = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGODB_URI);

const Game = mongoose.model("Game", new mongoose.Schema({}, { strict: false, timestamps: true }));
const Play = mongoose.model("Play", new mongoose.Schema({}, { strict: false, timestamps: true }));

// Candidates:
//  - games that are "upcoming" (post-reset state) but still have a nonzero
//    score left over, or still carry half-tracking leftovers
//  - games that are "in_progress" with ZERO recorded plays but a nonzero
//    score — i.e. a reset game that was then restarted while still stale
const upcomingCandidates = await Game.find({
    status: "upcoming",
    $or: [
        { "teamA.score": { $nin: [null, 0] } },
        { "teamB.score": { $nin: [null, 0] } },
        { firstHalfCompleted: true },
        { halfOneScoreA: { $nin: [null, 0] } },
        { halfOneScoreB: { $nin: [null, 0] } },
    ],
}).lean();

const inProgressCandidates = await Game.find({
    status: "in_progress",
    $or: [
        { "teamA.score": { $nin: [null, 0] } },
        { "teamB.score": { $nin: [null, 0] } },
    ],
}).lean();

const candidates = [];
for (const g of [...upcomingCandidates, ...inProgressCandidates]) {
    const playCount = await Play.countDocuments({ game: g._id });
    // For in_progress games, only treat as "stale" if there are truly no
    // recorded plays yet — a real in-progress game with plays and a score
    // is legitimate and must NOT be touched.
    if (g.status === "in_progress" && playCount > 0) continue;
    candidates.push({ ...g, playCount });
}

console.log(`Found ${candidates.length} game(s) with leftover stale score/half data:\n`);

for (const g of candidates) {
    console.log(
        `  [${g._id}] status=${g.status} ${g.teamA?.name} (${g.teamA?.score}) vs ${g.teamB?.name} (${g.teamB?.score})` +
        `  firstHalfCompleted=${g.firstHalfCompleted} halfOneScoreA=${g.halfOneScoreA} halfOneScoreB=${g.halfOneScoreB}` +
        `  plays=${g.playCount}`
    );

    if (apply) {
        await Game.findByIdAndUpdate(g._id, {
            $set: {
                "teamA.score": 0,
                "teamB.score": 0,
                currentHalf: "1st",
                firstHalfCompleted: false,
                halfOneScoreA: 0,
                halfOneScoreB: 0,
            },
        });
    }
}

console.log(apply ? "\nDone — stale games corrected." : "\nDry run only. Re-run with --apply to write changes.");
await mongoose.disconnect();
