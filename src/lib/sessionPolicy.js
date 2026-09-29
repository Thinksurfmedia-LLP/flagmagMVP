// Mandatory nightly logout for every session (website, admin, stats app).
//
// This used to depend on an external PM2 cron (scripts/force-logout-all.mjs)
// bumping SiteSettings.globalSessionsInvalidatedAt at midnight — which
// silently stopped running on the server, so sessions lived their full 7
// days and statisticians' logins ran out mid-game. Computing the cutoff here
// instead makes the policy impossible to "stop running": any token issued
// before the most recent scheduled logout time is rejected by lib/auth.js.
//
// Config (env): SESSION_DAILY_LOGOUT = "off" to disable,
// SESSION_DAILY_LOGOUT_TZ (IANA, default America/Los_Angeles),
// SESSION_DAILY_LOGOUT_HOUR (0-23, default 0 = midnight).
// Pure CommonJS so it runs under `node --test`.

const DEFAULT_TZ = "America/Los_Angeles";
const DAY_MS = 24 * 60 * 60 * 1000;

function isValidTimeZone(tz) {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/** @returns {{ enabled: boolean, timeZone: string, hour: number }} */
function readPolicy(env = process.env) {
    const hour = Number(env.SESSION_DAILY_LOGOUT_HOUR ?? 0);
    const tz = env.SESSION_DAILY_LOGOUT_TZ || DEFAULT_TZ;
    return {
        enabled: String(env.SESSION_DAILY_LOGOUT || "on").toLowerCase() !== "off",
        timeZone: isValidTimeZone(tz) ? tz : DEFAULT_TZ,
        hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0,
    };
}

// Wall-clock date/time parts of `date` in `timeZone`.
function partsIn(date, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

// UTC instant of wall-clock y-m-d h:00 in `timeZone` (DST-safe: corrects the
// guess by the zone's offset at that instant, twice for transition days).
function zonedToUtc(y, m, d, h, timeZone) {
    let guess = Date.UTC(y, m - 1, d, h);
    for (let i = 0; i < 2; i++) {
        const p = partsIn(new Date(guess), timeZone);
        const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
        guess -= asUtc - Date.UTC(y, m - 1, d, h);
    }
    return new Date(guess);
}

/** Most recent scheduled logout at or before `now` (e.g. last midnight Pacific). */
function lastScheduledLogout(now, { timeZone, hour }) {
    const p = partsIn(now, timeZone);
    let cutoff = zonedToUtc(p.y, p.m, p.d, hour, timeZone);
    if (cutoff > now) {
        const prev = partsIn(new Date(now.getTime() - DAY_MS), timeZone);
        cutoff = zonedToUtc(prev.y, prev.m, prev.d, hour, timeZone);
    }
    return cutoff;
}

module.exports = { readPolicy, lastScheduledLogout };
