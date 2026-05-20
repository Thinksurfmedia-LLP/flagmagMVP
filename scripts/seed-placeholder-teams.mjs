/**
 * Migration script: seed placeholder teams (TBD, Winner, Loser) for every
 * existing organization that doesn't already have them.
 *
 * Usage: node scripts/seed-placeholder-teams.mjs
 */

import fs from "fs";
import mongoose from "mongoose";

// Read MONGODB_URI from .env.local or .env
const envFile = fs.existsSync(".env.local") ? ".env.local" : ".env";
const lines = fs.readFileSync(envFile, "utf8").split("\n");
const uri = lines.find((l) => l.startsWith("MONGODB_URI")).split("=").slice(1).join("=").trim();

await mongoose.connect(uri);
console.log("Connected to MongoDB");

const PLACEHOLDER_NAMES = ["TBD", "Winner", "Loser"];

const TeamSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        logo: { type: String, default: "" },
        description: { type: String, default: "" },
        division: { type: String, default: "" },
        location: { type: mongoose.Schema.Types.Mixed, default: {} },
        coachName: { type: String, default: "" },
        coachPhone: { type: String, default: "" },
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
        season: { type: mongoose.Schema.Types.ObjectId, ref: "Season", default: null },
        league: { type: mongoose.Schema.Types.ObjectId, ref: "League", default: null },
        players: { type: Array, default: [] },
        isPlaceholder: { type: Boolean, default: false },
    },
    { timestamps: true }
);
TeamSchema.index({ organization: 1, name: 1 }, { unique: true });

const Team = mongoose.models.Team || mongoose.model("Team", TeamSchema);

const orgs = await mongoose.connection.db.collection("organizations").find({}).project({ _id: 1, name: 1 }).toArray();
console.log(`Found ${orgs.length} organization(s)`);

let created = 0;
let skipped = 0;

for (const org of orgs) {
    const ops = PLACEHOLDER_NAMES.map((name) => ({
        updateOne: {
            filter: { organization: org._id, name },
            update: {
                $setOnInsert: {
                    name,
                    organization: org._id,
                    isPlaceholder: true,
                    logo: "",
                    description: "",
                    division: "",
                    coachName: "",
                    coachPhone: "",
                    location: {},
                    season: null,
                    league: null,
                    players: [],
                },
            },
            upsert: true,
        },
    }));

    const result = await Team.bulkWrite(ops);
    const orgCreated = result.upsertedCount || 0;
    const orgSkipped = PLACEHOLDER_NAMES.length - orgCreated;

    created += orgCreated;
    skipped += orgSkipped;

    if (orgCreated > 0) {
        console.log(`  [${org.name}] Created ${orgCreated} placeholder team(s)`);
    } else {
        console.log(`  [${org.name}] Already up-to-date`);
    }
}

console.log(`\nDone. Created ${created} placeholder team(s), skipped ${skipped} (already existed).`);
await mongoose.disconnect();
