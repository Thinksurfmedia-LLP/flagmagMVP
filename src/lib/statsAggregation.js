import Play from "@/models/Play";
import Team from "@/models/Team";
import Game from "@/models/Game";
import League from "@/models/League";

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
                    if (is2pt) inc(ps, "pat2");
                }
                // RECEIVER (from activeTeam)
                const rcvr = resolvePlayer(play.receiver, at, rosterMap);
                if (rcvr) {
                    const rs = getOrInit(receiving, rcvr, at);
                    inc(rs, "receptions");
                    inc(rs, "yards", play.yards);
                    if (isTD) inc(rs, "tds");
                    if (is1pt) inc(rs, "pat1");
                    if (is2pt) inc(rs, "pat2");
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
                    if (is2pt) inc(ds, "dpat");
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
                    if (isTD) inc(ds, "fumbleTD");
                    if (is2pt) inc(ds, "fumblePAT");
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
                    if (is2pt) inc(rs, "pat2");
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
        const pct = atts > 0 ? ((comp / atts) * 100).toFixed(1) : "0.0";
        const ypc = comp > 0 ? (yards / comp).toFixed(1) : "0.0";
        return {
            playerId: p.playerId,
            playerName: p.playerName,
            playerPhoto: p.playerPhoto,
            teamName: p.teamName,
            atts,
            comp,
            yards,
            tds: p.tds || 0,
            pat: (p.pat1 || 0) + (p.pat2 || 0),
            ints: p.ints || 0,
            sacks: p.sacks || 0,
            safety: p.safety || 0,
            pct: parseFloat(pct),
            ypc: parseFloat(ypc),
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
            teamName: d.teamName,
            dint: d.dint || 0,
            dintTD,
            dtd,
            dpat: (d.dpat || 0) + (d.fumblePAT || 0),
            dsacks: d.dsacks || 0,
            dsafety: d.dsafety || 0,
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

    return {
        stats: aggregateStats(plays, rosterMap, teamNamesByAB),
        game,
        teamNames: teamNamesByAB,
    };
}

/**
 * Compute aggregated stats across all games in a league/season.
 * Returns per-player stats accumulated over all games.
 */
export async function computeSeasonStats(leagueId, orgId) {
    const games = await Game.find({ league: leagueId }).lean();
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

    // Accumulated stats across games
    const mergedPassing = {};
    const mergedReceiving = {};
    const mergedRushing = {};
    const mergedDefensive = {};
    const gamesPlayedByPlayer = {};

    for (const game of games) {
        const gid = String(game._id);
        const gamePlays = playsByGame[gid];
        if (!gamePlays || gamePlays.length === 0) continue;

        const { rosterMap, teamNamesByAB } = await buildRosterMap(game, orgId);
        const gameStats = aggregateStats(gamePlays, rosterMap, teamNamesByAB);

        // Helper to merge rows
        const mergeRows = (target, rows, fields) => {
            for (const row of rows) {
                if (!target[row.playerId]) {
                    target[row.playerId] = { ...row };
                } else {
                    for (const f of fields) {
                        target[row.playerId][f] = (target[row.playerId][f] || 0) + (row[f] || 0);
                    }
                }
                // Track games played
                if (!gamesPlayedByPlayer[row.playerId]) gamesPlayedByPlayer[row.playerId] = new Set();
                gamesPlayedByPlayer[row.playerId].add(gid);
            }
        };

        mergeRows(mergedPassing, gameStats.passing, ["atts", "comp", "yards", "tds", "pat", "ints", "sacks", "safety"]);
        mergeRows(mergedReceiving, gameStats.receiving, ["receptions", "yards", "tds", "pat"]);
        mergeRows(mergedRushing, gameStats.rushing, ["atts", "yards", "tds", "pat"]);
        mergeRows(mergedDefensive, gameStats.defensive, ["dint", "dintTD", "dtd", "dpat", "dsacks", "dsafety", "flagPulls"]);
    }

    // Recalculate derived fields
    const passingRows = Object.values(mergedPassing).map((p) => {
        const pct = p.atts > 0 ? ((p.comp / p.atts) * 100).toFixed(1) : "0.0";
        const ypc = p.comp > 0 ? (p.yards / p.comp).toFixed(1) : "0.0";
        return { ...p, pct: parseFloat(pct), ypc: parseFloat(ypc) };
    });

    const receivingRows = Object.values(mergedReceiving).map((r) => {
        const ypr = r.receptions > 0 ? (r.yards / r.receptions).toFixed(1) : "0.0";
        return { ...r, ypr: parseFloat(ypr) };
    });

    const rushingRows = Object.values(mergedRushing).map((r) => {
        const ypc = r.atts > 0 ? (r.yards / r.atts).toFixed(1) : "0.0";
        const gp = gamesPlayedByPlayer[r.playerId]?.size || 1;
        const rushAvgPerGame = (r.yards / gp).toFixed(1);
        return { ...r, ypc: parseFloat(ypc), gamesPlayed: gp, rushAvgPerGame: parseFloat(rushAvgPerGame) };
    });

    const defensiveRows = Object.values(mergedDefensive).map((d) => {
        const gp = gamesPlayedByPlayer[d.playerId]?.size || 1;
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
