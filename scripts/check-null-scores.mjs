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

const Game = mongoose.model("Game", new mongoose.Schema(
    { teamA: { name: String, score: Number }, teamB: { name: String, score: Number }, status: String, date: Date },
    { strict: false, timestamps: true }
));

const nullGames = await Game.find({
    status: "completed",
    $or: [{ "teamA.score": null }, { "teamB.score": null }]
}).sort({ date: 1 }).lean();

console.log(`\nCompleted games with null scores: ${nullGames.length}`);
for (const g of nullGames) {
    console.log(`  [${g._id}]  ${g.teamA?.name} (${g.teamA?.score ?? "NULL"}) vs ${g.teamB?.name} (${g.teamB?.score ?? "NULL"})  [${g.date?.toISOString().slice(0,10)}]`);
}

const allCompleted = await Game.countDocuments({ status: "completed" });
const allGames     = await Game.countDocuments({});
const nullAny      = await Game.countDocuments({ $or: [{ "teamA.score": null }, { "teamB.score": null }] });

console.log(`\nTotal games: ${allGames}  |  Completed: ${allCompleted}  |  Any-status with null score: ${nullAny}`);
await mongoose.disconnect();
