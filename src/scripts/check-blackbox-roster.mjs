import mongoose from "mongoose";
import dbConnect from "../lib/dbConnect.js";
import Game from "../models/Game.js";
import Play from "../models/Play.js";
import Team from "../models/Team.js";
import Player from "../models/Player.js";

await dbConnect();

const game = await Game.findById("6a61606e7ee043b81e72ecb7").lean();
console.log("Game:", game.teamA?.name, "vs", game.teamB?.name, "-", game.teamA?.score, "-", game.teamB?.score);

const plays = await Play.find({ game: game._id }).sort({ createdAt: 1 }).lean();

// Offense (passer/receiver/rusher) belongs to activeTeam.
// Defense (defender) belongs to the OTHER team — they made the stop/interception.
const offenseB = new Set();
const defenseWhileBOnOffense = new Set(); // opponent (A) defenders recorded during B's offensive plays

for (const p of plays) {
  if (p.activeTeam === "B") {
    [p.passer, p.receiver, p.rusher].forEach((j) => { if (j) offenseB.add(String(j).trim()); });
    if (p.defender) defenseWhileBOnOffense.add(String(p.defender).trim());
  }
}

console.log("\nTBD - D1 Championship (teamB) OFFENSE jersey numbers (passer/receiver/rusher):");
console.log([...offenseB].sort((a, b) => Number(a) - Number(b)));

console.log("\nOpponent (BringIt) defender jersey numbers seen breaking up teamB's plays (NOT TBD-D1's own players):");
console.log([...defenseWhileBOnOffense].sort((a, b) => Number(a) - Number(b)));

const team = await Team.findOne({ name: "Black Box" }).populate("players.player").lean();
const roster = (team.players || []).map((p) => ({
  jerseyNumber: p.jerseyNumber,
  playerName: p.player ? p.player.name || "(no name)" : "(no player linked)",
}));
roster.sort((a, b) => a.jerseyNumber - b.jerseyNumber);
console.log("\nBlack Box roster:");
console.log(roster);

const rosterNumbers = new Set(roster.map((r) => String(r.jerseyNumber)));
const missing = [...offenseB].filter((j) => !rosterNumbers.has(j));
console.log("\nOffense jersey#s used in TBD-D1 plays but NOT on Black Box roster:");
console.log(missing.length ? missing : "None — all match");

// Show exact plays referencing each missing jersey for context
if (missing.length) {
  console.log("\nPlays referencing missing jersey numbers:");
  for (const j of missing) {
    const hits = plays.filter(
      (p) => p.activeTeam === "B" && [p.passer, p.receiver, p.rusher].map(String).includes(j)
    );
    console.log(`  #${j}:`, hits.map((h) => `${h.type} (${h.half}) yds:${h.yards} pts:${h.points || "-"}`));
  }
}

process.exit(0);
