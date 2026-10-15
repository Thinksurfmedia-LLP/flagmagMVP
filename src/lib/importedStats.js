// Pure helpers for stats imported from the legacy XFlag system.
// CommonJS + dependency-free so it runs under `node --test`; the DB-backed
// side lives in statsAggregation.js (which merges these rows with the
// Play-derived ones) and the ImportedStatLine model.
//
// Why this exists: the old XFlag site stored per-player, per-game TOTALS
// (its `stats` table) — for most historical games there is no play-by-play
// left to replay. Rather than inventing fake Play documents, each old total
// is kept verbatim as an ImportedStatLine and converted here into rows with
// exactly the same shape aggregateStats() produces, so every reader
// (box score, league stats, season leaderboard) treats them identically.

// Legacy QB rating (5 factors) — ported from the old Xflag PHP system
// (LiveGameManageController::calcscore, factors a-e) so ratings keep matching
// what the old site produced. a=completion%, b=TD rate, c=INT rate, d=yards
// per attempt — each rounded to 2 decimals and clamped to [0, 2.375]; e=PAT
// points per touchdown minus a fixed baseline (0.66), left UNCLAMPED, same
// as the legacy formula. Divisor 0.06 is equivalent to "/6 * 100".
function computePasserRating(atts, comp, yards, tds, ints, pat) {
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

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const oneDecimal = (n, d) => (d > 0 ? parseFloat((n / d).toFixed(1)) : 0);

/**
 * Map one row of the legacy `stats` table onto FlagMag's category fields.
 * Legacy PAT columns already hold points (1 or 2 per conversion) — the same
 * unit FlagMag's `pat` uses — so they copy across unchanged. The old system
 * kept a single DTD for interception AND fumble return TDs (fumble TDs were
 * practically never recorded), so it fills both dtd and dintTD; `fumbles`
 * (recoveries) had no per-game column there and stays 0.
 */
function legacyStatsToCategories(row) {
    return {
        passing: {
            atts: num(row.PAttempts),
            comp: num(row.PCompletions),
            yards: num(row.PYards),
            tds: num(row.PTD),
            pat: num(row.PPAT),
            ints: num(row.PINT),
            sacks: num(row.PSacks),
            safety: num(row.PSafety),
        },
        receiving: {
            receptions: num(row.RReceptions),
            yards: num(row.RYards),
            tds: num(row.RTD),
            pat: num(row.RPAT),
        },
        rushing: {
            atts: num(row.RushAttempts),
            yards: num(row.RushYards),
            tds: num(row.RushTD),
            pat: num(row.RushPAT),
        },
        defensive: {
            dint: num(row.DINT),
            dintTD: num(row.DTD),
            dtd: num(row.DTD),
            dpat: num(row.DPAT),
            dsacks: num(row.DSacks),
            dsafety: num(row.DSafety),
            fumbles: 0,
            flagPulls: num(row.FlagPull),
        },
    };
}

function hasCategoryStats(category) {
    if (!category) return false;
    return Object.values(category).some((v) => num(v) !== 0);
}

/**
 * Convert imported lines into { passing, receiving, rushing, defensive }
 * rows matching aggregateStats() output. A player only gets a row in a
 * category they actually recorded something in — same as live plays, where
 * a row exists only once the player appears in a play of that kind.
 *
 * @param {Array<{playerId, playerName, playerPhoto, jerseyNumber, teamName,
 *   passing, receiving, rushing, defensive}>} lines
 */
function importedLinesToStatRows(lines) {
    const out = { passing: [], receiving: [], rushing: [], defensive: [] };

    for (const line of lines) {
        const base = {
            playerId: String(line.playerId),
            playerName: line.playerName || "",
            playerPhoto: line.playerPhoto || "",
            jerseyNumber: line.jerseyNumber != null ? String(line.jerseyNumber) : "",
            teamName: line.teamName || "",
        };

        const p = line.passing;
        if (hasCategoryStats(p)) {
            const atts = num(p.atts), comp = num(p.comp), yards = num(p.yards);
            const tds = num(p.tds), ints = num(p.ints), pat = num(p.pat);
            out.passing.push({
                ...base,
                atts, comp, yards, tds, pat, ints,
                sacks: num(p.sacks),
                safety: num(p.safety),
                pct: atts > 0 ? parseFloat(((comp / atts) * 100).toFixed(1)) : 0,
                ypc: oneDecimal(yards, comp),
                rate: computePasserRating(atts, comp, yards, tds, ints, pat),
            });
        }

        const r = line.receiving;
        if (hasCategoryStats(r)) {
            const receptions = num(r.receptions), yards = num(r.yards);
            out.receiving.push({
                ...base,
                receptions, yards,
                tds: num(r.tds),
                pat: num(r.pat),
                ypr: oneDecimal(yards, receptions),
            });
        }

        const ru = line.rushing;
        if (hasCategoryStats(ru)) {
            const atts = num(ru.atts), yards = num(ru.yards);
            out.rushing.push({
                ...base,
                atts, yards,
                tds: num(ru.tds),
                pat: num(ru.pat),
                ypc: oneDecimal(yards, atts),
            });
        }

        const d = line.defensive;
        if (hasCategoryStats(d)) {
            out.defensive.push({
                ...base,
                dint: num(d.dint),
                dintTD: num(d.dintTD),
                dtd: num(d.dtd),
                dpat: num(d.dpat),
                dsacks: num(d.dsacks),
                dsafety: num(d.dsafety),
                fumbles: num(d.fumbles),
                flagPulls: num(d.flagPulls),
            });
        }
    }

    return out;
}

module.exports = {
    computePasserRating,
    legacyStatsToCategories,
    hasCategoryStats,
    importedLinesToStatRows,
};
