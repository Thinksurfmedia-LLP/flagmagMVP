import mongoose from "mongoose";
import dbConnect from "../lib/dbConnect.js";
import Game from "../models/Game.js";
import Play from "../models/Play.js";

await dbConnect();

const games = await Game.find({
  $or: [
    { "teamA.name": { $regex: "TBD", $options: "i" } },
    { "teamB.name": { $regex: "TBD", $options: "i" } },
    { "teamA.name": { $regex: "BringIt", $options: "i" } },
    { "teamB.name": { $regex: "BringIt", $options: "i" } },
  ],
}).lean();

for (const g of games) {
  const plays = await Play.countDocuments({ game: g._id });
  console.log(JSON.stringify({
    id: g._id.toString(),
    date: g.date,
    league: g.league,
    teamA: g.teamA?.name,
    teamB: g.teamB?.name,
    scoreA: g.teamA?.score,
    scoreB: g.teamB?.score,
    status: g.status,
    playCount: plays,
  }, null, 2));
}
process.exit(0);
