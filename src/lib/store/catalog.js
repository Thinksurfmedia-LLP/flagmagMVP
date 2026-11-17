// Server-only catalog data layer for the store. Imports Mongoose models.
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import ProductCategory from "@/models/ProductCategory";
import { buildCatalogFilter, sortSizes } from "@/lib/store/catalogQuery";
import { summarizeByCategory } from "@/lib/store/categoryStats";
import { nextFreeSlug, slugify, MAX_SLUG_LENGTH } from "@/lib/store/slug";
import { PRODUCT_STATUSES } from "@/lib/store/productInput";

const PRICE_STEP = 10;
const NAME_COLLATION = { locale: "en", strength: 2 };
const WISHLIST_SLUG_RE = new RegExp(`^[a-z0-9-]{1,${MAX_SLUG_LENGTH}}$`);
const MAX_SLUGS = 50;
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

/** Active products for a list of slugs (used by the wishlist). Invalid entries are ignored. */
export async function listProductsBySlugs(slugs) {
    const valid = [...new Set(slugs)].filter((s) => typeof s === "string" && WISHLIST_SLUG_RE.test(s)).slice(0, MAX_SLUGS);
    if (valid.length === 0) return [];
    await dbConnect();
    return Product.find({ slug: { $in: valid }, status: "active" }).populate("category", "name slug").lean();
}

export async function getProductById(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    await dbConnect();
    return Product.findById(id).populate("category", "name slug").lean();
}

export async function listCategoriesWithCounts() {
    await dbConnect();
    const [categories, active] = await Promise.all([
        ProductCategory.find().sort({ sortOrder: 1, name: 1 }).lean(),
        Product.find({ status: "active" }).sort({ createdAt: -1, _id: 1 }).select("category price compareAtPrice images").lean(),
    ]);
    const stats = summarizeByCategory(active);
    const counts = new Map();
    for (const p of active) counts.set(String(p.category), (counts.get(String(p.category)) || 0) + 1);
    return categories.map((c) => ({
        _id: c._id,
        name: c.name,
        slug: c.slug,
        image: c.image,
        sortOrder: c.sortOrder,
        activeCount: counts.get(String(c._id)) || 0,
        minPrice: stats.get(String(c._id))?.minPrice ?? null,
        bestDiscountPercent: stats.get(String(c._id))?.bestDiscountPercent ?? null,
        coverImage: stats.get(String(c._id))?.coverImage ?? null,
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
