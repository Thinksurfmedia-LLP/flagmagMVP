/**
 * Fix all known-wrong game scores.
 * Correct values verified against zortssports.com game results and backup analysis.
 *
 * -- April 4 (Week 1) --
 * Mayhem 10u vs Scallywags 10u:       NULL - 32  →   0 - 32   (null filled in)
 * Hot Shotz 8u vs Blue Heat 8u:         12 - 13  →  12 - 19   (backup had wrong value)
 * Renegades 10u vs Pick 6 Mafia 10u:    25 -  0  →  32 -  0   (backup had wrong value)
 *
 * -- April 11 (Week 2) --
 * Nightcrawlers 8u vs Blue Heat 8u:     26 - 20  →  26 - 19   (1 pt off on Blue Heat)
 * Roughriders 8u vs Lil Rascals 8u:     39 -  0  →  33 -  0   (1 TD extra on Roughriders)
 * Hawkeyes 12u vs Scallywags 12u:        8 - 39  →  14 - 39   (1 TD short on Hawkeyes)
 * Golden Eagles 8u vs Lil Rascals 8u:   20 - 21  →  14 - 20   (both wrong)
 * Zombies 14u vs Bolts 14u:             24 - 37  →  24 - 43   (Bolts missing 1 TD)
 *
 * -- April 18 (Week 3) --
 * Blue Heat 8u vs Roughriders 8u:       14 - 39  →  12 - 41   (both wrong)
 * Pick 6 Mafia 10u vs Scallywags 10u:   18 - 32  →  12 - 38   (both wrong)
 * Powerhouse 12u vs Cardinals 12u:      33 - 35  →  34 - 35   (Powerhouse 1 pt short)
 *
 * -- April 25 (Week 4) --
 * Renegades 10u vs Scallywags 10u:       13 - 14  →   7 - 14   (Renegades 1 TD extra)
 *
 * -- May 8-9 (Week 6) --
 * Bone Collectors 14u vs Bolts 14u:      45 - 32  →  46 - 32   (Bone Collectors 1 pt short)
 * Blue Heat 8u vs Hot Shotz 8u:           8 - 24  →  14 - 24   (Blue Heat 1 TD short)
 *
 * Usage:
 *   DRY_RUN=1 node scripts/fix-two-incorrect-scores.mjs
 *   node scripts/fix-two-incorrect-scores.mjs
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
    const lines = readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n");
    for (const line of lines) {
        const match = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
        if (match) {
            const key = match[1];
            const val = match[2].replace(/^["']|["']$/g, "");
            if (!process.env[key]) process.env[key] = val;
        }
    }
} catch { /* no .env */ }

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/flagmag";
const DRY_RUN    = process.env.DRY_RUN === "1";

const fixes = [
    // ── April 4 (Week 1) ─────────────────────────────────────────────────────
    {
        _id:   "69d0bd9e80313eff138f783c",
        label: "Mayhem 10u vs Scallywags 10u",
        teamA: { score: 0 },   // was NULL — confirmed 0-32 via zortssports
        teamB: { score: 32 },
    },
    {
        _id:   "69d0bd9d80313eff138f7830",
        label: "Hot Shotz 8u vs Blue Heat 8u",
        teamA: { score: 12 },
        teamB: { score: 19 },  // backup had 13, correct is 19 per zortssports
    },
    {
        _id:   "69d0bd9f80313eff138f7842",
        label: "Renegades 10u vs Pick 6 Mafia 10u",
        teamA: { score: 32 },  // backup had 25, correct is 32 per zortssports
        teamB: { score: 0 },
    },
    // ── April 11 (Week 2) ────────────────────────────────────────────────────
    {
        _id:   "69d0bda080313eff138f784b",
        label: "Nightcrawlers 8u vs Blue Heat 8u",
        teamA: { score: 26 },
        teamB: { score: 19 },  // DB had 20, correct is 19 per zortssports
    },
    {
        _id:   "69d0bda080313eff138f7851",
        label: "Roughriders 8u vs Lil Rascals 8u",
        teamA: { score: 33 },  // DB had 39 (1 extra TD), correct is 33 per zortssports
        teamB: { score: 0 },
    },
    {
        _id:   "69d0bda180313eff138f785a",
        label: "Hawkeyes 12u vs Scallywags 12u",
        teamA: { score: 14 },  // DB had 8, correct is 14 per zortssports
        teamB: { score: 39 },
    },
    {
        _id:   "69d0bda180313eff138f7857",
        label: "Golden Eagles 8u vs Lil Rascals 8u",
        teamA: { score: 14 },  // DB had 20, correct is 14 per zortssports
        teamB: { score: 20 },  // DB had 21, correct is 20 per zortssports
    },
    {
        _id:   "69d0bda380313eff138f7869",
        label: "Zombies 14u vs Bolts 14u",
        teamA: { score: 24 },
        teamB: { score: 43 },  // DB had 37, correct is 43 per zortssports (missing 1 TD)
    },
    // ── April 18 (Week 3) ────────────────────────────────────────────────────
    {
        _id:   "69d0bda580313eff138f787e",
        label: "Blue Heat 8u vs Roughriders 8u",
        teamA: { score: 12 },  // DB had 14
        teamB: { score: 41 },  // DB had 39
    },
    {
        _id:   "69d0bda580313eff138f7884",
        label: "Pick 6 Mafia 10u vs Scallywags 10u",
        teamA: { score: 12 },  // DB had 18
        teamB: { score: 38 },  // DB had 32
    },
    {
        _id:   "69d0bda680313eff138f7887",
        label: "Powerhouse 12u vs Cardinals 12u",
        teamA: { score: 34 },  // DB had 33
        teamB: { score: 35 },
    },
    // ── April 25 (Week 4) ────────────────────────────────────────────────────
    {
        _id:   "69d0bdaa80313eff138f78b1",
        label: "Renegades 10u vs Scallywags 10u",
        teamA: { score: 7 },   // DB had 13 (1 TD extra)
        teamB: { score: 14 },
    },
    // ── May 8-9 (Week 6) ─────────────────────────────────────────────────────
    {
        _id:   "69fe868e0817e06c03656869",
        label: "Bone Collectors 14u vs Bolts 14u",
        teamA: { score: 46 },  // DB had 45 (1 pt short)
        teamB: { score: 32 },
    },
    {
        _id:   "69de1c28b2b80b2f1f375f89",
        label: "Blue Heat 8u vs Hot Shotz 8u",
        teamA: { score: 14 },  // DB had 8 (1 TD short)
        teamB: { score: 24 },
    },
];

const GameSchema = new mongoose.Schema({
    teamA: { name: String, logo: String, score: Number },
    teamB: { name: String, logo: String, score: Number },
}, { strict: false, timestamps: true });

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.\n");

    const Game = mongoose.model("Game", GameSchema);

    for (const fix of fixes) {
        const game = await Game.findById(fix._id).lean();
        if (!game) {
            console.log(`  NOT FOUND: ${fix.label} (${fix._id})`);
            continue;
        }
        console.log(
            `  ${fix.label}`
            + `\n    teamA: ${game.teamA?.score} → ${fix.teamA.score}`
            + `\n    teamB: ${game.teamB?.score} → ${fix.teamB.score}`
            + (DRY_RUN ? "  [dry run]" : "")
        );
        if (!DRY_RUN) {
            await Game.findByIdAndUpdate(fix._id, {
                "teamA.score": fix.teamA.score,
                "teamB.score": fix.teamB.score,
            });
        }
    }

    console.log(DRY_RUN ? "\nDry run complete — no changes written." : "\nDone.");
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
