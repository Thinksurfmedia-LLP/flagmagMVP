import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import ProductCategory from "@/models/ProductCategory";
import { requireSiteAdmin } from "@/lib/apiAuth";
import { normalizeCategoryInput } from "@/lib/store/productInput";
import { uniqueCategorySlug, serialize } from "@/lib/store/catalog";
import { ok, fail, readJson, handleError } from "@/lib/store/apiResponse";

const DUPLICATE = "A category with this name already exists";
const NOT_FOUND = "Category not found";

// PUT update category (site admin); re-slugs only when the name changed
export async function PUT(request, { params }) {
    try {
        const auth = await requireSiteAdmin();
        if (!auth.authorized) return auth.response;

        const { id } = await params;
        const body = await readJson(request);
        if (body === null) return fail("Invalid request body", 400);
        const input = normalizeCategoryInput(body);
        if (!input.ok) return fail(input.error, 400);

        if (!mongoose.isValidObjectId(id)) return fail(NOT_FOUND, 404);
        await dbConnect();
        const existing = await ProductCategory.findById(id).select("name").lean();
        if (!existing) return fail(NOT_FOUND, 404);

        const update = { ...input.value };
        if (update.name !== existing.name) update.slug = await uniqueCategorySlug(update.name, id);
        const updated = await ProductCategory.findByIdAndUpdate(id, update, { new: true, runValidators: true });
        return ok(serialize(updated));
    } catch (err) {
        return handleError("categories/[id]", err, DUPLICATE);
    }
}

// DELETE category (site admin); blocked while any product references it
export async function DELETE(request, { params }) {
    try {
        const auth = await requireSiteAdmin();
        if (!auth.authorized) return auth.response;

        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return fail(NOT_FOUND, 404);
        await dbConnect();
        const existing = await ProductCategory.findById(id).select("_id").lean();
        if (!existing) return fail(NOT_FOUND, 404);

        const count = await Product.countDocuments({ category: id });
        if (count > 0) return fail(`Move or delete the ${count} products in this category first`, 409);

        await ProductCategory.deleteOne({ _id: id });
        return ok({ _id: id });
    } catch (err) {
        return handleError("categories/[id]", err, DUPLICATE);
    }
}
