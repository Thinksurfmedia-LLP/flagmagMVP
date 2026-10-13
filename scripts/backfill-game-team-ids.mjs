// Backfills Game.teamA.teamId / Game.teamB.teamId for games created before
// games carried a link to their Team (they only stored a name/logo snapshot).
//
// Without this link, routes had to guess a game's team by name — and team
// names are NOT unique per organization (e.g. a "Trojans" in SD Thu and a
// different "Trojans" in Temecula), so the wrong team's logo could show up.
// The app already resolves un-backfilled games safely (league + name), so
// this is not urgent, but it makes every game rename-proof and lets the
// fallback eventually go away.
//
// Resolution per side (see src/lib/gameTeamResolution.js):
//   1. the Schedule entry's team1/team2 id, if that team has the same name
//      and belongs to the game's league (or is a placeholder);
//   2. otherwise the team with that name in the game's league;
//   3. otherwise the org's placeholder team with that name ("TBD", …).
// Sides already linked are never touched; unresolved sides are reported.
//
// Run modes:
//   node scripts/backfill-game-team-ids.mjs                 -> dry run, no writes
//   node scripts/backfill-game-team-ids.mjs --apply         -> performs the writes
//   ... --org=<slug>                                        -> limit to one organization
//   ... --verbose                                           -> list every planned update

import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { buildTeamIndex, planTeamIdBackfill } = require(path.join(rootDir, "src/lib/gameTeamResolution.js"));

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");
const ORG_SLUG = process.argv.find((a) => a.startsWith("--org="))?.slice("--org=".length) || null;
const BATCH_SIZE = 500;

function loadEnv(envPath) {
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
}

loadEnv(path.join(rootDir, ".env"));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
}

/** gameId → { team1, team2 } from every Schedule week entry with a gameRef. */
function scheduleTeamsByGame(schedules) {
    const map = new Map();
    for (const schedule of schedules) {
        for (const week of schedule.weeks || []) {
            for (const entry of week.games || []) {
                if (entry.gameRef) map.set(String(entry.gameRef), { team1: entry.team1, team2: entry.team2 });
            }
        }
    }
    return map;
}

/** Real (non-placeholder) team names used by more than one team in the org. */
function sharedTeamNames(teams) {
    const byName = new Map();
    for (const team of teams) {
        if (team.isPlaceholder) continue;
        byName.set(team.name, [...(byName.get(team.name) || []), team]);
    }
    return [...byName.entries()].filter(([, list]) => list.length > 1);
}

/** One updateOne per side, guarded so an already-linked side is never overwritten. */
function toBulkOps(updates) {
    return updates.flatMap(({ gameId, set }) => Object.entries(set).map(([field, teamId]) => ({
        updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(gameId), [field]: null },
            update: { $set: { [field]: teamId } },
        },
    })));
}

async function backfillOrganization(db, org) {
    const leagues = await db.collection("leagues").find({ organization: org._id }).project({ _id: 1, name: 1 }).toArray();
    const leagueNameById = new Map(leagues.map((l) => [String(l._id), l.name]));
    const [teams, schedules, games] = await Promise.all([
        db.collection("teams").find({ organization: org._id }).project({ name: 1, leagues: 1, isPlaceholder: 1 }).toArray(),
        db.collection("schedules").find({ organization: org._id }).project({ "weeks.games": 1 }).toArray(),
        leagues.length
            ? db.collection("games").find({ league: { $in: leagues.map((l) => l._id) } }).project({ league: 1, teamA: 1, teamB: 1 }).toArray()
            : [],
    ]);

    const plan = planTeamIdBackfill(games, buildTeamIndex(teams), scheduleTeamsByGame(schedules));
    const fromSchedule = plan.updates.reduce((n, u) => n + Object.values(u.sources).filter((s) => s === "schedule").length, 0);
    const sides = plan.updates.reduce((n, u) => n + Object.keys(u.set).length, 0);

    console.log(`\n=== ${org.name} (${org.slug}) ===`);
    console.log(`  games: ${games.length} | sides already linked: ${plan.alreadyLinked} | sides to link: ${sides} (${fromSchedule} via schedule, ${sides - fromSchedule} via league+name) | unresolved: ${plan.unresolved.length}`);

    for (const [name, list] of sharedTeamNames(teams)) {
        const where = list.map((t) => (t.leagues || []).map((m) => leagueNameById.get(String(m.league)) || "?").join("/") || "no league");
        console.log(`  shared team name "${name}": ${list.length} teams (${where.join(" | ")})`);
    }
    for (const u of plan.unresolved) {
        console.log(`  UNRESOLVED game ${u.gameId} side ${u.side}: "${u.name}" in league "${leagueNameById.get(u.league) || u.league}"`);
    }
    if (VERBOSE) {
        for (const u of plan.updates) console.log(`  ${APPLY ? "LINK" : "WOULD LINK"} game ${u.gameId}: ${JSON.stringify(u.set)} ${JSON.stringify(u.sources)}`);
    }

    if (!APPLY || plan.updates.length === 0) return { sides, written: 0, unresolved: plan.unresolved.length };

    const ops = toBulkOps(plan.updates);
    let written = 0;
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
        const result = await db.collection("games").bulkWrite(ops.slice(i, i + BATCH_SIZE), { ordered: false });
        written += result.modifiedCount;
    }
    console.log(`  wrote ${written} side link(s)`);
    return { sides, written, unresolved: plan.unresolved.length };
}

async function main() {
    console.log(APPLY ? "Mode: APPLY (will write changes)" : "Mode: DRY RUN (no writes)");
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    console.log(`Connected to database: ${db.databaseName}`);

    const orgFilter = ORG_SLUG ? { slug: ORG_SLUG } : {};
    const orgs = await db.collection("organizations").find(orgFilter).project({ name: 1, slug: 1 }).toArray();
    if (orgs.length === 0) {
        console.error(ORG_SLUG ? `No organization with slug "${ORG_SLUG}"` : "No organizations found");
        process.exitCode = 1;
        return;
    }

    const totals = { sides: 0, written: 0, unresolved: 0 };
    for (const org of orgs) {
        const r = await backfillOrganization(db, org);
        totals.sides += r.sides;
        totals.written += r.written;
        totals.unresolved += r.unresolved;
    }

    console.log(`\nTotal: ${totals.sides} side(s) to link, ${totals.written} written, ${totals.unresolved} unresolved.`);
    if (!APPLY && totals.sides > 0) console.log("Dry run only — re-run with --apply to write.");
    if (totals.unresolved > 0) {
        console.log("Unresolved sides keep working via the league+name fallback; check them for typos or deleted teams.");
    }
}

main()
    .catch((err) => {
        console.error("Backfill failed:", err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
