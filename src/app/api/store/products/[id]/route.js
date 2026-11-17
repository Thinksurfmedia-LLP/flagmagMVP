import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import ProductCategory from "@/models/ProductCategory";
import { requireSiteAdmin } from "@/lib/apiAuth";
import { normalizeProductInput } from "@/lib/store/productInput";
import { getProductById, getProductBySlug, uniqueProductSlug, serialize } from "@/lib/store/catalog";
import { ok, fail, readJson, handleError, HEX_ID_RE } from "@/lib/store/apiResponse";

const DUPLICATE = "A product with this name already exists";
const NOT_FOUND = "Product not found";

// GET by id (site admin, any status) or by slug (public, active only)
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        let product;
        if (HEX_ID_RE.test(id)) {
            const auth = await requireSiteAdmin();
            if (!auth.authorized) return auth.response;
            product = await getProductById(id);
        } else {
            product = await getProductBySlug(id);
        }
        if (!product) return fail(NOT_FOUND, 404);
        return ok(serialize(product));
    } catch (err) {
        return handleError("products/[id]", err, DUPLICATE);
    }
}

// PUT full replace of editable fields (site admin); re-slugs only when the name changed
export async function PUT(request, { params }) {
    try {
        const auth = await requireSiteAdmin();
        if (!auth.authorized) return auth.response;

        const { id } = await params;
        const body = await readJson(request);
        if (body === null) return fail("Invalid request body", 400);
        const input = normalizeProductInput(body);
        if (!input.ok) return fail(input.error, 400);

        if (!HEX_ID_RE.test(id)) return fail(NOT_FOUND, 404);
        await dbConnect();
        const existing = await Product.findById(id).select("name").lean();
        if (!existing) return fail(NOT_FOUND, 404);
        if (!(await ProductCategory.exists({ _id: input.value.category }))) return fail("Category not found", 400);

        const update = { ...input.value };
        if (update.name !== existing.name) update.slug = await uniqueProductSlug(update.name, id);
        await Product.findByIdAndUpdate(id, update, { runValidators: true });
        return ok(serialize(await getProductById(id)));
    } catch (err) {
        return handleError("products/[id]", err, DUPLICATE);
    }
}

// DELETE is a soft delete: the product is archived so future orders can still reference it
export async function DELETE(request, { params }) {
    try {
        const auth = await requireSiteAdmin();
        if (!auth.authorized) return auth.response;

        const { id } = await params;
        if (!HEX_ID_RE.test(id)) return fail(NOT_FOUND, 404);
        await dbConnect();
        const product = await Product.findByIdAndUpdate(id, { status: "archived" }, { new: true });
        if (!product) return fail(NOT_FOUND, 404);
        return ok(serialize(product));
    } catch (err) {
        return handleError("products/[id]", err, DUPLICATE);
    }
}
