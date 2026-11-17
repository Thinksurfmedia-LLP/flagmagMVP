import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import ProductCategory from "@/models/ProductCategory";
import { requireSiteAdmin } from "@/lib/apiAuth";
import { normalizeProductInput } from "@/lib/store/productInput";
import { parseCatalogQuery } from "@/lib/store/catalogQuery";
import { listProducts, listProductsBySlugs, uniqueProductSlug, serialize } from "@/lib/store/catalog";
import { ok, created, fail, readJson, handleError } from "@/lib/store/apiResponse";

const DUPLICATE = "A product with this name already exists";

// GET products. Public lists active only; ?scope=admin needs a site admin and includes drafts.
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const slugsParam = searchParams.get("slugs");
        if (slugsParam !== null && searchParams.get("scope") !== "admin") {
            const items = await listProductsBySlugs(slugsParam.split(",").map((s) => s.trim()));
            return ok(serialize(items), undefined, { meta: { total: items.length, page: 1, pageCount: 1 } });
        }
        const options = {};
        if (searchParams.get("scope") === "admin") {
            const auth = await requireSiteAdmin();
            if (!auth.authorized) return auth.response;
            options.includeDrafts = true;
            options.status = searchParams.get("status") || undefined;
        }
        const { items, total, page, pageCount } = await listProducts(parseCatalogQuery(searchParams), options);
        return ok(serialize(items), undefined, { meta: { total, page, pageCount } });
    } catch (err) {
        return handleError("products", err, DUPLICATE);
    }
}

// POST create product (site admin)
export async function POST(request) {
    try {
        const auth = await requireSiteAdmin();
        if (!auth.authorized) return auth.response;

        const body = await readJson(request);
        if (body === null) return fail("Invalid request body", 400);
        const input = normalizeProductInput(body);
        if (!input.ok) return fail(input.error, 400);

        await dbConnect();
        if (!(await ProductCategory.exists({ _id: input.value.category }))) return fail("Category not found", 400);

        const slug = await uniqueProductSlug(input.value.name);
        const product = await Product.create({ ...input.value, slug });
        return created(serialize(product));
    } catch (err) {
        return handleError("products", err, DUPLICATE);
    }
}
