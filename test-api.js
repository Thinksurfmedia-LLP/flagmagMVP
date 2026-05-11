// Test the actual API endpoint
fetch('http://localhost:3000/api/players?status=player', {
    headers: {
        'Cookie': document.cookie
    },
    credentials: 'include'
})
.then(r => r.json())
.then(data => {
    console.log('API Response:', data);
    console.log('Player count:', data.data?.length || 0);
    data.data?.forEach(p => {
        console.log(`  - ${p.name} (Team: ${p.presentTeam?.name || 'none'})`);
    });
})
.catch(e => console.error('Error:', e));
