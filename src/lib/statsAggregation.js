import Play from "@/models/Play";
import Team from "@/models/Team";
import Game from "@/models/Game";
import League from "@/models/League";
import "@/models/Player";

// Passer rating — ported from the legacy Xflag system's 5-factor formula
// (LiveGameManageController::calcscore, factors a-e) so ratings keep matching
// what the old site produced. a=completion%, b=TD rate, c=INT rate, d=yards
// per attempt — each rounded to 2 decimals and clamped to [0, 2.375]; e=PAT
// points per touchdown minus a fixed baseline (0.66), left UNCLAMPED, same
// as the legacy formula. Divisor 0.06 is equivalent to "/6 * 100".
export function computePasserRating(atts, comp, yards, tds, ints, pat) {
    if (!atts) return 0;
    const clamp2 = (n) => Math.round(Math.max(0, Math.min(2.375, n)) * 100) / 100;
    const a = clamp2(((comp / atts) * 100 - 30) / 20);
    const b = clamp2((tds / atts) * 100 / (20 / 3));
    const c = clamp2((9.5 - (ints / atts) * 100) / 4);
    const d = clamp2(((yards / atts) - 3) / 4);
    const e = tds ? Math.round(((pat / tds) - 0.66) * 100) / 100 : 0;
    const sum = a + b + c + d + e;
    return sum === 0 ? 0 : parseFloat((sum / 0.06).toFixed(1));
}

/**
 * Build a jersey-number-to-player lookup for a game.
 * Returns { teamA: { "12": { playerId, playerName, playerPhoto } }, teamB: { ... } }
 * along with the team names.
 */
async function buildRosterMap(game, orgId) {
    const teams = await Team.find({
        organization: orgId,
        name: { $in: [game.teamA.name, game.teamB.name] },
    })
        .populate("players.player", "name photo")
        .lean();

    const rosterMap = {};
    const teamNamesByAB = { A: game.teamA.name, B: game.teamB.name };

    for (const team of teams) {
        const map = {};
        for (const p of team.players || []) {
            map[String(p.jerseyNumber)] = {
                playerId: String(p.player?._id || p.player),
                playerName: p.player?.name || "",
                playerPhoto: p.player?.photo || "",
                jerseyNumber: p.jerseyNumber != null ? String(p.jerseyNumber) : "",
            };
        }
        if (team.name === game.teamA.name) rosterMap.A = map;
        if (team.name === game.teamB.name) rosterMap.B = map;
    }

    return { rosterMap, teamNamesByAB };
}

/**
 * Look up a player from a jersey number and team side.
 */
function resolvePlayer(jerseyNumber, teamSide, rosterMap) {
    if (!jerseyNumber || !rosterMap[teamSide]) return null;
    return rosterMap[teamSide][String(jerseyNumber)] || null;
}

/**
 * Aggregate plays into per-player stats for 4 categories.
 *
 * @param {Array} plays - Array of Play documents
 * @param {Object} rosterMap - { A: { jerseyNum: playerInfo }, B: { ... } }
 * @param {Object} teamNamesByAB - { A: "Team A Name", B: "Team B Name" }
 * @returns { passing: [...], receiving: [...], rushing: [...], defensive: [...] }
 */
function aggregateStats(plays, rosterMap, teamNamesByAB) {
    // Accumulators keyed by playerId
    const passing = {};
    const receiving = {};
    const rushing = {};
    const defensive = {};

    function getOrInit(bucket, player, teamSide) {
        if (!bucket[player.playerId]) {
            bucket[player.playerId] = {
                playerId: player.playerId,
                playerName: player.playerName,
                playerPhoto: player.playerPhoto,
                jerseyNumber: player.jerseyNumber || "",
                teamName: teamNamesByAB[teamSide] || "",
                // Will be populated with stat-specific fields
            };
        }
        return bucket[player.playerId];
    }

    function inc(obj, field, amount = 1) {
        obj[field] = (obj[field] || 0) + amount;
    }

    for (const play of plays) {
        const at = play.activeTeam; // "A" or "B"
        const otherTeam = at === "A" ? "B" : "A";
        const isTD = play.points === "Touch Down";
        const isPAT = play.points === "1 Pt." || play.points === "2 Pt.";
        const is1pt = play.points === "1 Pt.";
        const is2pt = play.points === "2 Pt.";

        switch (play.type) {
            case "completion": {
                // PASSER (from activeTeam)
                const passer = resolvePlayer(play.passer, at, rosterMap);
                if (passer) {
                    const ps = getOrInit(passing, passer, at);
                    inc(ps, "atts");
                    inc(ps, "comp");
                    inc(ps, "yards", play.yards);
                    if (isTD) inc(ps, "tds");
                    if (is1pt) inc(ps, "pat1");
                    if (is2pt) inc(ps, "pat2", 2);
                }
                // RECEIVER (from activeTeam)
                const rcvr = resolvePlayer(play.receiver, at, rosterMap);
                if (rcvr) {
                    const rs = getOrInit(receiving, rcvr, at);
                    inc(rs, "receptions");
                    inc(rs, "yards", play.yards);
                    if (isTD) inc(rs, "tds");
                    if (is1pt) inc(rs, "pat1");
                    if (is2pt) inc(rs, "pat2", 2);
                }
                // FLAG PULL (from other team — defensive)
                if (play.flagPull) {
                    const fp = resolvePlayer(play.flagPull, otherTeam, rosterMap);
                    if (fp) {
                        const ds = getOrInit(defensive, fp, otherTeam);
                        inc(ds, "flagPulls");
                    }
                }
                break;
            }
            case "incomplete": {
                // PASSER (from activeTeam) — attempt but no completion
                const passer = resolvePlayer(play.passer, at, rosterMap);
                if (passer) {
                    const ps = getOrInit(passing, passer, at);
                    inc(ps, "atts");
                }
                break;
            }
            case "interception": {
                // PASSER (from activeTeam) — attempt + interception thrown
                const passer = resolvePlayer(play.passer, at, rosterMap);
                if (passer) {
                    const ps = getOrInit(passing, passer, at);
                    inc(ps, "atts");
                    inc(ps, "ints");
                }
                // DEFENDER (from other team) — defensive interception
                const defender = resolvePlayer(play.defender, otherTeam, rosterMap);
                if (defender) {
                    const ds = getOrInit(defensive, defender, otherTeam);
                    inc(ds, "dint");
                    if (isTD) inc(ds, "dintTD");
                    if (is2pt) inc(ds, "dpat", 2);
                }
                // FLAG PULL (from activeTeam — pulling flag on defender running back)
                if (play.flagPull) {
                    const fp = resolvePlayer(play.flagPull, at, rosterMap);
                    if (fp) {
                        const ds2 = getOrInit(defensive, fp, at);
                        inc(ds2, "flagPulls");
                    }
                }
                break;
            }
            case "fumble": {
                // DEFENDER (from other team) — recovered fumble
                const defender = resolvePlayer(play.defender, otherTeam, rosterMap);
                if (defender) {
                    const ds = getOrInit(defensive, defender, otherTeam);
                    inc(ds, "fumbles");
                    if (isTD) inc(ds, "fumbleTD");
                    if (is2pt) inc(ds, "fumblePAT", 2);
                }
                // FLAG PULL (from activeTeam)
                if (play.flagPull) {
                    const fp = resolvePlayer(play.flagPull, at, rosterMap);
                    if (fp) {
                        const ds2 = getOrInit(defensive, fp, at);
                        inc(ds2, "flagPulls");
                    }
                }
                break;
            }
            case "sack": {
                // PASSER (from activeTeam) — sacked
                const passer = resolvePlayer(play.passer, at, rosterMap);
                if (passer) {
                    const ps = getOrInit(passing, passer, at);
                    inc(ps, "sacks");
                    if (play.safety) inc(ps, "safety");
                }
                // DEFENDER (from other team) — recorded the sack
                const defender = resolvePlayer(play.defender, otherTeam, rosterMap);
                if (defender) {
                    const ds = getOrInit(defensive, defender, otherTeam);
                    inc(ds, "dsacks");
                    if (play.safety) inc(ds, "dsafety");
                }
                break;
            }
            case "run": {
                // RUSHER (from activeTeam)
                const rusher = resolvePlayer(play.rusher, at, rosterMap);
                if (rusher) {
                    const rs = getOrInit(rushing, rusher, at);
                    inc(rs, "atts");
                    inc(rs, "yards", play.yards);
                    if (isTD) inc(rs, "tds");
                    if (is1pt) inc(rs, "pat1");
                    if (is2pt) inc(rs, "pat2", 2);
                }
                // FLAG PULL (from other team — defensive)
                if (play.flagPull) {
                    const fp = resolvePlayer(play.flagPull, otherTeam, rosterMap);
                    if (fp) {
                        const ds = getOrInit(defensive, fp, otherTeam);
                        inc(ds, "flagPulls");
                    }
                }
                break;
            }
        }
    }

    // Format passing stats
    const passingRows = Object.values(passing).map((p) => {
        const atts = p.atts || 0;
        const comp = p.comp || 0;
        const yards = p.yards || 0;
        const tds = p.tds || 0;
        const ints = p.ints || 0;
        const pat = (p.pat1 || 0) + (p.pat2 || 0);

        const pct = atts > 0 ? ((comp / atts) * 100).toFixed(1) : "0.0";
        const ypc = comp > 0 ? (yards / comp).toFixed(1) : "0.0";

        return {
            playerId: p.playerId,
            playerName: p.playerName,
            playerPhoto: p.playerPhoto,
            jerseyNumber: p.jerseyNumber || "",
            teamName: p.teamName,
            atts,
            comp,
            yards,
            tds,
            pat,
            ints,
            sacks: p.sacks || 0,
            safety: p.safety || 0,
            pct: parseFloat(pct),
            ypc: parseFloat(ypc),
            rate: computePasserRating(atts, comp, yards, tds, ints, pat),
        };
    });

    // Format receiving stats
    const receivingRows = Object.values(receiving).map((r) => {
        const receptions = r.receptions || 0;
        const yards = r.yards || 0;
        const ypr = receptions > 0 ? (yards / receptions).toFixed(1) : "0.0";
        return {
            playerId: r.playerId,
            playerName: r.playerName,
            playerPhoto: r.playerPhoto,
            jerseyNumber: r.jerseyNumber || "",
            teamName: r.teamName,
            receptions,
            yards,
            tds: r.tds || 0,
            pat: (r.pat1 || 0) + (r.pat2 || 0),
            ypr: parseFloat(ypr),
        };
    });

    // Format rushing stats
    const rushingRows = Object.values(rushing).map((r) => {
        const atts = r.atts || 0;
        const yards = r.yards || 0;
        const ypc = atts > 0 ? (yards / atts).toFixed(1) : "0.0";
        return {
            playerId: r.playerId,
            playerName: r.playerName,
            playerPhoto: r.playerPhoto,
            jerseyNumber: r.jerseyNumber || "",
            teamName: r.teamName,
            atts,
            yards,
            tds: r.tds || 0,
            pat: (r.pat1 || 0) + (r.pat2 || 0),
            ypc: parseFloat(ypc),
        };
    });

    // Format defensive stats
    const defensiveRows = Object.values(defensive).map((d) => {
        const dintTD = d.dintTD || 0;
        const fumbleTD = d.fumbleTD || 0;
        const dtd = dintTD + fumbleTD;
        return {
            playerId: d.playerId,
            playerName: d.playerName,
            playerPhoto: d.playerPhoto,
            jerseyNumber: d.jerseyNumber || "",
            teamName: d.teamName,
            dint: d.dint || 0,
            dintTD,
            dtd,
            dpat: (d.dpat || 0) + (d.fumblePAT || 0),
            dsacks: d.dsacks || 0,
            dsafety: d.dsafety || 0,
            fumbles: d.fumbles || 0,
            flagPulls: d.flagPulls || 0,
        };
    });

    return {
        passing: passingRows,
        receiving: receivingRows,
        rushing: rushingRows,
        defensive: defensiveRows,
    };
}

// A team occupying a "No Stats Game" substitute slot (Game.noStatsSide — see
// the model comment) never contributes real stats, no matter whether that
// side currently shows the stand-in's name (mid-game) or has since been
// reverted to the real forfeiting team's name (after completion) — either
// way it's whatever teamNamesByAB[noStatsSide] resolves to *at this same
// query*, so filtering by that name always matches the rows aggregateStats
// just labeled with it.
function excludeNoStatsSide(rows, noStatsSide, teamNamesByAB) {
    if (!noStatsSide) return rows;
    const excludedName = teamNamesByAB[noStatsSide];
    return rows.filter((row) => row.teamName !== excludedName);
}

// Ad-hoc "<Real Team> STATS" (or bare "NO STATS") teams organizers created
// by hand, before/outside the noStatsSide substitute-team flow above, purely
// to log reps for a forfeited opponent's players — e.g. "Darkside STATS",
// "Chozen STATS". Per-league pages (e.g. player-stats) still show these rows
// intentionally, so this is NOT applied in computeGameStats/computeSeasonStats
// below — only the cross-league season leaderboard route filters them out
// (see seasons/leaderboard/route.js), since that's the only surface where
// stats attributed to a stand-in scrimmage team shouldn't count.
export function isNoStatsTeamName(name) {
    if (!name) return false;
    return /\bstats$/i.test(name.trim());
}

/**
 * Compute aggregated stats for a single game.
 */
export async function computeGameStats(gameId) {
    const game = await Game.findById(gameId).lean();
    if (!game) return null;

    const league = await League.findById(game.league).select("organization").lean();
    if (!league) return null;

    const { rosterMap, teamNamesByAB } = await buildRosterMap(game, league.organization);
    const plays = await Play.find({ game: gameId }).sort({ createdAt: 1 }).lean();
    const rawStats = aggregateStats(plays, rosterMap, teamNamesByAB);
    const stats = {
        passing: excludeNoStatsSide(rawStats.passing, game.noStatsSide, teamNamesByAB),
        receiving: excludeNoStatsSide(rawStats.receiving, game.noStatsSide, teamNamesByAB),
        rushing: excludeNoStatsSide(rawStats.rushing, game.noStatsSide, teamNamesByAB),
        defensive: excludeNoStatsSide(rawStats.defensive, game.noStatsSide, teamNamesByAB),
    };

    return {
        stats,
        game,
        teamNames: teamNamesByAB,
    };
}

// The leaderboard route calls computeSeasonStats once per stat type
// (passing/receiving/rushing/defensive), all four arriving concurrently for
// the same leagueId — computeSeasonStats always returns all four categories
// anyway, so without coalescing that's 4x redundant DB work per request.
// This cache shares the in-flight promise across those calls and keeps the
// result around briefly for the next page load.
const seasonStatsCache = new Map();
const SEASON_STATS_TTL_MS = 10_000;

async function computeSeasonStatsUncached(leagueId, orgId) {
    // noStatsBothSides games (see start-no-stats-game/route.js) are excluded
    // outright here — neither side's plays should feed league/season player
    // stats or the season leaderboard, unlike noStatsSide which only strips
    // one side's rows via excludeNoStatsSide below.
    const games = await Game.find({ league: leagueId, gameType: { $ne: "practice" }, noStatsBothSides: { $ne: true } }).lean();
    if (!games.length) return { passing: [], receiving: [], rushing: [], defensive: [] };

    // Build roster maps for all unique team pairs
    const allPlays = await Play.find({ game: { $in: games.map((g) => g._id) } })
        .sort({ createdAt: 1 })
        .lean();

    // Group plays by game and aggregate per game, then merge
    const playsByGame = {};
    for (const play of allPlays) {
        const gid = String(play.game);
        if (!playsByGame[gid]) playsByGame[gid] = [];
        playsByGame[gid].push(play);
    }

    // Fetch every team roster referenced by this league's games in ONE query,
    // instead of one Team.find().populate() round-trip per game — the same
    // two teams usually play each other multiple times in a season, so the
    // previous per-game fetch multiplied Atlas round-trips by game count.
    const teamNames = new Set();
    for (const game of games) {
        teamNames.add(game.teamA.name);
        teamNames.add(game.teamB.name);
    }
    const teams = await Team.find({
        organization: orgId,
        name: { $in: [...teamNames] },
    })
        .populate("players.player", "name photo")
        .lean();

    const rosterByTeamName = {};
    for (const team of teams) {
        const map = {};
        for (const p of team.players || []) {
            map[String(p.jerseyNumber)] = {
                playerId: String(p.player?._id || p.player),
                playerName: p.player?.name || "",
                playerPhoto: p.player?.photo || "",
                jerseyNumber: p.jerseyNumber != null ? String(p.jerseyNumber) : "",
            };
        }
        rosterByTeamName[team.name] = map;
    }

    // Accumulated stats across games
    const mergedPassing = {};
    const mergedReceiving = {};
    const mergedRushing = {};
    const mergedDefensive = {};
    // Games-played is scoped per category — a player's rushing appearances
    // and defensive appearances aren't the same set of games, so each needs
    // its own tally (rushAvgPerGame/flagPullsPerGame must divide by games
    // where THAT category actually had a stat, not any game the player
    // touched in any of the other three categories).
    const rushingGamesByPlayer = {};
    const defensiveGamesByPlayer = {};

    for (const game of games) {
        const gid = String(game._id);
        const gamePlays = playsByGame[gid];
        if (!gamePlays || gamePlays.length === 0) continue;

        const rosterMap = {
            A: rosterByTeamName[game.teamA.name] || {},
            B: rosterByTeamName[game.teamB.name] || {},
        };
        const teamNamesByAB = { A: game.teamA.name, B: game.teamB.name };
        const gameStats = aggregateStats(gamePlays, rosterMap, teamNamesByAB);

        // Helper to merge rows — keyed by playerId|||teamName so each player's
        // stats remain isolated per team (fixes multi-team player aggregation bug).
        // `gamesByPlayer`, when passed, tracks games played for THIS category only.
        const mergeRows = (target, rows, fields, gamesByPlayer) => {
            for (const row of rows) {
                const key = `${row.playerId}|||${row.teamName}`;
                if (!target[key]) {
                    target[key] = { ...row };
                } else {
                    for (const f of fields) {
                        target[key][f] = (target[key][f] || 0) + (row[f] || 0);
                    }
                }
                if (gamesByPlayer) {
                    if (!gamesByPlayer[key]) gamesByPlayer[key] = new Set();
                    gamesByPlayer[key].add(gid);
                }
            }
        };

        mergeRows(mergedPassing, excludeNoStatsSide(gameStats.passing, game.noStatsSide, teamNamesByAB), ["atts", "comp", "yards", "tds", "pat", "ints", "sacks", "safety"]);
        mergeRows(mergedReceiving, excludeNoStatsSide(gameStats.receiving, game.noStatsSide, teamNamesByAB), ["receptions", "yards", "tds", "pat"]);
        mergeRows(mergedRushing, excludeNoStatsSide(gameStats.rushing, game.noStatsSide, teamNamesByAB), ["atts", "yards", "tds", "pat"], rushingGamesByPlayer);
        mergeRows(mergedDefensive, excludeNoStatsSide(gameStats.defensive, game.noStatsSide, teamNamesByAB), ["dint", "dintTD", "dtd", "dpat", "dsacks", "dsafety", "fumbles", "flagPulls"], defensiveGamesByPlayer);
    }

    // Recalculate derived fields
    const passingRows = Object.values(mergedPassing).map((p) => {
        const atts = p.atts || 0;
        const comp = p.comp || 0;
        const yards = p.yards || 0;
        const tds = p.tds || 0;
        const ints = p.ints || 0;
        const pat = p.pat || 0;

        const pct = atts > 0 ? ((comp / atts) * 100).toFixed(1) : "0.0";
        const ypc = comp > 0 ? (yards / comp).toFixed(1) : "0.0";

        return {
            ...p,
            pct: parseFloat(pct),
            ypc: parseFloat(ypc),
            rate: computePasserRating(atts, comp, yards, tds, ints, pat),
        };
    });

    const receivingRows = Object.values(mergedReceiving).map((r) => {
        const ypr = r.receptions > 0 ? (r.yards / r.receptions).toFixed(1) : "0.0";
        return { ...r, ypr: parseFloat(ypr) };
    });

    const rushingRows = Object.values(mergedRushing).map((r) => {
        const key = `${r.playerId}|||${r.teamName}`;
        const ypc = r.atts > 0 ? (r.yards / r.atts).toFixed(1) : "0.0";
        const gp = rushingGamesByPlayer[key]?.size || 1;
        const rushAvgPerGame = (r.yards / gp).toFixed(1);
        return { ...r, ypc: parseFloat(ypc), gamesPlayed: gp, rushAvgPerGame: parseFloat(rushAvgPerGame) };
    });

    const defensiveRows = Object.values(mergedDefensive).map((d) => {
        const key = `${d.playerId}|||${d.teamName}`;
        const gp = defensiveGamesByPlayer[key]?.size || 1;
        const fpPerGame = (d.flagPulls / gp).toFixed(1);
        const impact = (d.dint || 0) + (d.dsacks || 0);
        return { ...d, gamesPlayed: gp, flagPullsPerGame: parseFloat(fpPerGame), defImpact: impact };
    });

    return {
        passing: passingRows,
        receiving: receivingRows,
        rushing: rushingRows,
        defensive: defensiveRows,
    };
}

/**
 * Same as computeSeasonStatsUncached, but coalesces concurrent calls for the
 * same league and caches the result briefly, since the leaderboard route
 * fires 4 requests (one per stat type) at once that all need the same data.
 */
export async function computeSeasonStats(leagueId, orgId) {
    const key = String(leagueId);
    const cached = seasonStatsCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.promise;
    }

    const promise = computeSeasonStatsUncached(leagueId, orgId);
    seasonStatsCache.set(key, { promise, expiresAt: Date.now() + SEASON_STATS_TTL_MS });

    // Don't let a failed computation poison the cache for subsequent requests.
    promise.catch(() => seasonStatsCache.delete(key));

    return promise;
}

// ---------------------------------------------------------------------------
// Helpers for "All Players" view — merge per-player-per-team rows into one
// row per player, recalculating derived fields from the raw totals.
// ---------------------------------------------------------------------------

const RAW_FIELDS = {
    passing:   ["atts", "comp", "yards", "tds", "pat", "ints", "sacks", "safety"],
    receiving: ["receptions", "yards", "tds", "pat"],
    rushing:   ["atts", "yards", "tds", "pat", "gamesPlayed"],
    defensive: ["dint", "dintTD", "dtd", "dpat", "dsacks", "dsafety", "fumbles", "flagPulls", "gamesPlayed"],
};

function recalcDerivedFields(p, statType) {
    if (statType === "passing") {
        const atts = p.atts || 0;
        const comp = p.comp || 0;
        const yards = p.yards || 0;
        const tds = p.tds || 0;
        const ints = p.ints || 0;
        const pat = p.pat || 0;
        const pct = atts > 0 ? ((comp / atts) * 100).toFixed(1) : "0.0";
        const ypc = comp > 0 ? (yards / comp).toFixed(1) : "0.0";
        return {
            ...p,
            pct: parseFloat(pct),
            ypc: parseFloat(ypc),
            rate: computePasserRating(atts, comp, yards, tds, ints, pat),
        };
    }
    if (statType === "receiving") {
        const ypr = (p.receptions || 0) > 0 ? (p.yards / p.receptions).toFixed(1) : "0.0";
        return { ...p, ypr: parseFloat(ypr) };
    }
    if (statType === "rushing") {
        const ypc = (p.atts || 0) > 0 ? (p.yards / p.atts).toFixed(1) : "0.0";
        const gp = p.gamesPlayed || 1;
        const rushAvgPerGame = (p.yards / gp).toFixed(1);
        return { ...p, ypc: parseFloat(ypc), rushAvgPerGame: parseFloat(rushAvgPerGame) };
    }
    if (statType === "defensive") {
        const gp = p.gamesPlayed || 1;
        const fpPerGame = ((p.flagPulls || 0) / gp).toFixed(1);
        const impact = (p.dint || 0) + (p.dsacks || 0);
        return { ...p, flagPullsPerGame: parseFloat(fpPerGame), defImpact: impact };
    }
    return p;
}

/**
 * Merge per-player-per-team rows (from computeSeasonStats) into one row per
 * player for the "All Players" view. Raw totals are summed and derived fields
 * (pct, ypc, rate, etc.) are recalculated from the combined totals.
 *
 * Players who appear on multiple teams will show all team names joined with " / ".
 */
export function mergeStatRowsByPlayer(rows, statType) {
    const rawFields = RAW_FIELDS[statType] || [];
    const merged = {};

    for (const row of rows) {
        if (!merged[row.playerId]) {
            merged[row.playerId] = {
                ...row,
                _teamNames: new Set([row.teamName]),
            };
        } else {
            merged[row.playerId]._teamNames.add(row.teamName);
            for (const f of rawFields) {
                merged[row.playerId][f] = (merged[row.playerId][f] || 0) + (row[f] || 0);
            }
        }
    }

    return Object.values(merged).map((p) => {
        const teamNames = [...p._teamNames];
        delete p._teamNames;
        p.teamName = teamNames.join(" / ");
        return recalcDerivedFields(p, statType);
    });
}
