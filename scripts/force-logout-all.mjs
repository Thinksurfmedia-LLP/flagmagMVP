/**
 * Nightly force-logout-all cron.
 *
 * Bumps SiteSettings.globalSessionsInvalidatedAt to now, which makes every
 * JWT already issued — web, admin dashboard, or the flagmag stats mobile
 * app, in any org — fail the cutoff check in src/lib/auth.js on its very
 * next request. Both apps already react to that (see
 * src/components/AuthProvider.js and mobile-app/app/lib/api.js): they clear
 * localStorage/sessionStorage/the Cache API/service workers and bounce to
 * /login, so everyone comes back to a clean client on their next sign-in.
 *
 * Usage: node scripts/force-logout-all.mjs
 * Scheduled via PM2 (see ecosystem.force-logout-all.config.js) at 1am
 * America/Los_Angeles daily.
 */

import fs from "fs";
import mongoose from "mongoose";

function loadMongoUri() {
    if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
    for (const envFile of [".env.local", ".env"]) {
        if (!fs.existsSync(envFile)) continue;
        const lines = fs.readFileSync(envFile, "utf8").split("\n");
        const line = lines.find((l) => l.startsWith("MONGODB_URI"));
        if (line) return line.split("=").slice(1).join("=").trim();
    }
    throw new Error("MONGODB_URI not found in environment, .env.local, or .env");
}

const SiteSettingsSchema = new mongoose.Schema(
    { globalSessionsInvalidatedAt: { type: Date, default: null } },
    { timestamps: true, strict: false }
);
const SiteSettings = mongoose.models.SiteSettings || mongoose.model("SiteSettings", SiteSettingsSchema);

async function forceLogoutAll() {
    console.log(`[force-logout-all] Starting at ${new Date().toISOString()}`);
    await mongoose.connect(loadMongoUri());

    const cutoff = new Date();
    let settings = await SiteSettings.findOne();
    if (!settings) settings = new SiteSettings({});
    settings.globalSessionsInvalidatedAt = cutoff;
    await settings.save();

    console.log(`[force-logout-all] Triggered force logout at ${cutoff.toLocaleString()} (${cutoff.toISOString()})`);
    await mongoose.disconnect();
    console.log("[force-logout-all] Done.");
}

forceLogoutAll().catch((err) => {
    console.error("[force-logout-all] Failed:", err);
    process.exit(1);
});
