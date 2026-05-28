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

const WEEK = process.env.WEEK || "1";
const dates = {
    "1": ["2026-04-04", "2026-04-04"],
    "2": ["2026-04-11", "2026-04-11"],
    "3": ["2026-04-18", "2026-04-18"],
    "4": ["2026-04-25", "2026-04-25"],
    "5": ["2026-05-02", "2026-05-02"],
    "6": ["2026-05-08", "2026-05-09"],
    "7": ["2026-05-16", "2026-05-16"],
    "8": ["2026-05-23", "2026-05-23"],
};
const [from, to] = dates[WEEK] || dates["1"];
const start = new Date(`${from}T00:00:00Z`);
const end   = new Date(`${to}T23:59:59Z`);
const games = await Game.find({ date: { $gte: start, $lte: end }, status: "completed" }).lean();

console.log(`\nWeek ${WEEK} (${from}) completed games: ${games.length}\n`);
console.log("  " + "ID".padEnd(28) + "teamA".padEnd(32) + "scoreA".padEnd(10) + "teamB".padEnd(32) + "scoreB");
console.log("  " + "-".repeat(105));
for (const g of games) {
    console.log(`  ${String(g._id).padEnd(28)} ${(g.teamA?.name || "?").padEnd(32)} ${String(g.teamA?.score ?? "null").padEnd(10)} ${(g.teamB?.name || "?").padEnd(32)} ${g.teamB?.score ?? "null"}`);
}

await mongoose.disconnect();
