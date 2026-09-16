import mongoose from "mongoose";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const uriLine = envText.split("\n").find(l => l.startsWith("MONGODB_URI="));
const uri = uriLine.slice("MONGODB_URI=".length).trim();

await mongoose.connect(uri);

const Play = mongoose.connection.collection("plays");
const Team = mongoose.connection.collection("teams");
const Game = mongoose.connection.collection("games");

// Find a play with a frozen passerPlayer id
const play = await Play.findOne({ passerPlayer: { $ne: null } });
if (!play) { console.log("no play with passerPlayer found"); process.exit(0); }

const game = await Game.findOne({ _id: play.game });
console.log("gameId:", String(play.game));
console.log("play.passer (jersey):", play.passer, "activeTeam:", play.activeTeam);
console.log("passerPlayer id:", String(play.passerPlayer));
console.log("teamA:", game?.teamA?.name, "teamB:", game?.teamB?.name);

const teamName = play.activeTeam === "A" ? game.teamA.name : game.teamB.name;
const team = await Team.findOne({ name: teamName, "players.player": play.passerPlayer });
if (!team) {
  console.log("could not find team doc containing this player under name", teamName);
} else {
  console.log("team _id:", String(team._id), "team name:", team.name);
  const entry = team.players.find(p => String(p.player) === String(play.passerPlayer));
  console.log("roster entry:", JSON.stringify(entry));
}

await mongoose.disconnect();
