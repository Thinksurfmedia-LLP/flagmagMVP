import dbConnect from "@/lib/dbConnect";
import ProductCategory from "@/models/ProductCategory";
import { requireSiteAdmin } from "@/lib/apiAuth";
import { normalizeCategoryInput } from "@/lib/store/productInput";
import { listCategoriesWithCounts, uniqueCategorySlug, serialize } from "@/lib/store/catalog";
import { ok, created, fail, readJson, handleError } from "@/lib/store/apiResponse";

const DUPLICATE = "A category with this name already exists";

// GET categories with active product counts (public)
export async function GET() {
    try {
        return ok(serialize(await listCategoriesWithCounts()));
    } catch (err) {
        return handleError("categories", err, DUPLICATE);
    }
}

// POST create category (site admin)
export async function POST(request) {
    try {
        const auth = await requireSiteAdmin();
        if (!auth.authorized) return auth.response;

        const body = await readJson(request);
        if (body === null) return fail("Invalid request body", 400);
        const input = normalizeCategoryInput(body);
        if (!input.ok) return fail(input.error, 400);

        await dbConnect();
        const slug = await uniqueCategorySlug(input.value.name);
        const category = await ProductCategory.create({ ...input.value, slug });
        return created(serialize(category));
    } catch (err) {
        return handleError("categories", err, DUPLICATE);
    }
}
