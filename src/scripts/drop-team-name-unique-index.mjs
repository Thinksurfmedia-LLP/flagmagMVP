// One-off migration: drops the old unique(organization,name) index on Team
// so two unrelated teams (different leagues) can share the same name — see
// TeamSchema in models/Team.js. Mongoose's autoIndex never drops a stale
// index on its own, so this has to run once against the live DB.
import mongoose from "mongoose";
import dbConnect from "../lib/dbConnect.js";
import Team from "../models/Team.js";

await dbConnect();

const indexes = await Team.collection.indexes();
const staleIndex = indexes.find(
  (ix) => ix.unique && ix.key?.organization === 1 && ix.key?.name === 1 && Object.keys(ix.key).length === 2
);

if (!staleIndex) {
  console.log("No stale unique(organization,name) index found — nothing to do.");
} else {
  console.log(`Dropping stale index "${staleIndex.name}"...`);
  await Team.collection.dropIndex(staleIndex.name);
  console.log("Dropped.");
}

// Recreate the (now non-unique) index defined on the schema.
await Team.syncIndexes();
console.log("Indexes synced:", (await Team.collection.indexes()).map((ix) => ix.name));

await mongoose.disconnect();
process.exit(0);
