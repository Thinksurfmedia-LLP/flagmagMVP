const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/flagmag').then(async () => {
    const User = mongoose.model('User', new mongoose.Schema({}, {strict: false}));
    const Team = mongoose.model('Team', new mongoose.Schema({}, {strict: false}));
    const Org = mongoose.model('Organization', new mongoose.Schema({}, {strict: false}));
    
    const users = await User.find({
        email: {$in: ['bruce@showtime.com', 'anne@xflag.com']}
    }).select('name email organization').lean();
    console.log('\n=== Users ===');
    console.log(JSON.stringify(users, null, 2));
    
    const orgs = await Org.find({}).select('name').lean();
    console.log('\n=== Organizations ===');
    console.log(JSON.stringify(orgs, null, 2));
    
    const teams = await Team.find({
        name: {$in: ['Strikers', 'Challengers']}
    }).select('name organization').lean();
    console.log('\n=== Teams ===');
    console.log(JSON.stringify(teams, null, 2));
    
    // Update users with their organizations
    console.log('\n=== Updating Users ===');
    const showtimeOrg = orgs.find(o => o.name === 'Showtime Test');
    const xflagOrg = orgs.find(o => o.name === 'XFlag Test');
    
    if (showtimeOrg && xflagOrg) {
        await User.updateOne({email: 'bruce@showtime.com'}, {$set: {organization: showtimeOrg._id}});
        console.log('Updated Bruce with Showtime Test organization');
        
        await User.updateOne({email: 'anne@xflag.com'}, {$set: {organization: xflagOrg._id}});
        console.log('Updated Anne with XFlag Test organization');
    }
    
    mongoose.disconnect();
}).catch(e => console.error(e));
