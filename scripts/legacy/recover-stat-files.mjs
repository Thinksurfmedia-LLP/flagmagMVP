// Recover games / stats from per-game stat files the old XFlag site left on
// its server (admin/backend/storage/excel-folder/*_import.csv) when the game
// itself never made it into the old database — found by the audit in
// scripts/legacy/reports/orphan-stat-files-audit.csv.
//
// Each file is the play-by-play the old stat app exported at "End Game";
// the old site's endGame() summed it into one stats row per player and
// derived the score with calcscore() (APIController.php). This script does
// exactly the same, so recovered data matches what the old site would have
// shown (checked: that score rule reproduces 3,065 of the 3,293 scores the
// old database stored; the rest were edited by hand afterwards).
//
// Spec items (scripts/legacy/recovery/<spec>.json):
//   { mode: "stats", gameId }    stats for a game FlagMag already has (no stats yet)
//   { mode: "game",  leagueId }  a game missing entirely: created in that league,
//                                its week added to the schedule (later weeks renumbered)
//
//   node --import ./scripts/lib/alias-loader.mjs scripts/legacy/recover-stat-files.mjs \
//        --spec scripts/legacy/recovery/stat-files-2026-11-16.json --db <old newdb.sqlite> [--apply]
//   ... --spec <spec> --undo [--apply]
//
// Dry run by default. Every write is logged in `legacyrecoveries` for --undo.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import mongoose from "mongoose";
import Game from "@/models/Game";
import League from "@/models/League";
import Schedule from "@/models/Schedule";
import Player from "@/models/Player";
import ImportedStatLine from "@/models/ImportedStatLine";
import { legacyStatsToCategories, hasCategoryStats } from "@/lib/importedStats";
import { loadEnv, REGISTRY } from "./common.mjs";

const SYSTEM = "xflag-csv-recovery";
const PLAYER_SYSTEM = "xflag-legacy";
const LOG = "legacyrecoveries";
const STAT_COLUMNS = ["PAttempts", "PCompletions", "PYards", "PTD", "PPAT", "PINT", "PSacks", "PSafety", "RReceptions", "RYards", "RTD", "RPAT", "DINT", "DTD", "DPAT", "DSacks", "DSafety", "DTackle", "RushAttempts", "RushYards", "RushTD", "RushPAT", "FlagPull"];
const FILE_RE = /^(\d+)_(\d+)_.*_(\d{4}-\d{2}-\d{2})_(\d{2})[:-](\d{2})_\d{4}-\d{2}-\d{2}_\d+_import\.csv$/;
const WEEK_RE = /^Week (\d+) - (.+)$/;

function parseArgs(argv) {
    const args = { apply: argv.includes("--apply"), undo: argv.includes("--undo") };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--spec") args.spec = argv[++i];
        if (argv[i] === "--db") args.db = argv[++i];
    }
    if (!args.spec || (!args.undo && !args.db)) {
        console.error("Usage: recover-stat-files.mjs --spec <spec.json> --db <newdb.sqlite> [--apply] | --spec <spec.json> --undo [--apply]");
        process.exit(1);
    }
    return args;
}

// Minimal CSV reader for the old export: every field quoted, no embedded quotes/newlines.
function readCsv(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
    const split = (line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((f) => f.replace(/^"|"$/g, ""));
    const header = split(lines[0]);
    return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [header[i], v])));
}

const toNum = (v) => Number.parseInt(v, 10) || 0;

/** The old site's calcscore(): offence/defence TDs, defensive safeties and every PAT. */
export function oldSiteScore(rows) {
    return rows.reduce((s, r) => s + (toNum(r.RTD) + toNum(r.DTD) + toNum(r.RushTD)) * 6 + toNum(r.DSafety) * 2
        + toNum(r.RPAT) + toNum(r.DPAT) + toNum(r.RushPAT), 0);
}

/** The old site's endGame(): rows of team2 go to side B, the rest to side A; one total per player + jersey. */
export function aggregatePlays(rows, team2Id) {
    const totals = new Map();
    for (const r of rows) {
        const side = String(r.TeamId) === String(team2Id) ? "B" : "A";
        const key = `${side}|${r.PlayerId}|${r.PlayerNumber}`;
        const t = totals.get(key) || { side, playerId: String(r.PlayerId), jersey: String(r.PlayerNumber), team: r.Team, ...Object.fromEntries(STAT_COLUMNS.map((c) => [c, 0])) };
        STAT_COLUMNS.forEach((c) => { t[c] += toNum(r[c]); });
        totals.set(key, t);
    }
    return [...totals.values()];
}

const normTeam = (n) => String(n || "").toLowerCase().replace(/\s+(s|w|f|h|sp)\d{2}\s*$/, "").replace(/[^a-z0-9]/g, "");

function loadItem(specDir, item) {
    const file = path.join(specDir, "stat-files", item.localFile);
    const raw = fs.readFileSync(file);
    const sha = crypto.createHash("sha256").update(raw).digest("hex");
    if (sha !== item.sha256) throw new Error(`${item.localFile}: checksum mismatch`);
    const m = item.sourceFile.match(FILE_RE);
    if (!m) throw new Error(`${item.sourceFile}: unexpected file name`);
    const rows = readCsv(raw.toString("utf8"));
    const [, team1Id, team2Id, date, hh, mm] = m;
    const sideRows = { A: rows.filter((r) => String(r.TeamId) !== team2Id), B: rows.filter((r) => String(r.TeamId) === team2Id) };
    return {
        ...item, rows, team1Id, team2Id, date, time: `${hh}:${mm}`,
        teamNames: { A: sideRows.A[0]?.Team || "", B: sideRows.B[0]?.Team || "" },
        score: { A: oldSiteScore(sideRows.A), B: oldSiteScore(sideRows.B) },
        players: aggregatePlays(rows, team2Id).filter((p) => hasAnyStat(p)),
    };
}

function hasAnyStat(p) {
    return Object.values(legacyStatsToCategories(p)).some(hasCategoryStats);
}

// Old roster player id (CSV PlayerId = players.id) → login user → the Player
// the import created for that user. Must resolve for every line, or we stop.
async function resolvePlayers(sqlite, items) {
    const ids = [...new Set(items.flatMap((i) => i.players.map((p) => p.playerId)))];
    const rows = sqlite.prepare(`SELECT id, player_id FROM players WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids.map(Number));
    const userByRoster = new Map(rows.map((r) => [String(r.id), String(r.player_id)]));
    const reg = await mongoose.connection.db.collection(REGISTRY)
        .find({ system: PLAYER_SYSTEM, entity: "player", legacyId: { $in: [...new Set(userByRoster.values())] } }).toArray();
    const docByUser = new Map(reg.map((r) => [r.legacyId, r.docId]));
    // Users the import LINKED to an existing FlagMag player have no registry
    // row — follow their other imported stat rows to the player they went to.
    for (const user of new Set(userByRoster.values())) {
        if (docByUser.has(user)) continue;
        const statIds = sqlite.prepare(
            `SELECT st.id FROM stats st JOIN sldtp sp ON sp.id = st.sldtp_id JOIN players p ON p.id = sp.player_id WHERE p.player_id = ?`
        ).all(Number(user)).map((r) => r.id);
        if (!statIds.length) continue;
        const linked = await ImportedStatLine.distinct("player", { "source.system": PLAYER_SYSTEM, "source.recordId": { $in: statIds } });
        if (linked.length === 1) docByUser.set(user, linked[0]);
    }
    const existing = new Set((await Player.find({ _id: { $in: [...docByUser.values()] } }).select("_id").lean()).map((p) => String(p._id)));
    const problems = [];
    const byRoster = new Map();
    for (const id of ids) {
        const user = userByRoster.get(id);
        const doc = user && docByUser.get(user);
        if (!user) problems.push(`roster player ${id} not in the old database`);
        else if (!doc) problems.push(`old user ${user} (roster ${id}) has no single FlagMag player (never imported, or linked to several)`);
        else if (!existing.has(String(doc))) problems.push(`player for old user ${user} no longer exists in FlagMag`);
        else byRoster.set(id, doc);
    }
    return { byRoster, problems };
}

// source.recordId is numeric (unique per system): the file's upload timestamp
// (last number in its name) x 100 + line number — stable across re-runs.
function lineDoc(item, p, index, gameId, leagueId, playerDoc) {
    const uploadedAt = Number(item.sourceFile.match(/_(\d+)_import\.csv$/)[1]);
    return {
        game: gameId,
        league: leagueId,
        player: playerDoc,
        side: p.side,
        jerseyNumber: p.jersey,
        ...legacyStatsToCategories(p),
        source: { system: SYSTEM, recordId: uploadedAt * 100 + index },
    };
}

async function planStatsItem(item, problems) {
    const game = await Game.findById(item.gameId).lean();
    if (!game) return problems.push(`${item.localFile}: game ${item.gameId} not found`);
    if (normTeam(game.teamA.name) !== normTeam(item.teamNames.A) || normTeam(game.teamB.name) !== normTeam(item.teamNames.B)) {
        problems.push(`${item.localFile}: teams ${item.teamNames.A} v ${item.teamNames.B} ≠ game ${game.teamA.name} v ${game.teamB.name}`);
    }
    if (game.teamA.score !== item.score.A || game.teamB.score !== item.score.B) {
        problems.push(`${item.localFile}: file score ${item.score.A}-${item.score.B} ≠ game score ${game.teamA.score}-${game.teamB.score}`);
    }
    const existingLines = await ImportedStatLine.countDocuments({ game: game._id });
    if (existingLines) problems.push(`${item.localFile}: game already has ${existingLines} stat lines`);
    return { game };
}

async function planGameItem(item, problems) {
    const league = await League.findById(item.leagueId).select("name").lean();
    if (!league) return problems.push(`${item.localFile}: league ${item.leagueId} not found`);
    const games = await Game.find({ league: league._id }).select("date time teamA teamB location sectionName").lean();
    const teamFor = (name) => {
        const hit = games.flatMap((g) => [g.teamA, g.teamB]).find((t) => normTeam(t.name) === normTeam(name));
        if (!hit) problems.push(`${item.localFile}: no team "${name}" plays in ${league.name}`);
        return hit && { teamId: hit.teamId, name: hit.name, logo: hit.logo || "" };
    };
    const teamA = teamFor(item.teamNames.A);
    const teamB = teamFor(item.teamNames.B);
    const sameDay = games.filter((g) => g.date.toISOString().slice(0, 10) === item.date);
    if (teamA && teamB && sameDay.some((g) => [String(g.teamA.teamId), String(g.teamB.teamId)].sort().join() === [String(teamA.teamId), String(teamB.teamId)].sort().join())) {
        problems.push(`${item.localFile}: ${teamA.name} v ${teamB.name} on ${item.date} already exists`);
    }
    return { league, teamA, teamB, location: games[0]?.location || league.name };
}

// New week for `date` in the league's schedule, weeks renumbered by date.
function planSchedule(schedule, date, gameEntries) {
    const [y, mo, d] = date.split("-").map(Number);
    const label = `${mo}/${d}/${String(y).slice(2)}`;
    const weeks = schedule.weeks.map((w) => ({ ...w, firstDate: w.games[0]?.date || "" }));
    if (weeks.some((w) => w.firstDate === date)) throw new Error(`schedule already has a week on ${date}`);
    weeks.push({ name: `Week ? - ${label}`, games: gameEntries, firstDate: date, isNew: true });
    weeks.sort((a, b) => a.firstDate.localeCompare(b.firstDate));
    const renames = [];
    weeks.forEach((w, i) => {
        const m = w.name.match(WEEK_RE);
        const name = `Week ${i + 1} - ${m ? m[2] : label}`;
        if (!w.isNew && name !== w.name) renames.push({ from: w.name, to: name });
        w.name = name;
    });
    return { weeks: weeks.map(({ firstDate, isNew, ...w }) => w), renames, newWeekName: weeks.find((w) => w.isNew).name };
}

async function run(args) {
    const specPath = path.resolve(args.spec);
    const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
    const specKey = path.basename(specPath);
    const log = mongoose.connection.db.collection(LOG);

    if (args.undo) return undo(log, specKey, args.apply);
    if (await log.findOne({ spec: specKey, undone: { $ne: true } })) {
        console.log(`Already applied (${specKey}). Use --undo first to re-run.`);
        return;
    }

    const sqlite = new DatabaseSync(path.resolve(args.db), { readOnly: true });
    const items = spec.items.map((it) => loadItem(path.dirname(specPath), it));
    const { byRoster, problems } = await resolvePlayers(sqlite, items);
    const plans = [];
    for (const item of items) {
        const target = item.mode === "stats" ? await planStatsItem(item, problems) : await planGameItem(item, problems);
        plans.push({ item, target });
        console.log(`\n${item.mode === "stats" ? "STATS for existing game" : "NEW GAME"}: ${item.date} ${item.time} ${item.teamNames.A} ${item.score.A} - ${item.score.B} ${item.teamNames.B}`);
        console.log(`  ${item.players.length} player lines (${item.players.filter((p) => p.side === "A").length} A / ${item.players.filter((p) => p.side === "B").length} B) from ${item.rows.length} plays`);
    }

    // New games group into one new week per league + date.
    const weekGroups = new Map();
    for (const p of plans.filter((x) => x.item.mode === "game" && x.target?.league)) {
        const key = `${p.item.leagueId}|${p.item.date}`;
        if (!weekGroups.has(key)) weekGroups.set(key, []);
        weekGroups.get(key).push(p);
    }
    const schedulePlans = [];
    for (const [key, group] of weekGroups) {
        const [leagueId, date] = key.split("|");
        const schedule = await Schedule.findOne({ leagueId }).lean();
        if (!schedule) { problems.push(`no schedule for league ${leagueId}`); continue; }
        const plan = planSchedule(schedule, date, []);
        schedulePlans.push({ leagueId, date, schedule, plan, group });
        console.log(`\nSchedule ${schedule.scheduleLabel || leagueId}: add "${plan.newWeekName}" (${group.length} games)`);
        plan.renames.forEach((r) => console.log(`  rename "${r.from}" → "${r.to}"`));
    }

    if (problems.length) {
        console.log("\nNOT SAFE TO APPLY:");
        problems.forEach((p) => console.log("  - " + p));
        process.exitCode = 1;
        return;
    }
    if (!args.apply) {
        console.log("\nDry run — every check passed. Re-run with --apply.");
        return;
    }

    const session = await mongoose.startSession();
    const record = { spec: specKey, at: new Date(), games: [], statLines: [], schedules: [], sectionRenames: [] };
    try {
        await session.withTransaction(async () => {
            record.games = []; record.statLines = []; record.schedules = []; record.sectionRenames = [];
            const reg = mongoose.connection.db.collection(REGISTRY);
            for (const { item, target } of plans) {
                let gameId = target.game?._id;
                let leagueId = target.game?.league;
                if (item.mode === "game") {
                    const sp = schedulePlans.find((s) => s.leagueId === item.leagueId && s.date === item.date);
                    const [doc] = await Game.create([{
                        league: target.league._id,
                        date: new Date(`${item.date}T00:00:00.000Z`),
                        time: item.time,
                        teamA: { ...target.teamA, score: item.score.A },
                        teamB: { ...target.teamB, score: item.score.B },
                        location: target.location,
                        status: "completed",
                        gameType: "main",
                        sectionName: sp.plan.newWeekName,
                    }], { session });
                    gameId = doc._id;
                    leagueId = target.league._id;
                    record.games.push(gameId);
                    await reg.insertOne({ system: SYSTEM, entity: "game", legacyId: item.sourceFile, docId: gameId, created: true, at: new Date() }, { session });
                    sp.newGames = [...(sp.newGames || []), { team1: target.teamA.teamId, team2: target.teamB.teamId, field: "", date: item.date, time: item.time, gameType: "main", gameRef: gameId }];
                }
                const docs = item.players.map((p, i) => lineDoc(item, p, i, gameId, leagueId, byRoster.get(p.playerId)));
                const created = await ImportedStatLine.insertMany(docs, { session });
                record.statLines.push(...created.map((d) => d._id));
            }
            for (const sp of schedulePlans) {
                const weeks = sp.plan.weeks.map((w) => (w.name === sp.plan.newWeekName ? { ...w, games: sp.newGames } : w));
                record.schedules.push({ scheduleId: sp.schedule._id, weeksBefore: sp.schedule.weeks });
                await Schedule.updateOne({ _id: sp.schedule._id }, { $set: { weeks } }, { session });
                for (const r of sp.plan.renames) {
                    const res = await Game.find({ league: sp.leagueId, sectionName: r.from }).select("_id").session(session).lean();
                    if (res.length) {
                        await Game.updateMany({ _id: { $in: res.map((g) => g._id) } }, { $set: { sectionName: r.to } }, { session });
                        record.sectionRenames.push({ gameIds: res.map((g) => g._id), from: r.from, to: r.to });
                    }
                }
            }
            await log.insertOne(record, { session });
        });
    } finally {
        await session.endSession();
    }
    console.log(`\nApplied: ${record.games.length} games created, ${record.statLines.length} stat lines, ${record.schedules.length} schedules updated, ${record.sectionRenames.length} week renames.`);
}

async function undo(log, specKey, apply) {
    const record = await log.findOne({ spec: specKey, undone: { $ne: true } });
    if (!record) return console.log(`Nothing to undo for ${specKey}.`);
    console.log(`Undo ${specKey}: remove ${record.games.length} games and ${record.statLines.length} stat lines, restore ${record.schedules.length} schedules and ${record.sectionRenames.length} week names.`);
    if (!apply) return console.log("Dry run — add --apply.");
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            await ImportedStatLine.deleteMany({ _id: { $in: record.statLines }, "source.system": SYSTEM }, { session });
            await Game.deleteMany({ _id: { $in: record.games } }, { session });
            await mongoose.connection.db.collection(REGISTRY).deleteMany({ system: SYSTEM, docId: { $in: record.games } }, { session });
            for (const s of record.schedules) await Schedule.updateOne({ _id: s.scheduleId }, { $set: { weeks: s.weeksBefore } }, { session });
            for (const r of record.sectionRenames) await Game.updateMany({ _id: { $in: r.gameIds } }, { $set: { sectionName: r.from } }, { session });
            await log.updateOne({ _id: record._id }, { $set: { undone: true, undoneAt: new Date() } }, { session });
        });
    } finally {
        await session.endSession();
    }
    console.log("Undone.");
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    loadEnv();
    await mongoose.connect(process.env.MONGODB_URI);
    try {
        await run(args);
    } finally {
        await mongoose.disconnect();
    }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1]?.endsWith("recover-stat-files.mjs")) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
