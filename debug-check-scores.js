const fs = require('fs');
const mongoose = require('mongoose');

const envContent = fs.readFileSync(__dirname + '/.env', 'utf8');
const line = envContent.split('\n').find(l => l.startsWith('MONGODB_URI=') && !l.startsWith('#'));
const uri = line.slice('MONGODB_URI='.length).trim();

mongoose.connect(uri).then(async () => {
    const Game = mongoose.model('Game', new mongoose.Schema({}, { strict: false }));
    const Play = mongoose.model('Play', new mongoose.Schema({}, { strict: false }));

    const games = await Game.find({
        $or: [
            { 'teamA.name': /blue grass/i, 'teamB.name': /g team/i },
            { 'teamA.name': /g team/i, 'teamB.name': /blue grass/i },
            { 'teamA.name': /chozen/i },
            { 'teamB.name': /chozen/i },
            { 'teamA.name': /street smart/i },
            { 'teamB.name': /street smart/i },
            { 'teamA.name': /hmyg/i },
            { 'teamB.name': /hmyg/i },
        ],
    }).lean();

    console.log(`Found ${games.length} candidate games\n`);

    for (const g of games) {
        console.log('========');
        console.log('_id:', String(g._id));
        console.log('teamA:', g.teamA?.name, 'score:', g.teamA?.score);
        console.log('teamB:', g.teamB?.name, 'score:', g.teamB?.score);
        console.log('status:', g.status, 'date:', g.date);
        console.log('updatedAt:', g.updatedAt);

        const plays = await Play.find({ game: g._id }).sort({ createdAt: 1 }).lean();
        console.log(`  -> ${plays.length} plays found for this game`);
        let sumA = 0, sumB = 0;
        plays.forEach(p => {
            const pts = Number(p.ptsAdded) || 0;
            if (pts > 0) {
                console.log(`     play ${String(p._id)} type=${p.type} targetTeam=${p.targetTeam} ptsAdded=${p.ptsAdded} points="${p.points}" createdAt=${p.createdAt}`);
                if (p.targetTeam === 'A') sumA += pts;
                if (p.targetTeam === 'B') sumB += pts;
            }
        });
        console.log(`  -> sum of scoring plays: A=${sumA} B=${sumB}  vs actual Game score: A=${g.teamA?.score} B=${g.teamB?.score}`);
    }

    await mongoose.disconnect();
}).catch((e) => {
    console.error('Connection error:', e.message);
    process.exit(1);
});
