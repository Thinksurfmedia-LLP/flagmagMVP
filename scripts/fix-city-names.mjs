import fs from "fs";
import mongoose from "mongoose";

const lines = fs.readFileSync(".env.local", "utf8").split("\n");
const uri = lines.find(l => l.startsWith("MONGODB_URI")).split("=").slice(1).join("=");

await mongoose.connect(uri);
const col = mongoose.connection.db.collection("organizations");
const orgs = await col.find({}).toArray();
let fixed = 0;

for (const org of orgs) {
    let changed = false;
    const locs = (org.locations || []).map(l => {
        if (!l.cityName && l.locationName && l.locationName.includes(",")) {
            changed = true;
            return { ...l, cityName: l.locationName.split(",")[0].trim() };
        }
        return l;
    });
    if (changed) {
        await col.updateOne({ _id: org._id }, { $set: { locations: locs } });
        fixed++;
        console.log("Fixed:", org.name);
    }
}

console.log("Done. Fixed", fixed, "orgs");
await mongoose.disconnect();
