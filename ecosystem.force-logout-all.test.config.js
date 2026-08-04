/**
 * TEMPORARY test-only schedule — DO NOT deploy to prod.
 * Fires once at 6:30 AM America/Los_Angeles (= 7:00 PM IST) to verify PM2
 * cron_restart timing works before trusting the real 1am schedule.
 *
 * Run:   pm2 start ecosystem.force-logout-all.test.config.js
 * Watch: pm2 logs flagmag-force-logout-all-test
 * Clean up after test:  pm2 delete flagmag-force-logout-all-test
 */
module.exports = {
    apps: [
        {
            name: "flagmag-force-logout-all-test",
            cwd: __dirname,
            script: "scripts/force-logout-all.mjs",
            cron_restart: "35 6 * * *",
            time_zone: "America/Los_Angeles",
            autorestart: false,
            watch: false,
        },
    ],
};
