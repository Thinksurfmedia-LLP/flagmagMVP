/**
 * Show detailed play data for specific games to illustrate why
 * play-based score recalculation is unreliable.
 */
import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

const lines = readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n");
for (const line of lines) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
    if (m) { const k = m[1], v = m[2].replace(/^["']|["']$/g, ""); if (!process.env[k]) process.env[k] = v; }
}
await mongoose.connect(process.env.MONGODB_URI);

const Play = mongoose.model("Play", new mongoose.Schema(
    { game: mongoose.Schema.Types.ObjectId, type: String, activeTeam: String, teamName: String,
      ptsAdded: { type: Number, default: 0 }, safety: { type: Boolean, default: false } },
    { strict: false }
));
const Game = mongoose.model("Game", new mongoose.Schema(
    { teamA: { name: String, score: Number }, teamB: { name: String, score: Number }, status: String, date: Date },
    { strict: false }
));

const checks = [
    { id: "69d0bd9b80313eff138f781e", correct: "31-0"  },  // Roughriders vs Golden Eagles
    { id: "69d0bd9e80313eff138f7836", correct: "28-26" },  // Gridiron Goons vs Pick 6 Mafia
    { id: "69d0bda080313eff138f7851", correct: "33-0"  },  // Roughriders vs Lil Rascals (was 39-0)
    { id: "69d0bda080313eff138f784b", correct: "26-19" },  // Nightcrawlers vs Blue Heat (was 26-20)
];

for (const c of checks) {
    const g = await Game.findById(c.id).lean();
    const plays = await Play.find({ game: new mongoose.Types.ObjectId(c.id), ptsAdded: { $gt: 0 } }).lean();
    const sumA = plays.filter(p => p.activeTeam === "A").reduce((s, p) => s + p.ptsAdded, 0);
    const sumB = plays.filter(p => p.activeTeam === "B").reduce((s, p) => s + p.ptsAdded, 0);

    console.log("─".repeat(72));
    console.log(`GAME : ${g?.teamA?.name} ${g?.teamA?.score} vs ${g?.teamB?.name} ${g?.teamB?.score}`);
    console.log(`REAL : ${c.correct}  |  PLAY TOTAL: ${sumA}-${sumB}  (${sumA + sumB} pts total from plays vs ${(+c.correct.split("-")[0]) + (+c.correct.split("-")[1])} real)`);
    console.log(`Plays: ${plays.map(p => `${p.activeTeam}:+${p.ptsAdded}(${p.type})`).join("  ")}`);
}

await mongoose.disconnect();
