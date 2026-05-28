/**
 * Migration: Create Schedule records from existing Games
 *
 * Groups all existing Game documents by league and creates one Schedule per
 * league (skipping leagues that already have a Schedule).  Games within each
 * schedule are bucketed into "weeks" by their date.
 *
 * Usage:
 *   node scripts/migrate-games-to-schedules.mjs
 *
 * Dry-run (no writes):
 *   DRY_RUN=1 node scripts/migrate-games-to-schedules.mjs
 *
 * Force re-create schedules for leagues already migrated (fixes date/field):
 *   FORCE=1 node scripts/migrate-games-to-schedules.mjs
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually without requiring dotenv package
try {
    const envPath = resolve(process.cwd(), ".env");
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
        const match = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
        if (match) {
            const key = match[1];
            const val = match[2].replace(/^["']|["']$/g, "");
            if (!process.env[key]) process.env[key] = val;
        }
    }
} catch {
    // .env not found – rely on environment variables already set
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/flagmag";
const DRY_RUN = process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1"; // Set FORCE=1 to re-process leagues that already have a schedule

// ── Inline schemas (avoids Next.js ESM issues) ─────────────────────────────

const GameSchema = new mongoose.Schema(
    {
        league: { type: mongoose.Schema.Types.ObjectId, ref: "League" },
        date: { type: Date },
        time: { type: String, default: "" },
        teamA: {
            name: { type: String },
            logo: { type: String, default: "" },
            score: { type: Number, default: null },
        },
        teamB: {
            name: { type: String },
            logo: { type: String, default: "" },
            score: { type: Number, default: null },
        },
        location: { type: String, default: "" },
        status: { type: String, default: "upcoming" },
        gameType: { type: String, default: "main" },
    },
    { timestamps: true }
);

const LeagueSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    name: { type: String },
    location: { type: String, default: "" },
    season: { type: mongoose.Schema.Types.ObjectId, ref: "Season" },
});

const TeamSchema = new mongoose.Schema({
    name: { type: String },
    league: { type: mongoose.Schema.Types.ObjectId, ref: "League" },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    logo: { type: String, default: "" },
});

const GameDetailsSchema = new mongoose.Schema({
    team1: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    team2: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    field: { type: String, default: "" },
    date: { type: String, default: "" },
    time: { type: String, default: "" },
    gameType: { type: String, default: "main" },
    gameRef: { type: mongoose.Schema.Types.ObjectId, ref: "Game", default: null },
});

const WeekSchema = new mongoose.Schema({
    name: { type: String, required: true },
    games: { type: [GameDetailsSchema], default: [] },
});

const ScheduleSchema = new mongoose.Schema(
    {
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
        scheduleLabel: { type: String, required: true, trim: true },
        leagueId: { type: mongoose.Schema.Types.ObjectId, ref: "League", default: null },
        locationName: { type: String, required: true, trim: true },
        locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", default: null },
        status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
        weeks: { type: [WeekSchema], default: [] },
    },
    { timestamps: true }
);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format a Date → "YYYY-MM-DD" string required by HTML <input type="date">.
 */
function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Extract the field name/number from a location string like
 * "Cottonwood Kids Park - 1"  →  "1"
 * "Cottonwood Kids Park - 2"  →  "2"
 * "Cottonwood Kids Park"       →  ""  (no field suffix)
 */
function extractField(location) {
    if (!location) return "";
    const match = location.match(/\s*-\s*([^-]+)$/);
    return match ? match[1].trim() : "";
}

/**
 * Build a label like "Week of MM/DD/YYYY" for a bucket of games on the same date.
 */
function weekLabel(dateStr, index) {
    return dateStr ? `Week of ${dateStr}` : `Week ${index + 1}`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log(`Connecting to MongoDB…`);
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.\n");

    const Game = mongoose.model("Game", GameSchema);
    const League = mongoose.model("League", LeagueSchema);
    const Team = mongoose.model("Team", TeamSchema);
    const Schedule = mongoose.model("Schedule", ScheduleSchema);

    // 1. Load all games with their league
    const games = await Game.find({}).lean();
    console.log(`Found ${games.length} total games.`);
    if (!games.length) {
        console.log("Nothing to migrate. Exiting.");
        await mongoose.disconnect();
        return;
    }

    // 2. Load leagues already covered by a Schedule so we can skip them
    const existingSchedules = await Schedule.find({}).select("leagueId").lean();
    const coveredLeagueIds = new Set(
        existingSchedules.map((s) => s.leagueId?.toString()).filter(Boolean)
    );
    console.log(`Leagues already covered by a Schedule: ${coveredLeagueIds.size}\n`);

    // 3. Group games by league
    const byLeague = new Map();
    for (const game of games) {
        const key = game.league?.toString();
        if (!key) continue;
        if (!byLeague.has(key)) byLeague.set(key, []);
        byLeague.get(key).push(game);
    }
    console.log(`Distinct leagues in games: ${byLeague.size}`);

    // 4. Build a team lookup map: leagueId → Map<lowerName, team>
    const allTeams = await Team.find({}).lean();
    const teamsByLeague = new Map();
    for (const team of allTeams) {
        const lk = team.league?.toString();
        if (!lk) continue;
        if (!teamsByLeague.has(lk)) teamsByLeague.set(lk, new Map());
        teamsByLeague.get(lk).set(team.name.trim().toLowerCase(), team);
    }

    // 5. For each uncovered league, create a Schedule
    let created = 0;
    let skipped = 0;

    for (const [leagueId, leagueGames] of byLeague) {
        if (coveredLeagueIds.has(leagueId)) {
            if (!FORCE) {
                console.log(`  SKIP league ${leagueId} – schedule already exists. Use FORCE=1 to re-create.`);
                skipped++;
                continue;
            }
            // FORCE mode: delete existing schedule so we can recreate with fixed data
            console.log(`  FORCE mode: deleting existing schedule for league ${leagueId}…`);
            if (!DRY_RUN) {
                await Schedule.deleteMany({ leagueId });
            }
        }

        // Load league doc for metadata
        const league = await League.findById(leagueId).lean();
        if (!league) {
            console.warn(`  WARN league ${leagueId} not found – skipping.`);
            skipped++;
            continue;
        }

        // Derive location name: prefer league location, fall back to first game
        const locationName =
            league.location?.trim() ||
            leagueGames.find((g) => g.location?.trim())?.location?.trim() ||
            "TBD";

        // Group games by date string → weeks
        const byDate = new Map();
        for (const game of leagueGames) {
            const dateStr = formatDate(game.date);
            if (!byDate.has(dateStr)) byDate.set(dateStr, []);
            byDate.get(dateStr).push(game);
        }

        // Sort date buckets chronologically
        const sortedDates = [...byDate.keys()].sort((a, b) => {
            // MM/DD/YYYY → compare as dates
            const toMs = (s) => s ? new Date(s).getTime() : 0;
            return toMs(a) - toMs(b);
        });

        const teamMap = teamsByLeague.get(leagueId) || new Map();

        const weeks = sortedDates.map((dateStr, idx) => {
            const gamesOnDate = byDate.get(dateStr);
            const gameDocs = gamesOnDate.map((game) => {
                const t1Name = game.teamA?.name?.trim().toLowerCase();
                const t2Name = game.teamB?.name?.trim().toLowerCase();
                return {
                    team1: teamMap.get(t1Name)?._id || null,
                    team2: teamMap.get(t2Name)?._id || null,
                    field: extractField(game.location),
                    date: dateStr,
                    time: game.time || "",
                    gameType: game.gameType || "main",
                    gameRef: game._id,
                };
            });
            return {
                name: weekLabel(dateStr, idx),
                games: gameDocs,
            };
        });

        const scheduleDoc = {
            organization: league.organization,
            scheduleLabel: league.name,
            leagueId: league._id,
            locationName,
            status: "Active",
            weeks,
        };

        console.log(
            `  CREATE schedule for league "${league.name}" (${leagueId}):` +
            ` ${weeks.length} week(s), ${leagueGames.length} game(s).`
        );

        if (!DRY_RUN) {
            await Schedule.create(scheduleDoc);
        }
        created++;
    }

    console.log(
        `\nDone. ${DRY_RUN ? "[DRY RUN] Would have created" : "Created"} ${created} schedule(s), skipped ${skipped}.`
    );

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error("Migration failed:", err);
    mongoose.disconnect();
    process.exit(1);
});
