const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb+srv://flagmag:TrdCmZa3RW6jagEI@cluster0.uzopg7p.mongodb.net/database?appName=Cluster0';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = path.join(__dirname, `backup-${timestamp}`);

async function backup() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.\n');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Backup folder: ${backupDir}\n`);

    for (const col of collections) {
        const name = col.name;
        const docs = await db.collection(name).find({}).toArray();
        const filePath = path.join(backupDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
        console.log(`  ✓ ${name} — ${docs.length} documents`);
    }

    console.log('\nBackup complete.');
    await mongoose.disconnect();
}

backup().catch(err => {
    console.error('Backup failed:', err);
    process.exit(1);
});
