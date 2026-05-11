const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/flagmag').then(async () => {
    const User = mongoose.model('User', new mongoose.Schema({}, {strict: false}));
    
    const users = await User.find({
        email: {$in: ['bruce@showtime.com', 'anne@xflag.com']}
    }).lean();
    
    console.log('\n=== Full User Data ===');
    users.forEach(u => {
        console.log('\nUser:', u.name, '(' + u.email + ')');
        console.log('  organization:', u.organization);
        console.log('  role:', u.role);
        console.log('  roles:', u.roles);
        console.log('  roleOrganizations:', JSON.stringify(u.roleOrganizations, null, 2));
    });
    
    mongoose.disconnect();
}).catch(e => console.error(e));
