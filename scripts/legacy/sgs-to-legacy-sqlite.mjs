// Reshape the Joomla-era SGS stats tables (Summer 2008 → Summer 2011) into the
// Laravel-era table layout that scripts/legacy/import-season.mjs reads, so the
// same importer handles both generations of the old XFlag site.
//
//   python scripts/legacy/dump-to-sqlite.py xflagfoo_XFFJoom1.sql sgs-raw.sqlite
//   node --import ./scripts/lib/alias-loader.mjs scripts/legacy/sgs-to-legacy-sqlite.mjs \
//        --raw sgs-raw.sqlite --out sgs-legacy.sqlite [--unnamed placeholder|skip]
//
// Then import each season with LEGACY_SYSTEM=xflag-sgs (a separate registry
// namespace — SGS ids overlap the Laravel ids already imported):
//
//   LEGACY_SYSTEM=xflag-sgs node --import ./scripts/lib/alias-loader.mjs \
//        scripts/legacy/import-season.mjs --db sgs-legacy.sqlite --season <sgs season id>
//
// --unnamed: most SGS roster slots after 2008 recorded only a jersey number.
//   placeholder (default) keeps their stats on a player named
//   "<Team> #<jersey> (<Season>)"; skip drops those stat rows (game scores are
//   imported either way).
//
// --placeholder-offset: first synthetic user id for placeholders (default
//   1000000). The importer keys players by user id in the shared xflag-sgs
//   registry, so a later conversion of a newer dump must use an unused range
//   (2008-2011 used 1000000; 2015-2022 used 2000000) or its placeholders
//   would link to the earlier import's.

import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
    UNNAMED_USER_OFFSET,
    parseSgsPlayerName,
    formatSgsTime,
    seasonSlug,
    unnamedPlayerName,
} from "@/lib/sgsImport";

function parseArgs(argv) {
    const args = { unnamed: "placeholder", placeholderOffset: UNNAMED_USER_OFFSET };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--raw") args.raw = argv[++i];
        else if (argv[i] === "--out") args.out = argv[++i];
        else if (argv[i] === "--unnamed") args.unnamed = argv[++i];
        else if (argv[i] === "--placeholder-offset") args.placeholderOffset = Number(argv[++i]);
    }
    const validOffset = Number.isInteger(args.placeholderOffset) && args.placeholderOffset >= UNNAMED_USER_OFFSET;
    if (!args.raw || !args.out || !["placeholder", "skip"].includes(args.unnamed) || !validOffset) {
        console.error("Usage: sgs-to-legacy-sqlite.mjs --raw <sgs-raw.sqlite> --out <sgs-legacy.sqlite> [--unnamed placeholder|skip] [--placeholder-offset <n >= 1000000>]");
        process.exit(1);
    }
    if (!fs.existsSync(args.raw)) {
        console.error(`Raw SGS database not found: ${args.raw}`);
        process.exit(1);
    }
    return args;
}

const SCHEMA = `
    CREATE TABLE seasons (id INTEGER PRIMARY KEY, name TEXT, slug TEXT, created_at TEXT);
    CREATE TABLE divisions (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE locations (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE sldt (id INTEGER PRIMARY KEY, season_id INTEGER, location_id INTEGER, division_id INTEGER, team_id INTEGER);
    CREATE TABLE sgs_games (id INTEGER PRIMARY KEY, season_id INTEGER, sldt_id1 INTEGER, sldt_id2 INTEGER,
        team1 INTEGER, team2 INTEGER, location_id INTEGER, location TEXT, date TEXT, time TEXT,
        team1_score INTEGER, team2_score INTEGER, created_at TEXT);
    CREATE TABLE sldtp (id INTEGER PRIMARY KEY, sldt_id INTEGER, player_id INTEGER, jersey_no INTEGER);
    CREATE TABLE players (id INTEGER PRIMARY KEY, player_id INTEGER, team_id INTEGER);
    CREATE TABLE users (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT);
    CREATE TABLE stats (id INTEGER PRIMARY KEY, sldt_id INTEGER, sldtp_id INTEGER, game_id INTEGER,
        PAttempts INTEGER, PCompletions INTEGER, PYards INTEGER, PTD INTEGER, PPAT INTEGER, PINT INTEGER,
        PSacks INTEGER, PSafety INTEGER, RReceptions INTEGER, RYards INTEGER, RTD INTEGER, RPAT INTEGER,
        DINT INTEGER, DTD INTEGER, DPAT INTEGER, DSacks INTEGER, DSafety INTEGER, DTackle INTEGER,
        RushAttempts INTEGER DEFAULT 0, RushYards INTEGER DEFAULT 0, RushTD INTEGER DEFAULT 0,
        RushPAT INTEGER DEFAULT 0, FlagPull INTEGER DEFAULT 0);
`;

function copyReferenceTables(db) {
    db.exec(`
        INSERT INTO divisions SELECT ID, name FROM raw.sgs_division;
        INSERT INTO locations SELECT ID, name FROM raw.sgs_location;
        INSERT INTO teams SELECT ID, name FROM raw.sgs_team;
        INSERT INTO sldt SELECT ID, Season_ID, Location_ID, Division_ID, Team_ID FROM raw.sgs_SLDT;
    `);
    // SGS seasons have no timestamps; the importer only uses created_at for
    // ordering, so the season id stands in for it.
    const insert = db.prepare("INSERT INTO seasons VALUES (?, ?, ?, ?)");
    for (const s of db.prepare("SELECT ID, name FROM raw.sgs_season").all()) {
        insert.run(s.ID, s.name, seasonSlug(s.name), String(s.ID).padStart(4, "0"));
    }
}

/** Games whose SLDT rows are missing can't be tied to a season or teams. */
function copyGames(db) {
    const rows = db.prepare(`
        SELECT g.ID, a.Season_ID, g.SLDT_ID1, g.SLDT_ID2, a.Team_ID AS team1, b.Team_ID AS team2,
               a.Location_ID, l.name AS location, g.date, g.time, g.team1_score, g.team2_score
        FROM raw.sgs_game g
        JOIN raw.sgs_SLDT a ON a.ID = g.SLDT_ID1
        JOIN raw.sgs_SLDT b ON b.ID = g.SLDT_ID2
        LEFT JOIN raw.sgs_location l ON l.ID = a.Location_ID
    `).all();
    const insert = db.prepare("INSERT INTO sgs_games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
    for (const g of rows) {
        insert.run(g.ID, g.Season_ID, g.SLDT_ID1, g.SLDT_ID2, g.team1, g.team2, g.Location_ID,
            g.location || "", g.date, formatSgsTime(g.time), g.team1_score, g.team2_score, g.date);
    }
    const total = db.prepare("SELECT COUNT(*) AS n FROM raw.sgs_game").get().n;
    return { games: rows.length, orphanGames: total - rows.length };
}

/**
 * One `players` row per roster slot (the Laravel table was team membership),
 * pointing at a `users` row: the named SGS player, or — for jersey-only slots
 * in placeholder mode — one synthetic user per (season, team, jersey). A team
 * has a separate SLDT row per location in a season (league + its playoffs),
 * so keying by slot would split one person's season across two players.
 * SGS players saved with a blank name are treated as jersey-only too.
 */
function copyPeople(db, unnamedMode, placeholderOffset) {
    const insertUser = db.prepare("INSERT INTO users VALUES (?, ?, ?, '')");
    const namedIds = new Set();
    for (const p of db.prepare("SELECT ID, name FROM raw.sgs_player").all()) {
        const { first, last } = parseSgsPlayerName(p.name);
        if (!first && !last) continue;
        insertUser.run(p.ID, first, last);
        namedIds.add(p.ID);
    }

    const slots = db.prepare(`
        SELECT sp.ID, sp.SLDT_ID, sp.Player_ID, sp.Jersey_Num, s.Team_ID, s.Season_ID,
               t.name AS team_name, se.name AS season_name
        FROM raw.sgs_SLDTP sp
        JOIN raw.sgs_SLDT s ON s.ID = sp.SLDT_ID
        LEFT JOIN raw.sgs_team t ON t.ID = s.Team_ID
        LEFT JOIN raw.sgs_season se ON se.ID = s.Season_ID
        ORDER BY sp.ID
    `).all();
    const insertSlot = db.prepare("INSERT INTO sldtp VALUES (?, ?, ?, ?)");
    const insertPlayer = db.prepare("INSERT INTO players VALUES (?, ?, ?)");
    const placeholderIds = new Map(); // "season|team|jersey" -> synthetic user id
    let unnamedSlots = 0;
    for (const slot of slots) {
        let userId = namedIds.has(slot.Player_ID) ? slot.Player_ID : null;
        if (userId === null) {
            unnamedSlots++;
            if (unnamedMode === "placeholder") {
                const key = `${slot.Season_ID}|${slot.Team_ID}|${slot.Jersey_Num}`;
                if (!placeholderIds.has(key)) {
                    placeholderIds.set(key, placeholderOffset + placeholderIds.size + 1);
                    insertUser.run(placeholderIds.get(key), unnamedPlayerName(slot.team_name, slot.Jersey_Num, slot.season_name), "");
                }
                userId = placeholderIds.get(key);
            }
        }
        insertSlot.run(slot.ID, slot.SLDT_ID, slot.ID, slot.Jersey_Num);
        insertPlayer.run(slot.ID, userId, slot.Team_ID);
    }
    return { rosterSlots: slots.length, unnamedSlots, placeholderPlayers: placeholderIds.size };
}

function copyStats(db, unnamedMode) {
    // players.player_id is already NULL for every jersey-only slot in skip mode.
    const skipUnnamed = unnamedMode === "skip"
        ? "AND s.SLDTP_ID IN (SELECT id FROM players WHERE player_id IS NOT NULL)"
        : "";
    // Stat rows whose roster slot (or that slot's SLDT row) no longer exists
    // have nobody to credit; requiring `sldtp` keeps statRowsDropped honest.
    db.exec(`
        INSERT INTO stats (id, sldt_id, sldtp_id, game_id, PAttempts, PCompletions, PYards, PTD, PPAT, PINT,
            PSacks, PSafety, RReceptions, RYards, RTD, RPAT, DINT, DTD, DPAT, DSacks, DSafety, DTackle)
        SELECT s.ID, s.SLDT_ID, s.SLDTP_ID, s.game_ID, s.PAttempts, s.PCompletions, s.PYards, s.PTD, s.PPAT,
            s.PINT, s.PSacks, s.PSafety, s.RReceptions, s.RYards, s.RTD, s.RPAT, s.DINT, s.DTD, s.DPAT,
            s.DSacks, s.DSafety, s.DTackle
        FROM raw.sgs_stats s
        JOIN sldtp sp ON sp.id = s.SLDTP_ID
        WHERE s.game_ID IN (SELECT id FROM sgs_games) ${skipUnnamed};
    `);
    const total = db.prepare("SELECT COUNT(*) AS n FROM raw.sgs_stats").get().n;
    const kept = db.prepare("SELECT COUNT(*) AS n FROM stats").get().n;
    return { statRows: kept, statRowsDropped: total - kept };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (fs.existsSync(args.out)) fs.rmSync(args.out);
    const db = new DatabaseSync(args.out);
    db.exec(`ATTACH DATABASE '${args.raw.replace(/'/g, "''")}' AS raw`);
    db.exec("BEGIN");
    db.exec(SCHEMA);
    copyReferenceTables(db);
    const summary = {
        unnamedMode: args.unnamed,
        ...copyGames(db),
        placeholderOffset: args.placeholderOffset,
        ...copyPeople(db, args.unnamed, args.placeholderOffset),
        ...copyStats(db, args.unnamed),
    };
    db.exec("COMMIT");
    db.exec("DETACH DATABASE raw");
    summary.gamesPerSeason = db.prepare(`
        SELECT s.id, s.name, COUNT(g.id) AS games FROM seasons s LEFT JOIN sgs_games g ON g.season_id = s.id
        GROUP BY s.id ORDER BY s.id
    `).all().map((r) => `${r.id} ${r.name}: ${r.games}`);
    db.close();
    console.log(JSON.stringify(summary, null, 2));
}

main();
