import mongoose from "mongoose";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const uriLine = envText.split("\n").find(l => l.startsWith("MONGODB_URI="));
const uri = uriLine.slice("MONGODB_URI=".length).trim();
await mongoose.connect(uri);

const Team = mongoose.connection.collection("teams");
const teamId = new mongoose.Types.ObjectId("69cfb47856bab89431e144bb");
const playerId = new mongoose.Types.ObjectId("69cf35db268fc7ba310d2a4d");

const action = process.argv[2];
if (action === "remove") {
  const res = await Team.updateOne({ _id: teamId }, { $pull: { players: { player: playerId } } });
  console.log("removed:", JSON.stringify(res));
} else if (action === "restore") {
  const res = await Team.updateOne({ _id: teamId }, { $push: { players: { player: playerId, jerseyNumber: 1, active: true, _id: new mongoose.Types.ObjectId("69f9007de7729de62249a944") } } });
  console.log("restored:", JSON.stringify(res));
} else if (action === "check") {
  const team = await Team.findOne({ _id: teamId });
  const entry = team.players.find(p => String(p.player) === String(playerId));
  console.log("current entry:", JSON.stringify(entry));
}
await mongoose.disconnect();
