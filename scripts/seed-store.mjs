// Seed the store's starting categories and the old site's products (as drafts).
//
//   node --import ./scripts/lib/alias-loader.mjs scripts/seed-store.mjs [--apply]
//
// No flag = DRY RUN (reads only, prints the plan; connects with autoCreate and
// autoIndex off so Mongoose creates no collections or indexes). --apply upserts by slug with
// $setOnInsert only, so anything an admin later edits is never overwritten and
// re-running is safe. Categories are matched by slug OR name (name is unique).
//
// SAFETY: .env may point at a production cluster. The target host/db is printed
// first; set MONGODB_URI in the environment to override .env.

import mongoose from "mongoose";
import ProductCategory from "@/models/ProductCategory";
import Product from "@/models/Product";
import { slugify } from "@/lib/store/slug.js";
import { normalizeProductInput } from "@/lib/store/productInput.js";
import { loadEnv } from "./legacy/common.mjs";

const IMAGE = "/assets/images/product1.jpg";
const SIZES = ["S", "M", "L", "XL", "XXL"];
const PLACEHOLDER_ID = "0".repeat(24);

const CATEGORIES = ["Apparel", "Jerseys", "Uniforms", "Accessories", "Flag Belts"].map((name, i) => ({
    name,
    slug: slugify(name),
    sortOrder: i + 1,
}));

const sizedVariants = SIZES.map((size) => ({ size, color: "", stock: 0 }));
const PRODUCTS = [
    { name: "Customized Full Uniforms", category: "Uniforms", price: 45, variants: sizedVariants },
    { name: "Customized Hooded Jerseys", category: "Jerseys", price: 27, variants: sizedVariants },
    { name: "Customized Tackle Twill Jerseys", category: "Jerseys", price: 45, variants: sizedVariants },
    { name: "Customized Backpack", category: "Accessories", price: 35, variants: [{ size: "", color: "", stock: 0 }] },
];

/** Host and db name with credentials masked. */
function describeTarget(uri) {
    const m = uri.match(/^[a-z+]+:\/\/(?:([^:@/]+)(?::[^@]*)?@)?([^/?]+)\/?([^?]*)/i);
    if (!m) return "(unparseable MONGODB_URI)";
    const [, user, host, db] = m;
    return `${user ? `${user}:***@` : ""}${host}/${db || "(default)"}`;
}

const findCategory = (c) => ProductCategory.findOne({ $or: [{ slug: c.slug }, { name: c.name }] }).lean();

async function seedCategories(apply) {
    let created = 0;
    let skipped = 0;
    for (const c of CATEGORIES) {
        const existing = await findCategory(c);
        if (existing) {
            skipped += 1;
            console.log(`  skip    category ${c.name} (exists as slug "${existing.slug}")`);
            continue;
        }
        console.log(`  ${apply ? "create" : "would create"} category ${c.name} (sortOrder ${c.sortOrder})`);
        if (apply) {
            const now = new Date();
            await ProductCategory.updateOne(
                { slug: c.slug },
                { $setOnInsert: { name: c.name, slug: c.slug, image: "", sortOrder: c.sortOrder, createdAt: now, updatedAt: now } },
                { upsert: true, timestamps: false }
            );
        }
        created += 1;
    }
    return { created, skipped };
}

async function categoryIds() {
    const ids = new Map();
    for (const c of CATEGORIES) {
        const found = await findCategory(c);
        ids.set(c.name, found ? String(found._id) : null);
    }
    return ids;
}

async function seedProducts(ids, apply) {
    let created = 0;
    let skipped = 0;
    for (const p of PRODUCTS) {
        const categoryId = ids.get(p.category);
        if (apply && !categoryId) throw new Error(`Category "${p.category}" missing after seeding`);
        // Dry run before categories exist: validate against a placeholder id.
        const result = normalizeProductInput({
            name: p.name,
            category: categoryId || PLACEHOLDER_ID,
            images: [IMAGE],
            price: p.price,
            variants: p.variants,
            status: "draft",
        });
        if (!result.ok) throw new Error(`Seed product "${p.name}" invalid: ${result.error}`);
        const doc = result.value;
        const slug = slugify(doc.name);
        if (await Product.exists({ slug })) {
            skipped += 1;
            console.log(`  skip    product ${doc.name} (slug "${slug}" exists)`);
            continue;
        }
        const skus = doc.variants.map((v) => v.sku).join(", ");
        console.log(`  ${apply ? "create" : "would create"} product ${doc.name} [${p.category}] $${doc.price} draft; SKUs: ${skus}`);
        if (apply) {
            const now = new Date();
            await Product.updateOne(
                { slug },
                { $setOnInsert: { ...doc, slug, organization: null, createdAt: now, updatedAt: now } },
                { upsert: true, timestamps: false }
            );
        }
        created += 1;
    }
    return { created, skipped };
}

async function main() {
    const apply = process.argv.includes("--apply");
    loadEnv();
    console.log(`Target database: ${describeTarget(process.env.MONGODB_URI)}`);
    console.log(apply ? "Mode: APPLY" : "Mode: DRY RUN (pass --apply to write)");
    // Mongoose creates collections/indexes on connect by default; keep a dry run read-only.
    await mongoose.connect(process.env.MONGODB_URI, apply ? {} : { autoCreate: false, autoIndex: false });

    console.log("Categories:");
    const cats = await seedCategories(apply);
    console.log("Products:");
    const prods = await seedProducts(await categoryIds(), apply);

    const verb = apply ? "created" : "would be created";
    console.log(`Categories: ${cats.created} ${verb}, ${cats.skipped} skipped`);
    console.log(`Products:   ${prods.created} ${verb}, ${prods.skipped} skipped`);
    console.log(`Total:      ${cats.created + prods.created} ${verb}, ${cats.skipped + prods.skipped} skipped`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
