/**
 * Diagnostic: compare three score calculation methods against known-correct values.
 *
 * Method A: activeTeam + safety  (current — proved unreliable)
 * Method B: teamName matching against game.teamA.name / teamB.name
 *
 * Runs DRY-RUN only, prints a comparison table.
 * Usage: node scripts/diagnose-score-methods.mjs
 */

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

await mongoose.connect(process.env.MONGODB_URI);

const GameSchema = new mongoose.Schema(
    { teamA: { name: String, logo: String, score: Number }, teamB: { name: String, logo: String, score: Number }, status: String, date: Date },
    { strict: false, timestamps: true }
);
const PlaySchema = new mongoose.Schema(
    { game: mongoose.Schema.Types.ObjectId, activeTeam: String, teamName: String, ptsAdded: { type: Number, default: 0 }, safety: { type: Boolean, default: false } },
    { timestamps: true }
);

const Game = mongoose.model("Game", GameSchema);
const Play = mongoose.model("Play", PlaySchema);

// ─── Known-correct scores from zortssports.com ───────────────────────────────
// Format: { gameId, label, correctA, correctB }
const KNOWN = [
    // April 4 (Week 1)
    { id: "69d0bd9b80313eff138f781e", label: "Roughriders 8u vs Golden Eagles 8u",   cA: 31, cB: 0  },
    { id: "69d0bd9c80313eff138f7821", label: "Powerhouse 12u vs Hawkeyes 12u",        cA: 19, cB: 27 },
    { id: "69d0bd9c80313eff138f7824", label: "Lil Rascals 8u vs Nightcrawlers 8u",    cA:  8, cB: 19 },
    { id: "69d0bd9d80313eff138f782a", label: "Hot Shotz 8u vs Nightcrawlers 8u",      cA:  6, cB: 28 },
    { id: "69d0bd9e80313eff138f7836", label: "Gridiron Goons 10u vs Pick 6 Mafia",    cA: 28, cB: 26 },
    { id: "69d0bd9e80313eff138f783c", label: "Mayhem 10u vs Scallywags 10u",          cA:  0, cB: 32 },
    { id: "69d0bd9f80313eff138f783f", label: "Powerhouse 14u vs Zombies 14u",         cA: 25, cB: 16 },
    { id: "69d0bd9f80313eff138f7842", label: "Renegades 10u vs Pick 6 Mafia 10u",     cA: 32, cB:  0 },
    { id: "69d0bd9f80313eff138f7845", label: "Bolts 14u vs Zombies 14u",              cA:  6, cB: 36 },
    // April 11 (Week 2) — from screenshot
    { id: "69d0bda080313eff138f784b", label: "Nightcrawlers 8u vs Blue Heat 8u",      cA: 26, cB: 19 },
    { id: "69d0bda080313eff138f784e", label: "Cardinals 12u vs Crimson Eclipse 12u",  cA: 20, cB:  7 },
    { id: "69d0bda080313eff138f7851", label: "Roughriders 8u vs Lil Rascals 8u",      cA: 33, cB:  0 },
    { id: "69d0bda180313eff138f7854", label: "Hawkeyes 12u vs Crimson Eclipse 12u",   cA: 14, cB: 27 },
    { id: "69d0bda280313eff138f785d", label: "Golden Eagles 8u vs Hot Shotz 8u",      cA:  7, cB:  6 },
];

const gameIds = KNOWN.map(k => new mongoose.Types.ObjectId(k.id));

// Load games
const games = await Game.find({ _id: { $in: gameIds } }).lean();
const gameMap = Object.fromEntries(games.map(g => [String(g._id), g]));

// ─── Method A: activeTeam + safety ───────────────────────────────────────────
const aggA = await Play.aggregate([
    { $match: { game: { $in: gameIds }, ptsAdded: { $gt: 0 } } },
    { $project: { game: 1, ptsAdded: 1,
        scoringTeam: { $cond: { if: "$safety",
            then: { $cond: { if: { $eq: ["$activeTeam", "A"] }, then: "B", else: "A" } },
            else: "$activeTeam" } } } },
    { $group: { _id: { game: "$game", team: "$scoringTeam" }, total: { $sum: "$ptsAdded" } } }
]);
const mapA = new Map();
for (const { _id, total } of aggA) {
    const k = String(_id.game);
    if (!mapA.has(k)) mapA.set(k, { A: 0, B: 0 });
    mapA.get(k)[_id.team] = total;
}

// ─── Method B: teamName matching ─────────────────────────────────────────────
const aggB = await Play.aggregate([
    { $match: { game: { $in: gameIds }, ptsAdded: { $gt: 0 } } },
    { $group: { _id: { game: "$game", teamName: "$teamName" }, total: { $sum: "$ptsAdded" } } }
]);
const mapB = new Map();
for (const { _id, total } of aggB) {
    const k   = String(_id.game);
    const g   = gameMap[k];
    if (!g) continue;
    if (!mapB.has(k)) mapB.set(k, { A: 0, B: 0 });
    if (_id.teamName === g.teamA?.name)      mapB.get(k).A = total;
    else if (_id.teamName === g.teamB?.name) mapB.get(k).B = total;
}

// ─── Print comparison table ───────────────────────────────────────────────────
const W = (s, n) => String(s ?? "?").padEnd(n);
const score = (m, k) => { const s = m?.get(k); return s ? `${s.A}-${s.B}` : "NO DATA"; };

console.log("\n" + "=".repeat(100));
console.log(W("Game", 44) + W("Correct", 10) + W("DB now", 10) + W("Calc(A)activeTeam", 20) + "Calc(B)teamName");
console.log("=".repeat(100));

let matchDB = 0, matchA = 0, matchB = 0;
for (const ref of KNOWN) {
    const g     = gameMap[ref.id];
    if (!g) { console.log(`  NOT FOUND: ${ref.id}`); continue; }
    const dbStr = `${g.teamA?.score ?? "null"}-${g.teamB?.score ?? "null"}`;
    const corr  = `${ref.cA}-${ref.cB}`;
    const mA    = mapA.get(ref.id);
    const mB    = mapB.get(ref.id);
    const calcA = mA ? `${mA.A}-${mA.B}` : "NO DATA";
    const calcB = mB ? `${mB.A}-${mB.B}` : "NO DATA";

    const dbOk = (g.teamA?.score === ref.cA && g.teamB?.score === ref.cB);
    const aOk  = (mA?.A === ref.cA && mA?.B === ref.cB);
    const bOk  = (mB?.A === ref.cA && mB?.B === ref.cB);
    if (dbOk) matchDB++;
    if (aOk)  matchA++;
    if (bOk)  matchB++;

    console.log(
        W(ref.label, 44) +
        W(corr + (dbOk ? " ✓" : ""), 10) +
        W(dbStr + (dbOk ? " ✓" : " ✗"), 10) +
        W(calcA + (aOk ? " ✓" : " ✗"), 20) +
        calcB + (bOk ? " ✓" : " ✗")
    );
}

console.log("=".repeat(100));
console.log(`\nAccuracy on ${KNOWN.length} verified games:`);
console.log(`  DB scores:            ${matchDB}/${KNOWN.length}`);
console.log(`  Method A (activeTeam): ${matchA}/${KNOWN.length}`);
console.log(`  Method B (teamName):   ${matchB}/${KNOWN.length}`);

await mongoose.disconnect();
