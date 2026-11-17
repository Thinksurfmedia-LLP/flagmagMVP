// Server-only catalog data layer for the store. Imports Mongoose models.
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import ProductCategory from "@/models/ProductCategory";
import { buildCatalogFilter, sortSizes } from "@/lib/store/catalogQuery";
import { nextFreeSlug, slugify } from "@/lib/store/slug";
import { PRODUCT_STATUSES } from "@/lib/store/productInput";

const PRICE_STEP = 10;
const NAME_COLLATION = { locale: "en", strength: 2 };
const SLUG_BASE_RE = /^[a-z0-9-]+$/;

export function serialize(doc) {
    return JSON.parse(JSON.stringify(doc));
}

const emptyResult = (page) => ({ items: [], total: 0, page, pageCount: 1 });

export async function listProducts(query, { includeDrafts = false, status } = {}) {
    await dbConnect();
    let categoryId;
    if (query.category) {
        const category = await ProductCategory.findOne({ slug: query.category }).select("_id").lean();
        if (!category) return emptyResult(query.page);
        categoryId = category._id;
    }
    const { filter, sort, skip, limit } = buildCatalogFilter(query, { categoryId, includeDrafts });
    if (includeDrafts && PRODUCT_STATUSES.includes(status)) filter.status = status;

    // Case-insensitive name order; other sorts skip collation so they keep their indexes.
    const itemsQuery = Product.find(filter).sort(sort).skip(skip).limit(limit).populate("category", "name slug");
    if (query.sort === "name") itemsQuery.collation(NAME_COLLATION);
    const [total, items] = await Promise.all([Product.countDocuments(filter), itemsQuery.lean()]);
    return { items, total, page: query.page, pageCount: Math.max(1, Math.ceil(total / limit)) };
}

export async function getProductBySlug(slug, { includeDrafts = false } = {}) {
    await dbConnect();
    const filter = { slug: String(slug) };
    if (!includeDrafts) filter.status = "active";
    return Product.findOne(filter).populate("category", "name slug").lean();
}

export async function getProductById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    await dbConnect();
    return Product.findById(id).populate("category", "name slug").lean();
}

export async function listCategoriesWithCounts() {
    await dbConnect();
    const [categories, counts] = await Promise.all([
        ProductCategory.find().sort({ sortOrder: 1, name: 1 }).lean(),
        Product.aggregate([
            { $match: { status: "active" } },
            { $group: { _id: "$category", activeCount: { $sum: 1 } } },
        ]),
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.activeCount]));
    return categories.map((c) => ({
        _id: c._id,
        name: c.name,
        slug: c.slug,
        image: c.image,
        sortOrder: c.sortOrder,
        activeCount: byId.get(String(c._id)) || 0,
    }));
}

export async function getFacetOptions() {
    await dbConnect();
    const [variantRows, priceRows] = await Promise.all([
        Product.find({ status: "active" }).select("variants.color variants.colorHex variants.size").lean(),
        Product.find({ status: "active" }).sort({ price: -1 }).limit(1).select("price").lean(),
    ]);
    const colors = new Map();
    const sizes = new Set();
    for (const product of variantRows) {
        for (const v of product.variants || []) {
            const color = (v.color || "").trim();
            if (color) {
                const key = color.toLowerCase();
                const existing = colors.get(key);
                if (!existing) colors.set(key, { name: color, hex: v.colorHex || "" });
                else if (!existing.hex && v.colorHex) existing.hex = v.colorHex;
            }
            const size = (v.size || "").trim();
            if (size) sizes.add(size);
        }
    }
    const top = priceRows[0]?.price || 0;
    return {
        colors: [...colors.values()],
        sizes: sortSizes([...sizes]),
        maxPrice: Math.max(PRICE_STEP, Math.ceil(top / PRICE_STEP) * PRICE_STEP),
    };
}

async function uniqueSlug(Model, name, fallback, excludeId) {
    await dbConnect();
    const base = slugify(name) || fallback;
    if (!SLUG_BASE_RE.test(base)) throw new Error("Invalid slug base");
    const filter = { slug: { $regex: `^${base}(-[0-9]+)?$` } };
    if (excludeId && mongoose.isValidObjectId(excludeId)) {
        filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
    }
    const rows = await Model.find(filter).select("slug").lean();
    return nextFreeSlug(base, new Set(rows.map((r) => r.slug)));
}

// Excluding the doc's own row means its current slug counts as free, so a
// rename that keeps the same base keeps the same slug.
export const uniqueProductSlug = (name, excludeId) => uniqueSlug(Product, name, "product", excludeId);
export const uniqueCategorySlug = (name, excludeId) => uniqueSlug(ProductCategory, name, "category", excludeId);
