const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb+srv://flagmag:TrdCmZa3RW6jagEI@cluster0.uzopg7p.mongodb.net/database?appName=Cluster0';

const DENSTAR_ORG_ID = '6a17fb3bd4704adc02fe994e';

// SAFETY: IDs we must NEVER touch
const PROTECTED_ORG_IDS = [
    '69ce785e268fc7ba310d26ff', // Showtime Sportz
    '69f580a6e7729de622495f7a', // XFlagFootball
];

async function audit() {
    console.log('Connecting...');
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    console.log('Connected.\n');

    const report = {};

    // ── 1. Organization ──────────────────────────────────────────────
    const org = await db.collection('organizations').findOne({ _id: new mongoose.Types.ObjectId(DENSTAR_ORG_ID) });
    report.organization = { count: 1, docs: [{ _id: org._id, name: org.name }] };
    console.log(`Organization: ${org.name} (${org._id})`);

    // SAFETY CHECK
    if (PROTECTED_ORG_IDS.includes(DENSTAR_ORG_ID)) {
        console.error('ABORT: Denstar ID matches a protected org. Something is wrong.');
        process.exit(1);
    }

    // ── 2. Leagues under Denstar ─────────────────────────────────────
    const leagues = await db.collection('leagues').find({
        organization: new mongoose.Types.ObjectId(DENSTAR_ORG_ID)
    }).toArray();

    report.leagues = { count: leagues.length, docs: leagues.map(l => ({ _id: l._id, name: l.name })) };
    console.log(`\nLeagues (${leagues.length}):`);
    leagues.forEach(l => console.log(`  - ${l.name} (${l._id})`));

    const leagueIds = leagues.map(l => l._id);

    // ── 3. Seasons linked to Denstar leagues ─────────────────────────
    const seasonIds = [...new Set(leagues.filter(l => l.season).map(l => l.season.toString()))];
    const seasons = await db.collection('seasons').find({
        _id: { $in: seasonIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).toArray();

    report.seasons = { count: seasons.length, docs: seasons.map(s => ({ _id: s._id, name: s.name || s.title || s._id })) };
    console.log(`\nSeasons (${seasons.length}):`);
    seasons.forEach(s => console.log(`  - ${s.name || s.title || s._id} (${s._id})`));

    // ── 4. Teams in Denstar leagues ──────────────────────────────────
    const teams = await db.collection('teams').find({
        league: { $in: leagueIds }
    }).toArray();

    report.teams = { count: teams.length, docs: teams.map(t => ({ _id: t._id, name: t.name, league: t.league })) };
    console.log(`\nTeams (${teams.length}):`);
    teams.forEach(t => console.log(`  - ${t.name} (${t._id})`));

    const teamIds = teams.map(t => t._id);

    // ── 5. Games in Denstar leagues ──────────────────────────────────
    const games = await db.collection('games').find({
        league: { $in: leagueIds }
    }).toArray();

    report.games = { count: games.length, docs: games.map(g => ({ _id: g._id, league: g.league, homeTeam: g.homeTeam, awayTeam: g.awayTeam })) };
    console.log(`\nGames (${games.length})`);

    const gameIds = games.map(g => g._id);

    // ── 6. Plays in Denstar games ────────────────────────────────────
    const plays = await db.collection('plays').find({
        game: { $in: gameIds }
    }).toArray();

    report.plays = { count: plays.length, docs: plays.map(p => ({ _id: p._id, game: p.game })) };
    console.log(`Plays (${plays.length})`);

    // ── 7. GameStats in Denstar games ────────────────────────────────
    const gamestats = await db.collection('gamestats').find({
        game: { $in: gameIds }
    }).toArray();

    report.gamestats = { count: gamestats.length };
    console.log(`GameStats (${gamestats.length})`);

    // ── 8. Schedules for Denstar leagues ─────────────────────────────
    const schedules = await db.collection('schedules').find({
        leagueId: { $in: leagueIds }
    }).toArray();

    report.schedules = { count: schedules.length };
    console.log(`Schedules (${schedules.length})`);

    // ── 9. Players in Denstar teams ──────────────────────────────────
    const players = await db.collection('players').find({
        $or: [
            { team: { $in: teamIds } },
            { league: { $in: leagueIds } }
        ]
    }).toArray();

    report.players = { count: players.length, docs: players.map(p => ({ _id: p._id, name: `${p.firstName || ''} ${p.lastName || ''}`.trim(), team: p.team })) };
    console.log(`Players (${players.length})`);

    // ── 10. Users linked to Denstar org ──────────────────────────────
    const users = await db.collection('users').find({
        $or: [
            { organization: new mongoose.Types.ObjectId(DENSTAR_ORG_ID) },
            { organizations: new mongoose.Types.ObjectId(DENSTAR_ORG_ID) },
            { 'organizations.organizationId': new mongoose.Types.ObjectId(DENSTAR_ORG_ID) }
        ]
    }).toArray();

    report.users = { count: users.length, docs: users.map(u => ({ _id: u._id, email: u.email, name: `${u.firstName || ''} ${u.lastName || ''}`.trim() })) };
    console.log(`Users linked to Denstar org (${users.length})`);

    // ── 11. Activities linked to Denstar org or leagues ───────────────
    const activities = await db.collection('activities').find({
        $or: [
            { organization: new mongoose.Types.ObjectId(DENSTAR_ORG_ID) },
            { league: { $in: leagueIds } }
        ]
    }).toArray();

    report.activities = { count: activities.length };
    console.log(`Activities (${activities.length})`);

    // ── Save report ───────────────────────────────────────────────────
    const reportPath = path.join(__dirname, 'denstar-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n══════════════════════════════════════════');
    console.log('AUDIT SUMMARY — what will be deleted:');
    console.log('══════════════════════════════════════════');
    console.log(`  Organization  : 1 (Denstar)`);
    console.log(`  Leagues       : ${leagues.length}`);
    console.log(`  Seasons       : ${seasons.length}`);
    console.log(`  Teams         : ${teams.length}`);
    console.log(`  Games         : ${games.length}`);
    console.log(`  Plays         : ${plays.length}`);
    console.log(`  GameStats     : ${gamestats.length}`);
    console.log(`  Schedules     : ${schedules.length}`);
    console.log(`  Players       : ${players.length}`);
    console.log(`  Users (org)   : ${users.length}`);
    console.log(`  Activities    : ${activities.length}`);
    console.log('══════════════════════════════════════════');
    console.log(`\nFull report saved: ${reportPath}`);

    await mongoose.disconnect();
}

audit().catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
});
