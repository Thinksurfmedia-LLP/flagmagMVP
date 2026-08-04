import mongoose from "mongoose";
import dbConnect from "../lib/dbConnect.js";
import Game from "../models/Game.js";
import Play from "../models/Play.js";

const games = [
  { date: "2026-02-08", teamA: "Hit N Run", teamB: "Chozen 1nez", league: "CASH COUNTIES XXIII" },
  { date: "2026-02-08", teamA: "Mambas", teamB: "X Men", league: "CASH COUNTIES XXIII" },
  { date: "2026-02-08", teamA: "Suspects", teamB: "ProJanky", league: "CASH COUNTIES XXIII" },
  { date: "2026-02-08", teamA: "BringIt", teamB: "DARKSIDE", league: "CASH COUNTIES XXIII" },
  { date: "2026-06-14", teamA: "The Shield", teamB: "Paper Boyz", league: "Irvine" },
  { date: "2026-06-14", teamA: "I Am Success", teamB: "The Shield", league: "Irvine" },
];

async function fixGameScores() {
  try {
    await dbConnect();

    for (const gameInfo of games) {
      console.log(`\nProcessing: ${gameInfo.teamA} vs ${gameInfo.teamB}`);

      // Find the game
      const game = await Game.findOne({
        "teamA.name": gameInfo.teamA,
        "teamB.name": gameInfo.teamB,
      }).lean();

      if (!game) {
        console.log(`  ❌ Game not found`);
        continue;
      }

      console.log(`  Found game ID: ${game._id}`);

      // Get all plays for this game
      const plays = await Play.find({ game: game._id }).lean();
      console.log(`  Found ${plays.length} plays`);

      // Calculate scores from plays
      let scoreA = 0;
      let scoreB = 0;

      plays.forEach((play) => {
        const pts = Number(play.ptsAdded) || 0;
        if (pts > 0) {
          if (play.targetTeam === "A") {
            scoreA += pts;
          } else if (play.targetTeam === "B") {
            scoreB += pts;
          }
        }
      });

      console.log(`  Calculated score: ${scoreA} - ${scoreB}`);
      console.log(`  Current score: ${game.teamA?.score ?? 0} - ${game.teamB?.score ?? 0}`);

      // Update the game with correct scores
      if (scoreA !== (game.teamA?.score ?? 0) || scoreB !== (game.teamB?.score ?? 0)) {
        await Game.findByIdAndUpdate(
          game._id,
          {
            $set: {
              "teamA.score": scoreA,
              "teamB.score": scoreB,
            },
          },
          { new: true }
        );
        console.log(`  ✅ Updated to ${scoreA} - ${scoreB}`);
      } else {
        console.log(`  ℹ️  Scores already correct`);
      }
    }

    console.log("\n✅ All games processed");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixGameScores();
