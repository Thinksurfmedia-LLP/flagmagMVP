// Team standings order. CommonJS + dependency-free so it runs under
// `node --test`; shared by the standings API (which the xflagfootball site
// renders as-is) and the org game-stats page.
//
//   1. win percentage (higher first)
//   2. point differential, +/- (higher first) — not raw points-for: a team
//      that's -9 outranks one that's -22 even if the second scored more.
//   3. playoff seed (lower first; unseeded last) — only a final tiebreak, so
//      a 0-0 bracket still shows in seeded order, but once games are played
//      the record decides.

/**
 * @param {{pct: number, diff: number, seedNumber?: number|null}} a
 * @param {{pct: number, diff: number, seedNumber?: number|null}} b
 */
function compareStandings(a, b) {
    const seed = (r) => r.seedNumber ?? Infinity;
    return (b.pct - a.pct) || (b.diff - a.diff) || ((seed(a) - seed(b)) || 0);
}

module.exports = { compareStandings };
