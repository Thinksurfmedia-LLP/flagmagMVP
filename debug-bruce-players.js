const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/flagmag').then(async () => {
    const User = mongoose.model('User', new mongoose.Schema({}, {strict: false}));
    const Team = mongoose.model('Team', new mongoose.Schema({}, {strict: false}));
    const Player = mongoose.model('Player', new mongoose.Schema({}, {strict: false}));
    
    // Get Bruce's data
    const bruce = await User.findOne({email: 'bruce@showtime.com'}).lean();
    console.log('\n=== Bruce Data ===');
    console.log('Organization:', bruce.organization);
    console.log('roleOrganizations:', JSON.stringify(bruce.roleOrganizations, null, 2));
    
    const bruceOrgId = bruce.organization || bruce.roleOrganizations?.organizer?.[0];
    console.log('\nUsing Organization ID:', bruceOrgId);
    
    // Get all teams in Bruce's organization
    const bruceTeams = await Team.find({ organization: bruceOrgId }).lean();
    console.log('\n=== Teams in Showtime Test ===');
    console.log('Count:', bruceTeams.length);
    bruceTeams.forEach(t => {
        console.log(`  - ${t.name} (${t.players?.length || 0} players)`);
    });
    
    // Get all player IDs from Bruce's teams
    const brucePlayerIds = new Set();
    for (const team of bruceTeams) {
        for (const p of (team.players || [])) {
            if (p.player) brucePlayerIds.add(p.player.toString());
        }
    }
    console.log('\nPlayer IDs from Showtime teams:', Array.from(brucePlayerIds));
    
    // Check all players
    const allPlayers = await Player.find({status: 'player'}).lean();
    console.log('\n=== All Players ===');
    console.log('Total:', allPlayers.length);
    allPlayers.forEach(p => {
        const inBruceOrg = brucePlayerIds.has(p._id.toString());
        console.log(`  - ${p.name} (ID: ${p._id}): ${inBruceOrg ? 'VISIBLE to Bruce' : 'NOT visible'}`);
    });
    
    // Also check players with organization field
    const orgPlayers = await Player.find({ organization: bruceOrgId }).lean();
    console.log('\n=== Players with organization field = Showtime ===');
    console.log('Count:', orgPlayers.length);
    
    mongoose.disconnect();
}).catch(e => console.error(e));
