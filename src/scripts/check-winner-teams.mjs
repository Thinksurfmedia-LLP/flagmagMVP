import mongoose from "mongoose";
import dbConnect from "../lib/dbConnect.js";

await dbConnect();

const ids = ["6ab08dbe1b308e0706b0e97e", "6aace513ebc3b9826b7d36d5"];
for (const id of ids) {
  const t = await mongoose.connection.collection("teams").findOne({ _id: new mongoose.Types.ObjectId(id) });
  console.log(id, "->", t ? { name: t.name, isPlaceholder: t.isPlaceholder, leagues: t.leagues, players: (t.players||[]).length } : "NOT FOUND");
}

process.exit(0);
