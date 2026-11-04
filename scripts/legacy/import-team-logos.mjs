// Bring the legacy XFlag (Laravel) team logos into FlagMag.
//
// The old admin stored each team's logo as public/team_logo/<file> on its own
// server (xflagfootball.com/admin/backend). Those files were downloaded into
// <xMag>/OLD/team_logo/ together with legacy-teams.json (id, name, logo,
// updated_at of every row in xflagfoo_newdb.teams). This script:
//
//   1. maps every legacy team id to the FlagMag team it was imported as, using
//      the plan reports (scripts/legacy/reports/season-*-plan.json) and the
//      `legacyimports` registry written by import-season.mjs;
//   2. picks, per FlagMag team, the most recently updated legacy logo;
//   3. --write-files: writes a resized copy (max 512px) to
//      public/assets/images/uploads/legacy-team-<teamId>.<ext>, served at
//      /api/uploads/<name> like every other upload;
//   4. --apply: sets Team.logo (and the logo snapshot on that team's games)
//      ONLY where it is still empty, and ONLY for files the live site already
//      serves (deploy the new upload files first) — so a logo is never pointed
//      at a file production does not have, and logos organizers uploaded in
//      FlagMag are never overwritten.
//
//   node --import ./scripts/lib/alias-loader.mjs scripts/legacy/import-team-logos.mjs \
//        [--write-files] [--apply] [--rollback] [--logos <dir>] [--live <origin>]
//
// No flag = DRY RUN: writes scripts/legacy/reports/team-logos-plan.json only.
// --rollback (with --apply) clears exactly the logos this script set.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import sharp from "sharp";
import Organization from "@/models/Organization";
import Team from "@/models/Team";
import Game from "@/models/Game";
import { teamMatchKey } from "@/lib/legacyImport";
import { loadEnv, REGISTRY } from "./common.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const ORG_SLUG = "xflagfootball";
// Laravel-era import namespace — the only legacy system that had logos.
const SYSTEM = "xflag-legacy";
const ENTITY = "team-logo";
const FILE_PREFIX = "legacy-team-";
const MAX_SIDE_PX = 512;
const UPLOADS_DIR = path.join(rootDir, "public", "assets", "images", "uploads");
const REPORTS_DIR = path.join(__dirname, "reports");

function parseArgs(argv) {
    const args = {
        writeFiles: argv.includes("--write-files"),
        apply: argv.includes("--apply"),
        rollback: argv.includes("--rollback"),
        logos: path.resolve(rootDir, "..", "OLD", "team_logo"),
        live: "https://www.flagmag.com",
    };
    const at = (flag) => argv.indexOf(flag);
    if (at("--logos") !== -1) args.logos = path.resolve(argv[at("--logos") + 1]);
    if (at("--live") !== -1) args.live = argv[at("--live") + 1].replace(/\/$/, "");
    return args;
}

/** legacy team id → FlagMag team id, from every Laravel-era plan report + registry. */
async function loadTeamMapping() {
    const reg = mongoose.connection.db.collection(REGISTRY);
    const registered = new Map(
        (await reg.find({ system: SYSTEM, entity: "team" }).toArray()).map((r) => [r.legacyId, String(r.docId)])
    );
    const mapping = new Map();
    // Club match key → FlagMag team ids it was imported as (for legacy rows of
    // the same club that no imported season referenced, e.g. "GOAT W23").
    const teamIdsByKey = new Map();
    const unresolvedKeys = new Set();
    const plans = fs.readdirSync(REPORTS_DIR).filter((f) => /^season-\d+-plan\.json$/.test(f));
    for (const file of plans) {
        const plan = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), "utf8"));
        for (const t of plan.teams) {
            const teamId = t.teamId || registered.get(t.key);
            if (!teamId) { unresolvedKeys.add(t.key); continue; }
            for (const id of t.legacyTeamIds) mapping.set(id, teamId);
            if (!teamIdsByKey.has(t.key)) teamIdsByKey.set(t.key, new Set());
            teamIdsByKey.get(t.key).add(teamId);
        }
    }
    return { mapping, teamIdsByKey, unresolvedKeys: [...unresolvedKeys], planFiles: plans.length };
}

/**
 * FlagMag team for a legacy row, and how it was found. Rows referenced by an
 * imported season use the import's own match; otherwise the club key must
 * point to exactly ONE team — first among imported clubs, then among all real
 * FlagMag teams — or the row is left unmatched (same-named clubs collide).
 */
// Bracket/schedule stand-ins the old admin stored as teams ("D-2 Semi", "TBD",
// "Bye Week") — never a club, so never matched by name.
const STAND_IN_NAME = /\b(tbd|bye|winner|loser|practice|championship|semi|final|elimination|open field|seed)\b/i;

function resolveTeam(lt, mapping, teamIdsByKey, teamIdsByName) {
    const direct = mapping.get(lt.id);
    if (direct) return { teamId: direct, via: "import" };
    if (STAND_IN_NAME.test(lt.name || "")) return { teamId: null, via: "stand-in" };
    const key = teamMatchKey(lt.name || "");
    const imported = teamIdsByKey.get(key);
    if (imported?.size === 1) return { teamId: [...imported][0], via: "club-key" };
    if (imported?.size > 1) return { teamId: null, via: "ambiguous-club-key" };
    const named = teamIdsByName.get(key);
    if (named?.length === 1) return { teamId: named[0], via: "unique-name" };
    return { teamId: null, via: named?.length > 1 ? "ambiguous-name" : "no-match" };
}

function buildPlan(legacyTeams, { mapping, teamIdsByKey }, teamsById, logosDir) {
    const teamIdsByName = new Map();
    for (const [id, t] of teamsById) {
        if (t.isPlaceholder) continue;
        const key = teamMatchKey(t.name);
        if (!teamIdsByName.has(key)) teamIdsByName.set(key, []);
        teamIdsByName.get(key).push(id);
    }
    const byTeam = new Map();
    const unmapped = [];
    const missingFile = [];
    for (const lt of legacyTeams) {
        if (!lt.logo) continue;
        const file = lt.logo.replace(/^public\/team_logo\//, "");
        const { teamId, via } = resolveTeam(lt, mapping, teamIdsByKey, teamIdsByName);
        if (!teamId) { unmapped.push({ legacyId: lt.id, name: lt.name, reason: via }); continue; }
        if (!fs.existsSync(path.join(logosDir, file))) { missingFile.push({ legacyId: lt.id, file }); continue; }
        const prev = byTeam.get(teamId);
        // Seasonal copies of one club ("Bandits F25", "Bandits H25") each carry
        // a logo — the most recently edited row wins.
        if (!prev || String(lt.updated_at || "") > String(prev.updated_at || "")) {
            byTeam.set(teamId, { teamId, legacyId: lt.id, legacyName: lt.name, via, file, updated_at: lt.updated_at });
        }
    }

    const entries = [];
    for (const e of byTeam.values()) {
        const team = teamsById.get(e.teamId);
        if (!team) { entries.push({ ...e, action: "skip", reason: "team-not-found" }); continue; }
        const ext = path.extname(e.file).toLowerCase() === ".png" ? ".png" : ".jpg";
        const target = `${FILE_PREFIX}${e.teamId}${ext}`;
        const base = { ...e, teamName: team.name, target, url: `/api/uploads/${target}` };
        if (team.logo && team.logo !== base.url) entries.push({ ...base, action: "skip", reason: "has-logo", currentLogo: team.logo });
        else if (team.logo === base.url) entries.push({ ...base, action: "skip", reason: "already-applied" });
        else entries.push({ ...base, action: "set" });
    }
    return { entries, unmapped, missingFile };
}

async function writeFile(entry, logosDir) {
    const src = path.join(logosDir, entry.file);
    const img = sharp(src).rotate().resize(MAX_SIDE_PX, MAX_SIDE_PX, { fit: "inside", withoutEnlargement: true });
    const out = entry.target.endsWith(".png") ? img.png({ compressionLevel: 9 }) : img.flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true });
    await out.toFile(path.join(UPLOADS_DIR, entry.target));
}

async function isLive(origin, entry) {
    try {
        const res = await fetch(`${origin}${entry.url}`, { method: "HEAD", signal: AbortSignal.timeout(30000) });
        return res.ok && (res.headers.get("content-type") || "").startsWith("image/");
    } catch {
        return false;
    }
}

async function applyEntry(entry, orgId, reg) {
    const teamId = new mongoose.Types.ObjectId(entry.teamId);
    // Register first: a crash after it still leaves rollback able to find the write.
    await reg.updateOne(
        { system: SYSTEM, entity: ENTITY, legacyId: entry.teamId },
        { $setOnInsert: { docId: teamId, logo: entry.url, legacyTeamId: entry.legacyId, at: new Date() } },
        { upsert: true }
    );
    const empty = { $in: ["", null] };
    const team = await Team.updateOne({ _id: teamId, organization: orgId, $or: [{ logo: empty }, { logo: { $exists: false } }] }, { $set: { logo: entry.url } });
    const a = await Game.updateMany({ "teamA.teamId": teamId, "teamA.logo": empty }, { $set: { "teamA.logo": entry.url } });
    const b = await Game.updateMany({ "teamB.teamId": teamId, "teamB.logo": empty }, { $set: { "teamB.logo": entry.url } });
    return { team: team.modifiedCount, games: a.modifiedCount + b.modifiedCount };
}

async function rollback(apply) {
    const reg = mongoose.connection.db.collection(REGISTRY);
    const rows = await reg.find({ system: SYSTEM, entity: ENTITY }).toArray();
    console.log(`${rows.length} logo(s) recorded by this script.`);
    if (!apply) { console.log("Dry run — add --apply to clear them."); return; }
    let teams = 0, games = 0;
    for (const r of rows) {
        teams += (await Team.updateOne({ _id: r.docId, logo: r.logo }, { $set: { logo: "" } })).modifiedCount;
        games += (await Game.updateMany({ "teamA.teamId": r.docId, "teamA.logo": r.logo }, { $set: { "teamA.logo": "" } })).modifiedCount;
        games += (await Game.updateMany({ "teamB.teamId": r.docId, "teamB.logo": r.logo }, { $set: { "teamB.logo": "" } })).modifiedCount;
        await reg.deleteOne({ _id: r._id });
    }
    console.log(`Cleared ${teams} team logo(s) and ${games} game logo snapshot(s). Files in uploads/ were left in place.`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    loadEnv();
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);

    if (args.rollback) return rollback(args.apply);

    const org = await Organization.findOne({ slug: ORG_SLUG }).select("_id").lean();
    if (!org) throw new Error(`Organization ${ORG_SLUG} not found`);
    const legacyTeams = JSON.parse(fs.readFileSync(path.join(args.logos, "legacy-teams.json"), "utf8"));
    const { mapping, teamIdsByKey, unresolvedKeys, planFiles } = await loadTeamMapping();
    const teams = await Team.find({ organization: org._id }).select("name logo isPlaceholder").lean();
    const teamsById = new Map(teams.map((t) => [String(t._id), t]));
    const { entries, unmapped, missingFile } = buildPlan(legacyTeams, { mapping, teamIdsByKey }, teamsById, args.logos);

    const count = (pred) => entries.filter(pred).length;
    const summary = {
        planFiles,
        legacyTeamsWithLogo: legacyTeams.filter((t) => t.logo).length,
        mappedLegacyIds: mapping.size,
        flagmagTeamsWithCandidate: entries.length,
        toSet: count((e) => e.action === "set"),
        skippedHasLogo: count((e) => e.reason === "has-logo"),
        alreadyApplied: count((e) => e.reason === "already-applied"),
        teamNotFound: count((e) => e.reason === "team-not-found"),
        matchedVia: Object.fromEntries(["import", "club-key", "unique-name"].map((v) => [v, count((e) => e.via === v && e.action === "set")])),
        legacyRowsUnmatched: unmapped.length,
        missingFiles: missingFile.length,
        unresolvedPlanKeys: unresolvedKeys.length,
    };
    fs.writeFileSync(path.join(REPORTS_DIR, "team-logos-plan.json"), JSON.stringify({ summary, entries, unmapped, missingFile, unresolvedKeys }, null, 2));
    console.log(summary);

    const toSet = entries.filter((e) => e.action === "set" || e.reason === "already-applied");
    if (args.writeFiles) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        for (const e of toSet) await writeFile(e, args.logos);
        console.log(`Wrote ${toSet.length} logo file(s) to ${UPLOADS_DIR}`);
    }

    if (!args.apply) {
        console.log("Dry run — report written to scripts/legacy/reports/team-logos-plan.json");
        return;
    }

    const reg = mongoose.connection.db.collection(REGISTRY);
    await reg.createIndex({ system: 1, entity: 1, legacyId: 1 }, { unique: true });
    let teamsSet = 0, gamesSet = 0;
    const notLive = [];
    for (const e of entries.filter((x) => x.action === "set")) {
        if (!(await isLive(args.live, e))) { notLive.push(e.target); continue; }
        const r = await applyEntry(e, org._id, reg);
        teamsSet += r.team;
        gamesSet += r.games;
    }
    console.log(`Set ${teamsSet} team logo(s) and ${gamesSet} game logo snapshot(s).`);
    if (notLive.length) console.log(`${notLive.length} skipped — not served by ${args.live} yet (deploy the upload files, then re-run): ${notLive.slice(0, 5).join(", ")}…`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
