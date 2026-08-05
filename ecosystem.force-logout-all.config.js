/**
 * PM2 scheduled job: nightly force-logout-all at 12am (midnight) America/Los_Angeles
 * (handles PDT/PST automatically via the IANA tz — no manual DST offset).
 *
 * Setup on the VPS (one-time):
 *   pm2 start ecosystem.force-logout-all.config.js
 *   pm2 save
 *
 * PM2 runs the script once per cron tick (cron_restart) and leaves it
 * stopped in between (autorestart: false) — this is a scheduled task, not
 * a long-running server process.
 */
module.exports = {
    apps: [
        {
            name: "flagmag-force-logout-all",
            cwd: __dirname,
            script: "scripts/force-logout-all.mjs",
            cron_restart: "0 0 * * *",
            time_zone: "America/Los_Angeles",
            autorestart: false,
            watch: false,
        },
    ],
};
