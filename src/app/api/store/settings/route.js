import { requireSiteAdmin } from "@/lib/apiAuth";
import { normalizeSettingsInput } from "@/lib/store/settingsInput";
import { getStoreSettings, saveStoreSettings } from "@/lib/store/settings";
import { ok, fail, readJson, handleError } from "@/lib/store/apiResponse";

// GET store settings (public)
export async function GET() {
    try {
        return ok(await getStoreSettings());
    } catch (err) {
        return handleError("settings", err);
    }
}

// PUT upsert store settings (site admin)
export async function PUT(request) {
    try {
        const auth = await requireSiteAdmin();
        if (!auth.authorized) return auth.response;

        const body = await readJson(request);
        if (body === null) return fail("Invalid request body", 400);
        const input = normalizeSettingsInput(body);
        if (!input.ok) return fail(input.error, 400);

        return ok(await saveStoreSettings(input.value));
    } catch (err) {
        return handleError("settings", err);
    }
}
