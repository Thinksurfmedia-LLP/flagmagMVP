# Store Phase 1 (Catalog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static store mockup with a real, admin-managed product catalog: models, admin CRUD, public `/store` listing with working filters, and `/store/[slug]` product pages.

**Architecture:** Validation, query parsing and pricing are pure CommonJS modules in `src/lib/store/` (tested with `node --test`, same as `src/lib/payments/amount.js`). A server-only `src/lib/store/catalog.js` wraps Mongoose reads and is shared by the API routes and the server-rendered public pages (same pattern as `src/app/organizations/[slug]/page.js`). Interactive bits (filters, gallery, option picker) are small client components; all jQuery/Owl/Slick code on store pages is removed, template CSS classes are kept.

**Tech Stack:** Next.js 16 App Router (JS), Mongoose 9, Bootstrap 5 template CSS (`public/assets/css/style.css`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-17-store-design.md`

## Global Constraints

- Work on branch `feat/store-catalog` off `main`. Leave the unrelated untracked `scripts/legacy/recovery/files/` alone.
- API responses use the existing envelope `{ success, data, error }` (+ `meta: { total, page, pageCount }` on lists).
- Pure modules: CommonJS (`module.exports`), relative requires only (no `@/`), so `node --test` can load them.
- Store admin = site admin only: `requireSiteAdmin()` (Task 4). Organizers get 403.
- Public reads only ever return `status: "active"` products.
- Never pass raw query text into `$regex`; use `containsRegex` from `src/lib/searchRegex.js`.
- Image URLs must start with `/api/uploads/` or `/assets/images/`. Uploads go through the existing `uploadImage()` client helper (1MB limit stays).
- Prices: reuse `normalizeAmount` from `src/lib/payments/amount.js` (USD, $1–$5000, ≤ 2 decimals).
- No `console.log`; server errors use `console.error` with a route tag, like `[payments/paypal/orders]`.
- Files ≤ 400 lines; split components rather than grow one page file.

## Review Focus

1. **Junk query strings** (`?page=-3&min=abc&max=1e9&color=<script>&sort=drop`) → page clamps to 1, bad numbers ignored, unknown sort → `newest`, never a 500. Pinned in Task 3.
2. **Draft/archived product by direct URL** → 404 on `/store/[slug]` and `GET /api/store/products/[slug]` for non-admins. Pinned in Task 3 (`buildCatalogFilter` always forces `status: "active"` unless `includeDrafts`) and Task 9 smoke step.
3. **Duplicate variants** (two `M / Black` rows, or two rows with the same SKU) → validation error naming the duplicate. Pinned in Task 2.
4. **Slug collision** when two products share a name or a product is renamed to an existing name → unique `-2`, `-3` suffix; renaming keeps its own slug if free. Pinned in Task 1.
5. **Money/stock edge values** (price `12.345`, compareAt ≤ price, stock `-1` or `2.5`, image `javascript:alert(1)` or `https://evil.example/x.png`) → rejected with a clear message (compareAt ≤ price is dropped to `null`, not an error). Pinned in Task 2.

---

### Task 1: Slug + pricing helpers

**Files:**
- Create: `src/lib/store/slug.js`, `src/lib/store/pricing.js`
- Test: `tests/storeSlug.test.js`, `tests/storePricing.test.js`

**Interfaces:**
- Produces:
  - `slugify(text: string): string` — lowercase, non-alphanumerics → `-`, trimmed of `-`, max 80 chars; `""` for empty.
  - `nextFreeSlug(base: string, taken: Set<string>): string` — `base` if free, else `base-2`, `base-3`, …
  - `discountPercent(price: number, compareAt: number|null): number|null` — rounded integer, `null` unless `compareAt > price`.
  - `formatPrice(n: number): string` — `"$45"` for whole dollars, `"$45.50"` otherwise.
  - `stockState(variants: {stock:number}[]): { state: "in_stock"|"low"|"out", total: number }` — `LOW_STOCK_THRESHOLD = 5`.

- [ ] **Step 1: Create branch**

Run: `git checkout -b feat/store-catalog`

- [ ] **Step 2: Write failing tests**

```js
// tests/storeSlug.test.js
test("slugify normalizes names", () => {
    assert.equal(slugify("Customized Tackle Twill Jerseys!"), "customized-tackle-twill-jerseys");
    assert.equal(slugify("  5 & 8 Men  "), "5-8-men");
    assert.equal(slugify("***"), "");
    assert.equal(slugify("a".repeat(200)).length, 80);
});
test("nextFreeSlug suffixes collisions", () => {
    assert.equal(nextFreeSlug("hoodie", new Set()), "hoodie");
    assert.equal(nextFreeSlug("hoodie", new Set(["hoodie"])), "hoodie-2");
    assert.equal(nextFreeSlug("hoodie", new Set(["hoodie", "hoodie-2"])), "hoodie-3");
});

// tests/storePricing.test.js
test("discountPercent", () => {
    assert.equal(discountPercent(99, 129), 23);
    assert.equal(discountPercent(50, 100), 50);
    assert.equal(discountPercent(100, 100), null);
    assert.equal(discountPercent(100, null), null);
});
test("formatPrice", () => {
    assert.equal(formatPrice(45), "$45");
    assert.equal(formatPrice(45.5), "$45.50");
});
test("stockState", () => {
    assert.deepEqual(stockState([{ stock: 0 }, { stock: 0 }]), { state: "out", total: 0 });
    assert.deepEqual(stockState([{ stock: 2 }, { stock: 3 }]), { state: "low", total: 5 });
    assert.deepEqual(stockState([{ stock: 6 }]), { state: "in_stock", total: 6 });
    assert.deepEqual(stockState([]), { state: "out", total: 0 });
});
```

- [ ] **Step 3: Run — expect FAIL** (`Cannot find module`)

Run: `node --test tests/storeSlug.test.js tests/storePricing.test.js`

- [ ] **Step 4: Implement both modules per the Interfaces block**

- [ ] **Step 5: Run — expect PASS**, then `npm test` (whole suite still green)

- [ ] **Step 6: Commit** — `git add docs/superpowers src/lib/store tests/storeSlug.test.js tests/storePricing.test.js` · `feat: store slug and pricing helpers`

---

### Task 2: Product + category input validation

**Files:**
- Create: `src/lib/store/productInput.js`
- Test: `tests/storeProductInput.test.js`

**Interfaces:**
- Consumes: `normalizeAmount` (`../payments/amount.js`), `slugify` (Task 1)
- Produces:
  - `normalizeProductInput(body: unknown): { ok: true, value: ProductInput } | { ok: false, error: string }`
    `ProductInput = { name, category /*24-hex*/, shortDescription, description, images: string[], price, compareAtPrice: number|null, variants: Variant[], status: "draft"|"active"|"archived", isFeatured: boolean }`
    `Variant = { sku: string, size: string, color: string, colorHex: string, stock: number }`
  - `normalizeCategoryInput(body: unknown): { ok: true, value: { name, image, sortOrder } } | { ok: false, error: string }`
  - Constants: `MAX_IMAGES = 8`, `MAX_NAME = 120`, `MAX_SHORT = 200`, `MAX_DESCRIPTION = 5000`, `PRODUCT_STATUSES`.

Rules (exact): name required, trimmed, ≤ 120; category must be 24-hex; images 1–8, each starts with `/api/uploads/` or `/assets/images/`; price via `normalizeAmount`; compareAtPrice optional, run through `normalizeAmount`, set to `null` if ≤ price; variants 1–50; stock integer ≥ 0; `colorHex` empty or `#RRGGBB`; blank `sku` auto-filled as `slugify(name)-size-color` (uppercased, empty parts skipped); duplicate `size+color` (case-insensitive) or duplicate sku → error `Duplicate variant: M / Black`; status defaults to `draft`. Category: name required ≤ 60, `sortOrder` integer default 0, image optional with the same URL rule.

- [ ] **Step 1: Write failing tests** — a `validProduct()` fixture, then one test per rule:

```js
test("accepts a valid product and fills defaults", () => {
    const r = normalizeProductInput(validProduct({ status: undefined, variants: [{ size: "M", color: "Black", stock: 3 }] }));
    assert.equal(r.ok, true);
    assert.equal(r.value.status, "draft");
    assert.equal(r.value.variants[0].sku, "FLAGMAG-HOODIE-M-BLACK");
});
test("rejects 3-decimal price", () => assert.match(normalizeProductInput(validProduct({ price: "12.345" })).error, /2 decimal/));
test("drops compareAtPrice not above price", () => assert.equal(normalizeProductInput(validProduct({ price: 30, compareAtPrice: 30 })).value.compareAtPrice, null));
test("rejects negative or fractional stock", () => {
    assert.equal(normalizeProductInput(validProduct({ variants: [{ size: "M", stock: -1 }] })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ variants: [{ size: "M", stock: 2.5 }] })).ok, false);
});
test("rejects duplicate size/color", () => {
    const r = normalizeProductInput(validProduct({ variants: [{ size: "M", color: "Black", stock: 1 }, { size: "m", color: "black", stock: 2 }] }));
    assert.equal(r.error, "Duplicate variant: M / Black");
});
test("rejects foreign or script image URLs", () => {
    for (const url of ["javascript:alert(1)", "https://evil.example/x.png", "//evil.example/x.png"]) {
        assert.equal(normalizeProductInput(validProduct({ images: [url] })).ok, false, url);
    }
});
test("rejects bad category id, empty images, >8 images, missing name", () => { /* one assert.equal(ok,false) each */ });
test("category input", () => {
    assert.deepEqual(normalizeCategoryInput({ name: " Apparel " }).value, { name: "Apparel", image: "", sortOrder: 0 });
    assert.equal(normalizeCategoryInput({ name: "" }).ok, false);
});
```

`validProduct(overrides)` = `{ name: "FlagMag Hoodie", category: "6ae8de37e6896bb733f10d4c", images: ["/api/uploads/a.png"], price: 45, variants: [{ size: "M", color: "Black", stock: 3 }], status: "active", ...overrides }`.

- [ ] **Step 2: Run — expect FAIL** · `node --test tests/storeProductInput.test.js`
- [ ] **Step 3: Implement `src/lib/store/productInput.js`** per rules above
- [ ] **Step 4: Run — expect PASS**, then `npm test`
- [ ] **Step 5: Commit** · `feat: validate store product and category input`

---

### Task 3: Catalog query parsing

**Files:**
- Create: `src/lib/store/catalogQuery.js`
- Test: `tests/storeCatalogQuery.test.js`

**Interfaces:**
- Produces:
  - `parseCatalogQuery(params: URLSearchParams | Record<string, string|string[]|undefined>): CatalogQuery`
    `CatalogQuery = { category: string|null, colors: string[], sizes: string[], minPrice: number|null, maxPrice: number|null, q: string|null, sort: "newest"|"price-asc"|"price-desc"|"name", page: number }`
    Params: `category`, `color` (repeatable), `size` (repeatable), `min`, `max`, `q`, `sort`, `page`.
  - `buildCatalogFilter(query: CatalogQuery, opts: { categoryId?: string|null, includeDrafts?: boolean }): { filter: object, sort: object, skip: number, limit: number }`
  - `toQueryString(query: CatalogQuery, overrides?: Partial<CatalogQuery>): string` — omits defaults; changing any filter resets `page` to 1 unless `page` is in overrides. Fixed param order: `category, q, color…, size…, min, max, sort, page`.
  - `sortSizes(sizes: string[]): string[]` — order `XS,S,M,L,XL,XXL,3XL`, unknown sizes after, alphabetical.
  - `PAGE_SIZE = 12`.

Rules: `page` = int ≥ 1 else 1, capped at 500; `min`/`max` finite ≥ 0 else null, swapped if min > max; `colors`/`sizes` = strings only, trimmed, ≤ 40 chars, max 10 each, deduped; `category` matches `^[a-z0-9-]{1,80}$` else null; `q` passed through `normalize` rules of `searchRegex.js` (use its `containsRegex` inside `buildCatalogFilter`); filter always has `status: "active"` unless `includeDrafts`; colors/sizes filter via `variants: { $elemMatch: { color: {$in}, size: {$in} } }` (case-insensitive exact regexes from `exactRegex`); sort map `newest → {createdAt:-1}`, `price-asc → {price:1, _id:1}`, `price-desc → {price:-1, _id:1}`, `name → {name:1}`.

- [ ] **Step 1: Write failing tests**

```js
test("junk params fall back safely", () => {
    const q = parseCatalogQuery({ page: "-3", min: "abc", max: "1e999", sort: "drop", category: "../x", color: ["<script>", "Red"] });
    assert.equal(q.page, 1); assert.equal(q.minPrice, null); assert.equal(q.maxPrice, null);
    assert.equal(q.sort, "newest"); assert.equal(q.category, null);
    assert.deepEqual(q.colors, ["<script>", "Red"]); // kept as literal text; escaped in buildCatalogFilter
});
test("swaps inverted price range", () => {
    const q = parseCatalogQuery(new URLSearchParams("min=50&max=10"));
    assert.equal(q.minPrice, 10); assert.equal(q.maxPrice, 50);
});
test("public filter always forces active status", () => {
    assert.equal(buildCatalogFilter(parseCatalogQuery({}), {}).filter.status, "active");
    assert.equal(buildCatalogFilter(parseCatalogQuery({}), { includeDrafts: true }).filter.status, undefined);
});
test("pagination math", () => {
    const { skip, limit } = buildCatalogFilter(parseCatalogQuery({ page: "3" }), {});
    assert.equal(skip, 24); assert.equal(limit, 12);
});
test("regex text is escaped", () => {
    const { filter } = buildCatalogFilter(parseCatalogQuery({ q: "(a+)+$" }), {});
    assert.equal(filter.name.source, "\\(a\\+\\)\\+\\$");
});
test("toQueryString drops defaults and resets page on filter change", () => {
    const q = parseCatalogQuery({ page: "4", color: "Red" });
    assert.equal(toQueryString(q, { sizes: ["M"] }), "color=Red&size=M");
    assert.equal(toQueryString(q, { page: 5 }), "color=Red&page=5");
});
test("sortSizes", () => assert.deepEqual(sortSizes(["XL", "Youth L", "S", "M"]), ["S", "M", "XL", "Youth L"]));
```

- [ ] **Step 2: Run — expect FAIL** · `node --test tests/storeCatalogQuery.test.js`
- [ ] **Step 3: Implement** per Interfaces + rules
- [ ] **Step 4: Run — expect PASS**, then `npm test`
- [ ] **Step 5: Commit** · `feat: parse and build store catalog queries`

---

### Task 4: Models, catalog service, site-admin guard

**Files:**
- Create: `src/models/ProductCategory.js`, `src/models/Product.js`, `src/lib/store/catalog.js`
- Modify: `src/lib/apiAuth.js` (add export after `requireAdmin`)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `ProductCategory` model: `{ name (unique), slug (unique), image, sortOrder }`, timestamps.
  - `Product` model: `{ name, slug (unique), category: ObjectId→ProductCategory (required), shortDescription, description, images: [String], price, compareAtPrice (default null), variants: [{ sku, size, color, colorHex, stock }], status (enum, default "draft"), isFeatured, organization: ObjectId|null (default null) }`, timestamps. Indexes: `{ status: 1, category: 1, createdAt: -1 }`, `{ status: 1, price: 1 }`. Follow the Amenity export style (`mongoose.models.X || mongoose.model(...)`).
  - `requireSiteAdmin(): Promise<{ authorized: true, user } | { authorized: false, response }>` — 401 via `requireAuth`, 403 `"Admin access required"` unless `role === "admin"` or `roles` includes `"admin"`.
  - `catalog.js` (ESM, `@/` imports, server only):
    - `listProducts(query: CatalogQuery, { includeDrafts = false } = {}): Promise<{ items, total, page, pageCount }>` — resolves `query.category` slug → id (unknown slug → empty result, not all products); items `.lean()` with `category` populated `name slug`.
    - `getProductBySlug(slug: string, { includeDrafts = false } = {}): Promise<object|null>`
    - `getProductById(id: string): Promise<object|null>` (admin; any status)
    - `listCategoriesWithCounts(): Promise<{ _id, name, slug, image, sortOrder, activeCount }[]>` sorted `sortOrder, name`.
    - `getFacetOptions(): Promise<{ colors: { name, hex }[], sizes: string[], maxPrice: number }>` — from active products only; `sizes` via `sortSizes`; `maxPrice` = ceil to next 10, minimum 10.
    - `uniqueProductSlug(name: string, excludeId?: string): Promise<string>` / `uniqueCategorySlug(...)` — load taken slugs with prefix `^base(-\d+)?$` and call `nextFreeSlug`; when `excludeId`'s current slug equals the base, keep it.
    - `serialize(doc)` — `JSON.parse(JSON.stringify(doc))` so ObjectIds/Dates are safe to pass to client components.

- [ ] **Step 1: Implement models, guard, and `catalog.js`** per Interfaces.
- [ ] **Step 2: Verify the dev server boots and models compile**

Run: `npm run dev`, then in another shell `node -e "fetch('http://localhost:3000/api/amenities').then(r=>console.log(r.status))"`
Expected: `200` and no Mongoose compile errors in the dev log.

- [ ] **Step 3: Lint** · `npx eslint src/models/Product.js src/models/ProductCategory.js src/lib/store src/lib/apiAuth.js` → no errors
- [ ] **Step 4: Commit** · `feat: product and category models with catalog service`

---

### Task 5: Store API routes

**Files:**
- Create: `src/app/api/store/categories/route.js`, `src/app/api/store/categories/[id]/route.js`, `src/app/api/store/products/route.js`, `src/app/api/store/products/[id]/route.js`

**Interfaces:**
- Consumes: Task 2 validators, Task 3 `parseCatalogQuery`, Task 4 service + `requireSiteAdmin`.
- Produces (all `{ success, data, error }`):
  - `GET /api/store/categories` — public, `listCategoriesWithCounts()`.
  - `POST /api/store/categories` — site admin; `normalizeCategoryInput` → 400 on error; slug via `uniqueCategorySlug`; 201.
  - `PUT /api/store/categories/[id]` — site admin; re-slug on rename. `DELETE` — 409 `"Move or delete the N products in this category first"` if any product (any status) references it.
  - `GET /api/store/products` — public: `listProducts(parseCatalogQuery(searchParams))`, response adds `meta: { total, page, pageCount }`. With `?scope=admin` → requires site admin and passes `includeDrafts: true` (401/403 otherwise, never silently public).
  - `POST /api/store/products` — site admin; validate; category must exist (400 `"Category not found"`); slug via `uniqueProductSlug`; 201.
  - `GET /api/store/products/[id]` — `[id]` is a 24-hex id (admin, any status, requires site admin) **or** a slug (public, active only); 404 `"Product not found"` otherwise.
  - `PUT /api/store/products/[id]` — site admin; full replace of editable fields; re-slug on rename keeping own slug when free.
  - `DELETE /api/store/products/[id]` — site admin; sets `status: "archived"` (soft delete; phase 2 orders will reference products).
  - Mongo duplicate-key (`11000`) → 409 with a readable message; other errors → 500 `"Something went wrong"` + `console.error("[store/...]", err)` (do not leak `error.message`).

- [ ] **Step 1: Implement the four route files**
- [ ] **Step 2: Smoke-test with the dev server running**

```bash
curl -s localhost:3000/api/store/categories                 # {"success":true,"data":[]}
curl -s "localhost:3000/api/store/products?page=-1&sort=x"  # success, meta.page = 1
curl -s -o /dev/null -w "%{http_code}" "localhost:3000/api/store/products?scope=admin"   # 401
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/api/store/products         # 401
```
Then, logged in as admin in the browser, create a category and a draft product via DevTools `fetch` and confirm: the draft is absent from the public list, present with `?scope=admin`, `GET /api/store/products/<slug>` → 404 while draft, 200 once `active`.

- [ ] **Step 3: Lint** the new files → clean
- [ ] **Step 4: Commit** · `feat: store catalog API`

---

### Task 6: Admin — Store nav + categories screen

**Files:**
- Modify: `src/components/AdminLayout.js` — add to `NAV_ITEMS` before `"Settings"`:
  `{ section: "Store", items: [ { label: "Products", href: "/admin/store/products", icon: "fa-solid fa-shirt", perm: "admin_only" }, { label: "Categories", href: "/admin/store/categories", icon: "fa-solid fa-tags", perm: "admin_only" } ] }`
- Create: `src/app/admin/store/categories/page.js`

**Interfaces:** Consumes `/api/store/categories` (Task 5), `uploadImage`, `useToast`, `ConfirmModal`.

- [ ] **Step 1: Build the categories page** by following `src/app/admin/amenities/page.js` (search, inline create/edit form, image upload, delete with `ConfirmModal`). Columns: image, name, slug, sort order, active product count. Show the 409 message from DELETE via `showError`.
- [ ] **Step 2: Manual check** — as admin: create "Apparel" (sort 1), rename it, try deleting one that has a product (sees the 409 message), delete an empty one. As an organizer: the Store section is not in the sidebar and the page's API calls return 403.
- [ ] **Step 3: Lint** → clean · **Step 4: Commit** · `feat: admin store categories screen`

---

### Task 7: Admin — products list + editor

**Files:**
- Create: `src/app/admin/store/products/page.js` (list), `src/app/admin/store/products/new/page.js`, `src/app/admin/store/products/[id]/page.js`
- Create: `src/components/store/admin/ProductForm.js`, `src/components/store/admin/VariantsEditor.js`, `src/components/store/admin/ImagesEditor.js`

**Interfaces:**
- Consumes: `/api/store/products?scope=admin`, `/api/store/products/[id]`, `/api/store/categories`, `uploadImage`, `formatPrice`, `stockState`.
- Produces: `<ProductForm initial={product|null} onSaved={(product) => void} />` — used by both `new` and `[id]` pages.

- [ ] **Step 1: List page** — table: thumbnail, name, category, price (`formatPrice`, compareAt struck through), total stock with `stockState` badge, status badge, updated date; filters: status (all/draft/active/archived), category, search (`q`); pagination via `AdminPagination`; row → edit page; "Archive" action calls DELETE.
- [ ] **Step 2: `ImagesEditor`** — upload (multi-select, sequential `uploadImage` calls), remove, move left/right; first image = cover; disables upload at 8.
- [ ] **Step 3: `VariantsEditor`** — rows `size | color | colorHex (color input) | sku | stock`, add/remove row, "Generate sizes" button that adds rows `XS…XXL` for a chosen color; shows server duplicate-variant error inline.
- [ ] **Step 4: `ProductForm`** — name, category select, short description, description (textarea), price, compare-at price, featured checkbox, status select, images, variants; submits POST/PUT; shows the server `error` string via toast; "View in store" link when status is active.
- [ ] **Step 5: Manual check** — create a product with 2 colors × 5 sizes and 3 images; edit price; set compare-at below price and confirm it saves as empty; add a duplicate `M / Black` row and confirm the error; archive it and confirm it disappears from `/store`.
- [ ] **Step 6: Lint** → clean · **Step 7: Commit** · `feat: admin store product management`

---

### Task 8: Public `/store` listing

**Files:**
- Replace: `src/app/store/page.js` (server component)
- Create: `src/components/store/ProductCard.js` (client), `src/components/store/StoreFilters.js` (client), `src/components/store/StorePagination.js`, `src/components/store/CategoryStrip.js`

**Interfaces:**
- Consumes: `parseCatalogQuery`, `toQueryString`, `listProducts`, `listCategoriesWithCounts`, `getFacetOptions`, `serialize`, `formatPrice`, `discountPercent`, `stockState`.
- Produces: `<ProductCard product={serializedProduct} />` (reused in phase 2).

- [ ] **Step 1: Page** — `export default async function StorePage({ searchParams })`: `await searchParams`, parse, load the three data sets in `Promise.all`, render the existing banner + breadcrumb markup, `CategoryStrip` (replaces the "Shop by Activity" Owl carousel: category tiles with image linking to `?category=slug`; hidden when no category has an image), `StoreFilters`, a `.product-list` grid of `ProductCard`, `StorePagination`. Empty state: "No products match these filters" + "Clear filters" link to `/store`. `export const metadata = { title: "Store | FlagMag" }`. Remove `BookDemoModal`/jQuery usage from this page (render `<Header />` the way `src/app/organizations/[slug]/page.js` does).
- [ ] **Step 2: `StoreFilters`** — keeps the template markup/classes (`.store-filter-area`, `.filter-wrap`, `.price-filter`, `.color-filter`); categories with real `activeCount`; colors from facets (swatch = `hex`); sizes; price min/max inputs bounded by `facets.maxPrice`; sort select. Every change → `router.push("/store?" + toQueryString(query, change))` (price inputs debounced 400 ms). Mobile: collapsible via a "Filters" button.
- [ ] **Step 3: `ProductCard`** — template classes (`.product-card`, `.product-image-area`, `.product-content-area`, `.price span/bdi/bdo`); hover reveal done with React state + the same `max-height` / `margin-top` styles the jQuery used; price, compare-at, `(N% OFF)`; "Out of stock" badge; bottom button = "View options" linking to `/store/[slug]` (cart arrives in phase 2 — no qty spinner yet).
- [ ] **Step 4: `StorePagination`** — template `.pagination` markup, links built with `toQueryString(query, { page })`, prev/next disabled at ends, hidden when `pageCount <= 1`.
- [ ] **Step 5: Manual check** — with ≥ 13 active products: page 2 works, color + size + price filters combine, browser back restores filter state, `/store?page=999` shows the empty state (not an error), `/store?min=abc` renders normally, layout OK at 375 px and 1440 px.
- [ ] **Step 6: Lint** → clean · **Step 7: Commit** · `feat: real store listing with filters and pagination`

---

### Task 9: Public `/store/[slug]` product page

**Files:**
- Create: `src/app/store/[slug]/page.js` (server), `src/components/store/ProductGallery.js` (client), `src/components/store/ProductOptions.js` (client), `src/components/store/ProductReviews.js`
- Replace: `src/app/store-details/page.js` → `redirect("/store")` (from `next/navigation`)

**Interfaces:**
- Consumes: `getProductBySlug`, `serialize`, `formatPrice`, `discountPercent`, `stockState`, `sortSizes`, `ProductCard` (related products).
- Produces: `<ProductOptions product={...} />` exposes the chosen `{ variant, qty }` via an `onChange` prop (phase 2 hooks "Add to Bag" into it).

- [ ] **Step 1: Page** — `getProductBySlug(slug)` → `notFound()` when null; `generateMetadata` → `{ title: "<name> | FlagMag Store", description: shortDescription }`; breadcrumb `Home // Store // <category> // <name>`; `ProductGallery`, details column (category tag, name, short description, price/compare-at/% off), `ProductOptions`, description, then `<ProductReviews />`, then up to 4 related active products from the same category (`listProducts` with that category, excluding self).
- [ ] **Step 2: `ProductReviews`** — move the template's reviews markup (rating summary, comfort/fit, search, filters, sort dropdown, review list) **unchanged** from the old `store-details/page.js` into this component. No data wiring (spec: keep as-is, redesigned later).
- [ ] **Step 3: `ProductGallery`** — main image + thumbnail strip using the template classes, React state for the active index, keyboard arrows on focus; drop Slick/Fancybox; shows the first image when the selected color has no matching image.
- [ ] **Step 4: `ProductOptions`** — color radios (template `.product-image-variant`, label = color name), size radios (`.size-wrap`, sizes in `sortSizes` order, sizes with 0 stock for the chosen color disabled), qty spinner (`.number-spinner`, clamp 1…selected variant stock, max 99); stock line ("Only 3 left" / "Out of stock"); "Add to Bag" button rendered **disabled** with helper text "Checkout opens soon". Ship/Pick-up radios from the template are removed (they move to checkout in phase 2).
- [ ] **Step 5: Manual check** — active product renders; draft and archived slugs → 404 page; unknown slug → 404; `/store-details` → redirects to `/store`; choosing Black disables sizes with no Black stock; qty cannot exceed stock; reviews block looks as before.
- [ ] **Step 6: Lint** → clean · **Step 7: Commit** · `feat: store product page`

---

### Task 10: Seed script

**Files:**
- Create: `scripts/seed-store.mjs`

**Interfaces:** Consumes `ProductCategory`, `Product`, `slugify`. Run with `node --import ./scripts/lib/alias-loader.mjs scripts/seed-store.mjs [--apply]`; env via `loadEnv` from `scripts/legacy/common.mjs`.

Data (exact):
- Categories (`sortOrder`): Apparel (1), Jerseys (2), Uniforms (3), Accessories (4), Flag Belts (5).
- Products — all `status: "draft"`, image `/assets/images/product1.jpg`, sizes `S, M, L, XL, XXL` with color `""` and stock `0` unless noted:
  - Customized Full Uniforms — Uniforms — $45
  - Customized Hooded Jerseys — Jerseys — $27
  - Customized Tackle Twill Jerseys — Jerseys — $45
  - Customized Backpack — Accessories — $35 — one variant, no size

- [ ] **Step 1: Implement** — default = dry run printing what would be created; `--apply` upserts by slug with `$setOnInsert` only (never overwrites anything an admin edited); prints created/skipped counts.
- [ ] **Step 2: Run dry, then `--apply` against local DB, then `--apply` again** → second run reports `0 created, 9 skipped`.
- [ ] **Step 3: Commit** · `chore: seed store categories and legacy products as drafts`

---

### Task 11: Final verification

- [ ] **Step 1:** `npm test` → all pass (new store tests included).
- [ ] **Step 2:** `npm run lint` → no new errors in touched files.
- [ ] **Step 3:** `npm run build` → succeeds.
- [ ] **Step 4:** Run the **code-reviewer** and **security-reviewer** agents over `git diff main...feat/store-catalog`; fix CRITICAL/HIGH.
- [ ] **Step 5:** Re-run the Review Focus list by hand against the dev server (all five).
