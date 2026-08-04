import mongoose from "mongoose";
import dbConnect from "../lib/dbConnect.js";
import Team from "../models/Team.js";

await dbConnect();

const names = ["TBD - D1 Championship", "TBD - D2 Championship A", "TBD - D2 Championship B"];

for (const name of names) {
  const team = await Team.findOne({ name }).lean();
  if (!team) {
    console.log(`"${name}" -> NOT FOUND as Team doc`);
    continue;
  }
  console.log(JSON.stringify({
    name: team.name,
    isPlaceholder: team.isPlaceholder,
    playerCount: team.players?.length || 0,
    players: team.players,
  }, null, 2));
}
process.exit(0);
