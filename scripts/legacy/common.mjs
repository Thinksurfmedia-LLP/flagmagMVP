import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");

export const REGISTRY = "legacyimports";
export const SYSTEM = "xflag-legacy";

// Minimal .env parser (same as scripts/backup-db.mjs) — no dotenv dependency.
export function loadEnv(envPath = path.join(rootDir, ".env")) {
    if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eq = trimmed.indexOf("=");
            if (eq === -1) continue;
            const key = trimmed.slice(0, eq).trim();
            let value = trimmed.slice(eq + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!(key in process.env)) process.env[key] = value;
        }
    }
    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI not found in .env");
        process.exit(1);
    }
}
