// Import ONE season from the legacy XFlag (Laravel/MySQL) database into
// FlagMag's XFlagFootball organization.
//
// The legacy MySQL dump is first converted to SQLite with
// scripts/legacy/dump-to-sqlite.py, then:
//
//   node --import ./scripts/lib/alias-loader.mjs scripts/legacy/import-season.mjs \
//        --db <legacy.sqlite> --season <legacySeasonId> [--apply] [--verify]
//
// Without --apply it is a DRY RUN: nothing is written to MongoDB; a plan
// report (team/player matches, leagues, games, stat lines) is written to
// scripts/legacy/reports/ for review. Manual corrections go in
// scripts/legacy/overrides/season-<id>.json:
//   { "teams":   { "<team match key>": "<FlagMag Team _id>" | "NEW" },
//     "players": { "<legacy users.id>": "<FlagMag Player _id>" | "NEW" } }
//
// Every document the import creates (or team membership it adds) is recorded
// in the `legacyimports` collection, so re-running is idempotent and
// scripts/legacy/rollback-season.mjs can undo exactly this import.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import mongoose from "mongoose";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import League from "@/models/League";
import Team from "@/models/Team";
import Player from "@/models/Player";
import User from "@/models/User";
import Game from "@/models/Game";
import Schedule from "@/models/Schedule";
import ImportedStatLine from "@/models/ImportedStatLine";
import { legacyStatsToCategories, hasCategoryStats } from "@/lib/importedStats";
import {
    cleanTeamName,
    teamMatchKey,
    teamLooseKey,
    parseSeed,
    leagueTypeFor,
    baseLocationName,
    categoryFor,
    groupGamesIntoWeeks,
    sideForStat,
    normalizePersonName,
} from "@/lib/legacyImport";
import { loadEnv, REGISTRY, SYSTEM } from "./common.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORG_SLUG = "xflagfootball";

function parseArgs(argv) {
    const args = { apply: false, verify: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--apply") args.apply = true;
        else if (a === "--ambiguous-as-new") args.ambiguousAsNew = true;
        else if (a === "--verify") args.verify = true;
        else if (a === "--db") args.db = argv[++i];
        else if (a === "--season") args.season = Number(argv[++i]);
    }
    if (!args.db || !Number.isInteger(args.season)) {
        console.error("Usage: import-season.mjs --db <legacy.sqlite> --season <legacySeasonId> [--apply] [--verify]");
        process.exit(1);
    }
    return args;
}

// ---------------------------------------------------------------------------
// Legacy reads
// ---------------------------------------------------------------------------

/** [start, end) save-time window during which `seasonId` was the default season. */
function seasonWindow(seasonsByCreation, seasonId) {
    const idx = seasonsByCreation.findIndex((s) => s.id === seasonId);
    if (idx === -1) throw new Error(`Legacy season ${seasonId} not found`);
    return {
        start: seasonsByCreation[idx].created_at,
        end: seasonsByCreation[idx + 1]?.created_at ?? null,
    };
}

function readLegacySeason(dbPath, seasonId) {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const all = (sql, ...p) => db.prepare(sql).all(...p);

    const season = db.prepare("SELECT * FROM seasons WHERE id = ?").get(seasonId);
    if (!season) throw new Error(`Legacy season ${seasonId} not found`);

    // A game belongs to whichever season was the DEFAULT when it was saved —
    // that is how the old endGame() assigned it (APIController.php:1063).
    // The sldt rows that would otherwise record it only survive for the last
    // two seasons, and sldt_new's season/team ids don't line up with the
    // games, so the save time is the only rule that works for every season.
    // (For Fall 2025, where sldt survives, it agrees on all 257 games.)
    const { start, end } = seasonWindow(all("SELECT id, created_at FROM seasons ORDER BY created_at, id"), seasonId);
    const games = all(
        `SELECT g.* FROM sgs_games g
         WHERE g.created_at >= ? AND (? IS NULL OR g.created_at < ?)
         ORDER BY g.date, g.time, g.id`,
        start, end, end
    );
    const sldt = all(
        `SELECT s.*, d.name AS division_name, t.name AS team_name
         FROM sldt s LEFT JOIN divisions d ON d.id = s.division_id LEFT JOIN teams t ON t.id = s.team_id
         WHERE s.season_id = ?`,
        seasonId
    );
    const locationIds = [...new Set([...games.map((g) => g.location_id), ...sldt.map((s) => s.location_id)])];
    const locations = all(`SELECT * FROM locations WHERE id IN (${locationIds.map(() => "?").join(",") || "NULL"})`, ...locationIds);

    const teamIds = [...new Set([...games.flatMap((g) => [g.team1, g.team2]), ...sldt.map((s) => s.team_id)])];
    const teams = all(`SELECT id, name FROM teams WHERE id IN (${teamIds.map(() => "?").join(",") || "NULL"})`, ...teamIds);

    const gameIds = games.map((g) => g.id);
    const stats = gameIds.length
        ? all(
              `SELECT st.*, sp.jersey_no, sp.player_id AS roster_id, p.player_id AS user_id, p.team_id AS legacy_team_id
               FROM stats st JOIN sldtp sp ON sp.id = st.sldtp_id LEFT JOIN players p ON p.id = sp.player_id
               WHERE st.game_id IN (${gameIds.map(() => "?").join(",")})`,
              ...gameIds
          )
        : [];
    const userIds = [...new Set(stats.map((s) => s.user_id).filter(Boolean))];
    const users = userIds.length
        ? all(`SELECT id, first_name, last_name, email FROM users WHERE id IN (${userIds.map(() => "?").join(",")})`, ...userIds)
        : [];

    db.close();
    return { season, games, sldt, locations, teams, stats, users };
}

// ---------------------------------------------------------------------------
// Planning (read-only against MongoDB)
// ---------------------------------------------------------------------------

function loadOverrides(seasonId) {
    const file = path.join(__dirname, "overrides", `season-${seasonId}.json`);
    if (!fs.existsSync(file)) return { teams: {}, players: {} };
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return { teams: data.teams || {}, players: data.players || {} };
}

async function planTeams(legacy, orgId, overrides, reg, playerPlanByUserId) {
    const existing = await Team.find({ organization: orgId, isPlaceholder: { $ne: true } }).select("name logo players").lean();
    const existingByKey = new Map();
    const existingByLooseKey = new Map();
    for (const t of existing) {
        for (const [map, key] of [[existingByKey, teamMatchKey(t.name)], [existingByLooseKey, teamLooseKey(t.name)]]) {
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(t);
        }
    }

    // Group legacy per-season team rows into one club per match key.
    const clubs = new Map();
    for (const t of legacy.teams) {
        const key = teamMatchKey(t.name);
        if (!clubs.has(key)) clubs.set(key, { key, legacyTeamIds: [], legacyNames: [] });
        const club = clubs.get(key);
        club.legacyTeamIds.push(t.id);
        club.legacyNames.push(t.name);
    }

    // FlagMag player ids of everyone who played for each club this season.
    const clubKeyByLegacyTeam = new Map(legacy.teams.map((t) => [t.id, teamMatchKey(t.name)]));
    const legacyPlayersByClub = new Map();
    for (const row of legacy.stats) {
        const key = clubKeyByLegacyTeam.get(row.legacy_team_id);
        const p = playerPlanByUserId.get(row.user_id ?? `roster-${row.roster_id}`);
        if (!key || !p?.playerId) continue;
        if (!legacyPlayersByClub.has(key)) legacyPlayersByClub.set(key, new Set());
        legacyPlayersByClub.get(key).add(p.playerId);
    }

    const plan = [];
    for (const club of clubs.values()) {
        const override = overrides.teams[club.key];
        const exact = existingByKey.get(club.key) || [];
        const candidates = exact.length ? exact : existingByLooseKey.get(teamLooseKey(club.key)) || [];
        // Prefer an unseeded spelling ("Mountain Goats F25" over "D1 #2 …") for a new team's name.
        const unseeded = club.legacyNames.find((n) => !parseSeed(n).seedNumber) || club.legacyNames[0];
        const entry = { ...club, newName: cleanTeamName(unseeded) };

        const done = await reg.get("team", club.key);
        if (done) {
            plan.push({ ...entry, action: "link", via: "registry", teamId: String(done.docId), teamName: entry.newName });
            continue;
        }
        if (override && override !== "NEW") {
            const t = existing.find((e) => String(e._id) === override);
            if (!t) throw new Error(`Team override for "${club.key}" points to unknown team ${override}`);
            plan.push({ ...entry, action: "link", via: "override", teamId: String(t._id), teamName: t.name });
        } else if (override === "NEW") {
            plan.push({ ...entry, action: "create", via: "override" });
        } else if (candidates.length === 1) {
            plan.push({ ...entry, action: "link", via: exact.length ? "name" : "loose-name", teamId: String(candidates[0]._id), teamName: candidates[0].name });
        } else if (candidates.length > 1) {
            // Several FlagMag teams share the name (e.g. three unrelated
            // "Trojans"): pick the one whose roster holds the most of this
            // club's legacy players, as already matched to FlagMag players.
            const legacyPlayers = legacyPlayersByClub.get(club.key) || new Set();
            const scored = candidates
                .map((c) => ({ c, n: (c.players || []).filter((e) => legacyPlayers.has(String(e.player))).length }))
                .sort((a, b) => b.n - a.n);
            if (scored[0].n > 0 && scored[0].n > scored[1].n) {
                const t = scored[0].c;
                plan.push({ ...entry, action: "link", via: `name+roster(${scored[0].n})`, teamId: String(t._id), teamName: t.name });
            } else {
                plan.push({ ...entry, action: "ambiguous", candidates: scored.map(({ c, n }) => ({ id: String(c._id), name: c.name, sharedPlayers: n })) });
            }
        } else {
            plan.push({ ...entry, action: "create", via: "no-match" });
        }
    }
    return plan.sort((a, b) => a.key.localeCompare(b.key));
}

async function planPlayers(legacy, orgId, overrides, reg) {
    const players = await Player.find({ organization: orgId }).select("name user").lean();
    const users = await User.find({ _id: { $in: players.map((p) => p.user).filter(Boolean) } }).select("email").lean();
    const emailByUser = new Map(users.map((u) => [String(u._id), (u.email || "").trim().toLowerCase()]));

    const byEmail = new Map();
    const byName = new Map();
    for (const p of players) {
        const email = emailByUser.get(String(p.user));
        if (email) (byEmail.get(email) || byEmail.set(email, []).get(email)).push(p);
        const name = normalizePersonName(p.name);
        if (name) (byName.get(name) || byName.set(name, []).get(name)).push(p);
    }

    // Stats can reference a legacy user that was since deleted — keep the
    // numbers on a "Former player" instead of dropping them.
    const knownUserIds = new Set(legacy.users.map((u) => u.id));
    const statRowsWithNumbers = legacy.stats.filter((s) => Object.values(legacyStatsToCategories(s)).some(hasCategoryStats));
    // Only people who actually recorded something get a Player — users whose
    // rows are all zero would otherwise become empty, roster-less Players.
    const statUserIds = new Set(statRowsWithNumbers.map((s) => s.user_id ?? `roster-${s.roster_id}`));
    const missingUsers = [...statUserIds]
        .filter((id) => !knownUserIds.has(id))
        .map((id) => ({ id, first_name: "Former player", last_name: `#${id}`, email: "", missing: true }));

    // Tie-break for duplicate same-name FlagMag players: the one whose
    // current roster shares a team (by cleaned name) and jersey number with
    // what this person wore in the legacy season.
    const legacyTeamNameById = new Map(legacy.teams.map((t) => [t.id, t.name]));
    const legacyRosterByUser = new Map();
    for (const s of legacy.stats) {
        if (!legacyRosterByUser.has(s.user_id)) legacyRosterByUser.set(s.user_id, []);
        legacyRosterByUser.get(s.user_id).push({ teamKey: teamMatchKey(legacyTeamNameById.get(s.legacy_team_id) || ""), jersey: String(s.jersey_no ?? "") });
    }
    const rosterTeams = await Team.find({ organization: orgId, "players.player": { $in: players.map((p) => p._id) } }).select("name players").lean();
    const rosterByPlayer = new Map();
    for (const t of rosterTeams) {
        for (const e of t.players || []) {
            const pid = String(e.player);
            if (!rosterByPlayer.has(pid)) rosterByPlayer.set(pid, []);
            rosterByPlayer.get(pid).push({ team: t.name, teamKey: teamMatchKey(t.name), jersey: String(e.jerseyNumber) });
        }
    }

    // Old admins often typed made-up emails, so an email hit only counts when
    // the first AND last names agree too; otherwise fall back to name matching.
    const nameParts = (n) => normalizePersonName(n).split(" ").filter(Boolean);
    const sameFirstAndLast = (a, b) => {
        const x = nameParts(a), y = nameParts(b);
        return x.length > 0 && y.length > 0 && x[0] === y[0] && x[x.length - 1] === y[y.length - 1];
    };

    const plan = [];
    for (const u of [...legacy.users.filter((x) => statUserIds.has(x.id)), ...missingUsers]) {
        const name = `${u.first_name || ""} ${u.last_name || ""}`.trim().replace(/\s+/g, " ");
        const email = (u.email || "").trim().toLowerCase();
        const base = { legacyUserId: u.id, name, email };
        // Already handled by an earlier (possibly partial) run of this import.
        const done = await reg.get("player", u.id);
        if (done) {
            plan.push({ ...base, action: "link", via: "registry", playerId: String(done.docId), playerName: name });
            continue;
        }
        if (u.missing) {
            plan.push({ ...base, action: "create", via: "deleted-legacy-user" });
            continue;
        }
        const override = overrides.players[String(u.id)];
        const rawEmailHits = (email && byEmail.get(email)) || [];
        const emailHits = rawEmailHits.filter((p) => sameFirstAndLast(p.name, name));
        if (rawEmailHits.length && !emailHits.length) {
            base.emailConflict = rawEmailHits.map((p) => ({ id: String(p._id), name: p.name }));
        }
        const nameHits = byName.get(normalizePersonName(name)) || [];

        if (override && override !== "NEW") {
            const p = players.find((x) => String(x._id) === override);
            if (!p) throw new Error(`Player override for legacy user ${u.id} points to unknown player ${override}`);
            plan.push({ ...base, action: "link", via: "override", playerId: String(p._id), playerName: p.name });
        } else if (override === "NEW") {
            plan.push({ ...base, action: "create", via: "override" });
        } else if (emailHits.length === 1) {
            plan.push({ ...base, action: "link", via: "email", playerId: String(emailHits[0]._id), playerName: emailHits[0].name });
        } else if (nameHits.length === 1) {
            plan.push({ ...base, action: "link", via: "name", playerId: String(nameHits[0]._id), playerName: nameHits[0].name });
        } else if (emailHits.length > 1 || nameHits.length > 1) {
            const c = emailHits.length > 1 ? emailHits : nameHits;
            const pick = pickByRoster(c, legacyRosterByUser.get(u.id), rosterByPlayer);
            if (pick) {
                plan.push({ ...base, action: "link", via: "name+roster", playerId: String(pick._id), playerName: pick.name });
            } else {
                plan.push({ ...base, action: "ambiguous", candidates: c.map((p) => ({ id: String(p._id), name: p.name, roster: rosterByPlayer.get(String(p._id)) || [] })) });
            }
        } else {
            plan.push({ ...base, action: "create", via: "no-match" });
        }
    }

    // Two different legacy people must never be folded into one FlagMag
    // player automatically (e.g. two "Mike Garcia"s both name-matching the
    // same one) — send those to manual review instead.
    const byTarget = new Map();
    for (const p of plan) {
        if (p.action !== "link" || p.via === "override" || p.via === "registry") continue;
        if (!byTarget.has(p.playerId)) byTarget.set(p.playerId, []);
        byTarget.get(p.playerId).push(p);
    }
    for (const group of byTarget.values()) {
        if (group.length < 2) continue;
        for (const p of group) {
            p.candidates = [{ id: p.playerId, name: p.playerName }];
            p.action = "ambiguous";
            p.reason = `${group.length} legacy users matched the same FlagMag player`;
            delete p.via;
        }
    }
    return plan.sort((a, b) => a.name.localeCompare(b.name));
}

function pickByRoster(candidates, legacyRoster = [], rosterByPlayer) {
    const score = (p) => {
        const roster = rosterByPlayer.get(String(p._id)) || [];
        let best = 0;
        for (const l of legacyRoster) {
            for (const r of roster) {
                const s = (r.teamKey === l.teamKey ? 2 : 0) + (r.jersey === l.jersey ? 1 : 0);
                if (s > best) best = s;
            }
        }
        return best;
    };
    const scored = candidates.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s);
    if (scored[0].s >= 2 && scored[0].s > (scored[1]?.s ?? 0)) return scored[0].p;
    return null;
}

function mostCommon(values) {
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    let best = null;
    for (const [v, n] of counts) if (best === null || n > counts.get(best)) best = v;
    return best;
}

function planLeagues(legacy, seasonSlug) {
    const locById = new Map(legacy.locations.map((l) => [l.id, l]));
    const gamesByLoc = new Map();
    for (const g of legacy.games) {
        if (!gamesByLoc.has(g.location_id)) gamesByLoc.set(g.location_id, []);
        gamesByLoc.get(g.location_id).push(g);
    }
    const locIds = [...new Set([...gamesByLoc.keys(), ...legacy.sldt.map((s) => s.location_id)])];
    return locIds
        .map((locId) => {
            const games = gamesByLoc.get(locId) || [];
            const dates = games.map((g) => g.date).sort();
            // Locations were renamed over the years (e.g. "Carlsbad" games now
            // point at a location with a different name), so the league is
            // named after what the games themselves recorded at the time.
            const name = mostCommon(games.map((g) => String(g.location || "").trim()).filter(Boolean))
                || String(locById.get(locId)?.name || `Location ${locId}`).trim();
            const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            return {
                legacyLocationId: locId,
                name,
                slug: `${base}-${seasonSlug}`,
                leagueType: leagueTypeFor(name),
                category: categoryFor(name),
                location: baseLocationName(name),
                startDate: dates[0] || null,
                endDate: dates[dates.length - 1] || null,
                gameCount: games.length,
                weeks: groupGamesIntoWeeks(games),
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Division label per (location, team) from the season's sldt rows. */
function planMemberships(legacy, leagues, teamPlanByLegacyId) {
    const leagueByLoc = new Map(leagues.map((l) => [l.legacyLocationId, l]));
    const divisionsPerLoc = new Map();
    for (const s of legacy.sldt) {
        if (!divisionsPerLoc.has(s.location_id)) divisionsPerLoc.set(s.location_id, new Set());
        divisionsPerLoc.get(s.location_id).add(s.division_name || "");
    }
    const legacyNameById = new Map(legacy.teams.map((t) => [t.id, t.name]));

    const memberships = new Map(); // `${clubKey}|${locId}` -> membership
    const add = (teamId, locId, divisionName) => {
        const club = teamPlanByLegacyId.get(teamId);
        const league = leagueByLoc.get(locId);
        if (!club || !league) return;
        const key = `${club.key}|${locId}`;
        if (memberships.has(key)) return;
        const seed = parseSeed(legacyNameById.get(teamId));
        const multiDivision = (divisionsPerLoc.get(locId)?.size || 0) > 1;
        const division = league.leagueType === "playoffs"
            ? seed.division
            : multiDivision ? divisionName || "" : "";
        memberships.set(key, {
            clubKey: club.key,
            legacyLocationId: locId,
            division,
            seedNumber: league.leagueType === "playoffs" ? seed.seedNumber : null,
        });
    };
    for (const s of legacy.sldt) add(s.team_id, s.location_id, s.division_name);
    for (const g of legacy.games) {
        add(g.team1, g.location_id, "");
        add(g.team2, g.location_id, "");
    }
    return [...memberships.values()];
}

function planStatLines(legacy, playerPlanByUserId) {
    const gameById = new Map(legacy.games.map((g) => [g.id, g]));
    const lines = [];
    const skipped = { allZero: 0, noSide: 0, noPlayer: 0, mergedDuplicates: 0 };
    const byKey = new Map();
    for (const row of legacy.stats) {
        const categories = legacyStatsToCategories(row);
        if (!Object.values(categories).some(hasCategoryStats)) {
            skipped.allZero++;
            continue;
        }
        const game = gameById.get(row.game_id);
        const side = game && sideForStat(game, row.sldt_id);
        if (!side) {
            skipped.noSide++;
            continue;
        }
        const player = playerPlanByUserId.get(row.user_id ?? `roster-${row.roster_id}`);
        if (!player) {
            skipped.noPlayer++;
            continue;
        }
        const legacyUserId = row.user_id ?? `roster-${row.roster_id}`;
        const key = `${row.game_id}|${legacyUserId}|${side}`;
        const prev = byKey.get(key);
        if (prev) {
            // Same person twice in one game on one side — sum into one line
            // so the box score shows a single row for them.
            for (const cat of Object.keys(categories)) {
                for (const [k, v] of Object.entries(categories[cat])) prev[cat][k] += v;
            }
            prev.legacyStatId = Math.min(prev.legacyStatId, row.id);
            skipped.mergedDuplicates++;
            continue;
        }
        const line = {
            legacyStatId: row.id,
            legacyGameId: row.game_id,
            legacyUserId,
            side,
            jerseyNumber: row.jersey_no != null ? String(row.jersey_no) : "",
            ...categories,
        };
        byKey.set(key, line);
        lines.push(line);
    }
    return { lines, skipped };
}

// ---------------------------------------------------------------------------
// Apply (writes) — every created doc is registered for rollback/idempotency
// ---------------------------------------------------------------------------

function makeRegistry(legacySeasonId) {
    const col = mongoose.connection.db.collection(REGISTRY);
    return {
        async get(entity, legacyId) {
            return col.findOne({ system: SYSTEM, entity, legacyId: String(legacyId) });
        },
        async put(entity, legacyId, docId, created) {
            await col.updateOne(
                { system: SYSTEM, entity, legacyId: String(legacyId) },
                { $setOnInsert: { docId, created, legacySeasonId, at: new Date() } },
                { upsert: true }
            );
        },
        async ensureIndex() {
            await col.createIndex({ system: 1, entity: 1, legacyId: 1 }, { unique: true });
            await col.createIndex({ legacySeasonId: 1 });
        },
    };
}

/**
 * Register first (with a pre-generated _id), then create if missing. A crash
 * between the two steps is harmless: the re-run finds the registry entry and
 * creates the document under the same id, so nothing is ever duplicated or
 * left unregistered (and rollback always knows about it).
 */
async function ensureCreated(reg, Model, entity, legacyId, buildDoc) {
    const existing = await reg.get(entity, legacyId);
    const docId = existing ? existing.docId : new mongoose.Types.ObjectId();
    if (!existing) await reg.put(entity, legacyId, docId, true);
    if (await Model.exists({ _id: docId })) return { docId, created: false };
    await Model.create({ _id: docId, ...buildDoc() });
    return { docId, created: true };
}

// Players.{user, organization, name} is unique, so two login-less players
// in one org can't share a name. Two different legacy people with the same
// name (or a third "Kyle Carter" created next to two ambiguous ones) get a
// " (2)", " (3)" … suffix; these are listed in the run output for review.
async function availablePlayerName(orgId, name) {
    let candidate = name;
    for (let n = 2; await Player.exists({ organization: orgId, user: null, name: candidate }); n++) {
        candidate = `${name} (${n})`;
    }
    return candidate;
}

async function applyPlan({ legacy, orgId, plan }) {
    const reg = makeRegistry(legacy.season.id);
    await reg.ensureIndex();
    const counts = { season: 0, leagues: 0, teams: 0, memberships: 0, players: 0, games: 0, schedules: 0, statLines: 0 };
    const renamedPlayers = [];

    // Season
    if (!(await reg.get("season", legacy.season.id)) && (await Season.exists({ organization: orgId, slug: legacy.season.slug }))) {
        throw new Error(`Season slug "${legacy.season.slug}" already exists and was not created by this import`);
    }
    const season = await ensureCreated(reg, Season, "season", legacy.season.id, () => ({
        organization: orgId, name: legacy.season.name, slug: legacy.season.slug, type: "past", isDefault: false,
    }));
    if (season.created) counts.season++;
    const seasonId = season.docId;

    // Leagues
    const leagueIdByLoc = new Map();
    for (const l of plan.leagues) {
        const legacyId = `${legacy.season.id}:${l.legacyLocationId}`;
        if (!(await reg.get("league", legacyId)) && (await League.exists({ organization: orgId, slug: l.slug }))) {
            throw new Error(`League slug "${l.slug}" already exists and was not created by this import`);
        }
        const league = await ensureCreated(reg, League, "league", legacyId, () => ({
            organization: orgId, season: seasonId, seasonOverridden: true,
            name: l.name, slug: l.slug, type: "past", typeOverridden: true,
            leagueType: l.leagueType, category: l.category, location: l.location, locations: [l.location],
            startDate: l.startDate ? new Date(`${l.startDate}T00:00:00.000Z`) : null,
            endDate: l.endDate ? new Date(`${l.endDate}T00:00:00.000Z`) : null,
        }));
        if (league.created) counts.leagues++;
        leagueIdByLoc.set(l.legacyLocationId, league.docId);
    }

    // Teams
    const teamIdByKey = new Map();
    for (const t of plan.teams) {
        if (t.action === "link") {
            teamIdByKey.set(t.key, new mongoose.Types.ObjectId(t.teamId));
            continue;
        }
        const team = await ensureCreated(reg, Team, "team", t.key, () => ({
            organization: orgId, name: t.newName, players: [], leagues: [],
        }));
        if (team.created) counts.teams++;
        teamIdByKey.set(t.key, team.docId);
    }

    // League memberships (division + playoff seed live here)
    for (const m of plan.memberships) {
        const teamId = teamIdByKey.get(m.clubKey);
        const leagueId = leagueIdByLoc.get(m.legacyLocationId);
        const legacyId = `${teamId}:${leagueId}`;
        if (await reg.get("membership", legacyId)) continue;
        const res = await Team.updateOne(
            { _id: teamId, "leagues.league": { $ne: leagueId } },
            { $push: { leagues: { league: leagueId, division: m.division, seedNumber: m.seedNumber, joinedAt: new Date() } } }
        );
        if (res.modifiedCount === 1) {
            await reg.put("membership", legacyId, teamId, true);
            counts.memberships++;
        } else if (await Team.exists({ _id: teamId, "leagues.league": leagueId })) {
            await reg.put("membership", legacyId, teamId, false); // already a member
        } else {
            throw new Error(`Team ${teamId} not found while adding it to league ${leagueId}`);
        }
    }

    // Players
    const playerIdByUser = new Map();
    for (const p of plan.players) {
        if (p.action === "link") {
            playerIdByUser.set(p.legacyUserId, new mongoose.Types.ObjectId(p.playerId));
            continue;
        }
        const name = await availablePlayerName(orgId, p.name || "Unknown player");
        const player = await ensureCreated(reg, Player, "player", p.legacyUserId, () => ({
            organization: orgId, name, status: "player",
        }));
        if (player.created) counts.players++;
        if (player.created && name !== p.name) renamedPlayers.push({ legacyUserId: p.legacyUserId, name: p.name, createdAs: name });
        playerIdByUser.set(p.legacyUserId, player.docId);
    }

    // Games + schedules (one schedule per league, one week per game date)
    const teams = await Team.find({ _id: { $in: [...teamIdByKey.values()] } }).select("name logo").lean();
    const teamById = new Map(teams.map((t) => [String(t._id), t]));
    const legacyTeamNameById = new Map(legacy.teams.map((t) => [t.id, t.name]));
    const teamDocFor = (legacyTeamId) => {
        const id = teamIdByKey.get(teamMatchKey(legacyTeamNameById.get(legacyTeamId)));
        return teamById.get(String(id));
    };

    const gameIdByLegacy = new Map();
    for (const l of plan.leagues) {
        const leagueId = leagueIdByLoc.get(l.legacyLocationId);
        const scheduleWeeks = [];
        for (const week of l.weeks) {
            const weekGames = [];
            for (const g of week.games) {
                const a = teamDocFor(g.team1);
                const b = teamDocFor(g.team2);
                const game = await ensureCreated(reg, Game, "game", g.id, () => ({
                    league: leagueId,
                    date: new Date(`${g.date}T00:00:00.000Z`),
                    time: String(g.time || "").slice(0, 5),
                    teamA: { teamId: a._id, name: a.name, logo: a.logo || "", score: Number(g.team1_score) || 0 },
                    teamB: { teamId: b._id, name: b.name, logo: b.logo || "", score: Number(g.team2_score) || 0 },
                    location: l.location,
                    status: "completed",
                    gameType: "main",
                    sectionName: week.name,
                }));
                if (game.created) counts.games++;
                gameIdByLegacy.set(g.id, game.docId);
                weekGames.push({ team1: a._id, team2: b._id, field: "", date: g.date, time: String(g.time || "").slice(0, 5), gameType: "main", gameRef: game.docId });
            }
            scheduleWeeks.push({ name: week.name, games: weekGames });
        }
        if (scheduleWeeks.length) {
            const schedule = await ensureCreated(reg, Schedule, "schedule", `${legacy.season.id}:${l.legacyLocationId}`, () => ({
                organization: orgId, scheduleLabel: l.name, leagueId, locationName: l.location, status: "Active", weeks: scheduleWeeks,
            }));
            if (schedule.created) counts.schedules++;
        }
    }

    // Stat lines (unique source.recordId makes this idempotent)
    const ops = plan.statLines.map((line) => ({
        updateOne: {
            filter: { "source.system": SYSTEM, "source.recordId": line.legacyStatId },
            update: {
                $setOnInsert: {
                    game: gameIdByLegacy.get(line.legacyGameId),
                    league: leagueIdByLoc.get(legacy.games.find((g) => g.id === line.legacyGameId).location_id),
                    player: playerIdByUser.get(line.legacyUserId),
                    side: line.side,
                    jerseyNumber: line.jerseyNumber,
                    passing: line.passing,
                    receiving: line.receiving,
                    rushing: line.rushing,
                    defensive: line.defensive,
                    source: { system: SYSTEM, recordId: line.legacyStatId },
                },
            },
            upsert: true,
        },
    }));
    if (ops.length) {
        const res = await ImportedStatLine.bulkWrite(ops, { ordered: false });
        counts.statLines = res.upsertedCount;
    }
    return { ...counts, renamedPlayers };
}

// ---------------------------------------------------------------------------
// Verify — compare what FlagMag now computes against the legacy numbers
// ---------------------------------------------------------------------------

async function verifyImport(legacy, statLines) {
    const reg = makeRegistry(legacy.season.id);
    const problems = [];

    // 1. Scores per game
    for (const g of legacy.games) {
        const r = await reg.get("game", g.id);
        if (!r) { problems.push(`game ${g.id} not imported`); continue; }
        const doc = await Game.findById(r.docId).lean();
        if (doc.teamA.score !== Number(g.team1_score) || doc.teamB.score !== Number(g.team2_score)) {
            problems.push(`game ${g.id} score ${doc.teamA.score}-${doc.teamB.score} != legacy ${g.team1_score}-${g.team2_score}`);
        }
    }

    // 2. Per-player per-game totals: every planned line (legacy rows, with a
    //    player's duplicate rows in one game already summed) is stored as-is.
    let checkedLines = 0;
    for (const expected of statLines) {
        const line = await ImportedStatLine.findOne({ "source.system": SYSTEM, "source.recordId": expected.legacyStatId }).lean();
        if (!line) { problems.push(`stats row ${expected.legacyStatId} missing`); continue; }
        for (const cat of ["passing", "receiving", "rushing", "defensive"]) {
            for (const [k, v] of Object.entries(expected[cat])) {
                if ((line[cat]?.[k] ?? 0) !== v) problems.push(`stats row ${expected.legacyStatId} ${cat}.${k}=${line[cat]?.[k]} != ${v}`);
            }
        }
        checkedLines++;
    }

    // 2b. Grand totals: nothing lost or double counted by the merging above.
    const sumCats = (items) => {
        const t = {};
        for (const it of items) for (const cat of ["passing", "receiving", "rushing", "defensive"]) {
            for (const [k, v] of Object.entries(it[cat] || {})) t[`${cat}.${k}`] = (t[`${cat}.${k}`] || 0) + v;
        }
        return t;
    };
    const legacyTotals = sumCats(legacy.stats.map(legacyStatsToCategories));
    const storedTotals = sumCats(await ImportedStatLine.find({ "source.system": SYSTEM, "source.recordId": { $in: statLines.map((l) => l.legacyStatId) } }).lean());
    for (const [k, v] of Object.entries(legacyTotals)) {
        if ((storedTotals[k] || 0) !== v) problems.push(`season total ${k}=${storedTotals[k] || 0} != legacy ${v}`);
    }

    // 3. Score formula sanity: legacy score == points from imported lines, per side
    const gameDocIds = [];
    for (const g of legacy.games) {
        const r = await reg.get("game", g.id);
        if (r) gameDocIds.push(r.docId);
    }
    const lines = await ImportedStatLine.find({ game: { $in: gameDocIds } })
        .select("game side receiving rushing defensive").lean();
    const pts = new Map();
    for (const l of lines) {
        const k = `${l.game}|${l.side}`;
        const p = (l.receiving.tds + l.rushing.tds + l.defensive.dtd) * 6 + l.defensive.dsafety * 2
            + l.receiving.pat + l.rushing.pat + l.defensive.dpat;
        pts.set(k, (pts.get(k) || 0) + p);
    }
    let formulaMismatches = 0;
    for (const g of legacy.games) {
        const r = await reg.get("game", g.id);
        // A handful of legacy games have a score but no player stats at all.
        if (!r || (!pts.has(`${r.docId}|A`) && !pts.has(`${r.docId}|B`))) continue;
        const a = pts.get(`${r.docId}|A`) || 0;
        const b = pts.get(`${r.docId}|B`) || 0;
        if (a !== Number(g.team1_score) || b !== Number(g.team2_score)) formulaMismatches++;
    }

    return { gamesChecked: legacy.games.length, statLinesChecked: checkedLines, formulaMismatches, problems };
}

// ---------------------------------------------------------------------------

async function main() {
    const args = parseArgs(process.argv.slice(2));
    loadEnv();
    const legacy = readLegacySeason(args.db, args.season);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);

    const org = await Organization.findOne({ slug: ORG_SLUG }).select("_id").lean();
    if (!org) throw new Error(`Organization "${ORG_SLUG}" not found`);

    const overrides = loadOverrides(args.season);
    const reg = makeRegistry(legacy.season.id);
    const players = await planPlayers(legacy, org._id, overrides, reg);
    const teams = await planTeams(legacy, org._id, overrides, reg, new Map(players.map((p) => [p.legacyUserId, p])));
    const leagues = planLeagues(legacy, legacy.season.slug);

    const teamPlanByLegacyId = new Map();
    for (const t of teams) for (const id of t.legacyTeamIds) teamPlanByLegacyId.set(id, t);
    const memberships = planMemberships(legacy, leagues, teamPlanByLegacyId);
    const playerPlanByUserId = new Map(players.map((p) => [p.legacyUserId, p]));
    const { lines: statLines, skipped } = planStatLines(legacy, playerPlanByUserId);

    const plan = { teams, players, leagues, memberships, statLines };
    const tally = (arr) => arr.reduce((acc, x) => ({ ...acc, [`${x.action}${x.via ? `:${x.via}` : ""}`]: (acc[`${x.action}${x.via ? `:${x.via}` : ""}`] || 0) + 1 }), {});
    const summary = {
        legacySeason: `${legacy.season.name} (id ${legacy.season.id})`,
        leagues: leagues.map((l) => `${l.name} [${l.leagueType}, ${l.category}] ${l.gameCount} games, ${l.weeks.length} weeks → /${l.slug}`),
        games: legacy.games.length,
        teams: tally(teams),
        players: tally(players),
        memberships: memberships.length,
        statLines: statLines.length,
        statRowsSkipped: skipped,
    };
    console.log(JSON.stringify(summary, null, 2));

    const reportDir = path.join(__dirname, "reports");
    fs.mkdirSync(reportDir, { recursive: true });
    const reportFile = path.join(reportDir, `season-${args.season}-plan.json`);
    fs.writeFileSync(reportFile, JSON.stringify({ summary, teams, players, leagues: leagues.map(({ weeks, ...l }) => ({ ...l, weeks: weeks.map((w) => ({ name: w.name, games: w.games.length })) })), memberships }, null, 2));
    console.log(`Plan written to ${path.relative(process.cwd(), reportFile)}`);

    // --ambiguous-as-new: never guess between candidates — create a separate
    // record instead (re-linking later is a simple update), and keep the
    // candidates in the plan report for review.
    if (args.ambiguousAsNew) {
        for (const x of [...teams, ...players]) {
            if (x.action === "ambiguous") {
                x.action = "create";
                x.via = "ambiguous-as-new";
            }
        }
    }
    const ambiguous = [...teams, ...players].filter((x) => x.action === "ambiguous");
    if (args.apply) {
        if (ambiguous.length) throw new Error(`${ambiguous.length} ambiguous team/player matches — resolve them in overrides/season-${args.season}.json first`);
        const counts = await applyPlan({ legacy, orgId: org._id, plan });
        console.log("Applied:", counts);
    } else {
        console.log("Dry run — nothing written. Re-run with --apply to import.");
    }

    if (args.verify) {
        const result = await verifyImport(legacy, statLines);
        console.log("Verify:", JSON.stringify({ ...result, problems: result.problems.slice(0, 50) }, null, 2));
        if (result.problems.length) process.exitCode = 2;
    }
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
