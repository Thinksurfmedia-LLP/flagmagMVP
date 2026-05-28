import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

const lines = readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n");
for (const line of lines) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
    if (m) { const k = m[1], v = m[2].replace(/^["']|["']$/g, ""); if (!process.env[k]) process.env[k] = v; }
}
await mongoose.connect(process.env.MONGODB_URI);

const Game = mongoose.model("Game", new mongoose.Schema(
    { teamA: { name: String, score: Number }, teamB: { name: String, score: Number }, status: String, date: Date },
    { strict: false }
));

// Week 2 = April 11
const start = new Date("2026-04-11T00:00:00Z");
const end   = new Date("2026-04-11T23:59:59Z");
const games = await Game.find({ date: { $gte: start, $lte: end }, status: "completed" }).lean();

console.log(`Week 2 (Apr 11) completed games: ${games.length}\n`);
for (const g of games) {
    console.log(`  ${String(g._id)}  ${g.teamA?.name} ${g.teamA?.score} vs ${g.teamB?.name} ${g.teamB?.score}`);
}

await mongoose.disconnect();
