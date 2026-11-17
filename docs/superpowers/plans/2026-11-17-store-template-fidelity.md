# Store Template Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore every element of the approved `new/store.html`, `new/store-details.html` and `new/wishlist.html` designs on the real store pages, backed by real data where needed.

**Architecture:** New product fields and a singleton StoreSettings model, validated by the existing pure CommonJS validators, which are extended and unit-tested. Template markup is reproduced with its original class names. Interactive bits are React client components. Bootstrap's JS, already loaded site-wide by `src/components/BootstrapClient.js`, drives the accordion and collapse. The wishlist lives in localStorage behind a small pure module.

**Tech Stack:** Next.js 16 App Router (JS), Mongoose 9, Bootstrap 5 + template CSS (`public/assets/css/style.css`, identical to `new/assets/css/style.css`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-17-store-design.md` (see "Template fidelity")

## Global Constraints

- Branch `feat/store-catalog` (continue on it). Do not push.
- **Template fidelity:** reproduce the template markup and class names for every element listed in each task's checklist. Compare against the template file named in the task, not only against this plan.
- Never write to the `.env` database. Data-touching runs use `MONGODB_URI=mongodb://127.0.0.1:27017/flagmag_store_dev`. The controller provides the test server at http://localhost:3100.
- API envelope `{ success, data, error }`. Store admin means `requireSiteAdmin()`. Public reads return active products only.
- Pure modules are CommonJS with relative requires, tested with `node --test`.
- No `console.log` in `src/`. Files must stay ≤ 400 lines; split components rather than growing a file past that.
- Reviews block (`src/components/store/ProductReviews.js`) stays unchanged.
- Text fields render as React text, never HTML. Multi-line text uses `white-space: pre-line`.

## Review Focus

1. **Colour→image map with a stale image:** an admin deletes an image that a colour still points to. Expected: the save is rejected with a clear message, or the mapping is dropped; the page must not render a broken image. Pinned in Task 1 (a validator rule: map values must be in `images`).
2. **"New" badge boundary:** product created exactly 30 days ago, `auto` → no badge; 29 days → badge; `on`/`off` override regardless. Pinned in Task 1.
3. **Wishlist storage failures:** private mode, quota exceeded, or corrupt JSON in localStorage. Expected: wishlist acts empty and the page still renders, never throws. Pinned in Task 5.
4. **Wishlist item no longer active** (archived or deleted product): it disappears from `/wishlist` silently and is pruned from storage. Pinned in Task 5.
5. **Settings never saved:** `/store/[slug]` with no StoreSettings document still renders the Refund Policy section and the Size & Fit Guide link with sensible empty-state text. Pinned in Task 2 (the GET defaults) and the Task 6 smoke check.

---

### Task 1: Product fields + pure helpers

**Files:** Modify `src/models/Product.js`, `src/lib/store/productInput.js`; Create `src/lib/store/badges.js`; Test `tests/storeProductInput.test.js`, `tests/storeBadges.test.js`

**Interfaces — Produces:**
- Product schema adds: `subtitle` (≤120), `highlight` (≤200), `details` (≤5000), `specsCare` (≤5000), `tags: [String]` (≤10 items, each ≤30, trimmed, deduped case-insensitively), `newBadge: "auto"|"on"|"off"` (default `"auto"`), `colorImages: Map<String,String>` (stored as a plain object).
- `normalizeProductInput` accepts and validates those fields. Every `colorImages` value must be one of `images`, else error `Colour photo for "<color>" must be one of the product images`. Every `colorImages` key must match a variant colour (case-insensitive), else the key is dropped silently.
- `badges.js`: `isNewProduct(product: {newBadge, createdAt}, now = new Date()): boolean`, using `NEW_BADGE_DAYS = 30` (strictly fewer than 30 days); `sizeLabel(size: string): string` maps `XS→Extra Small, S→Small, M→Medium, L→Large, XL→Extra Large, XXL→2X Large, 3XL→3X Large` (case-insensitive), with anything else returned unchanged.

- Search also matches tags: in `src/lib/store/catalogQuery.js`, `buildCatalogFilter` turns `q` into `$or: [{ name: re }, { tags: re }]` (same escaped regex). Update the existing "regex text is escaped" test in `tests/storeCatalogQuery.test.js` to assert on `filter.$or[0].name.source`.

- [ ] Write failing tests: the field limits; tags dedupe and 10-item cap; a colorImages value not in images → the exact error; an unknown colour key dropped; `isNewProduct` at 29 days → true, 30 days → false, `on`/`off` overrides; `sizeLabel` mappings and passthrough.
- [ ] Run → FAIL; implement; run → PASS; `npm test`; commit `feat: product subtitle, tags, details, new badge and colour photos`

### Task 2: Store settings (refund policy + size guide)

**Files:** Create `src/models/StoreSettings.js`, `src/lib/store/settingsInput.js`, `src/app/api/store/settings/route.js`, `src/app/admin/store/settings/page.js`; Modify `src/components/AdminLayout.js` (Store section: add `{ label: "Store Settings", href: "/admin/store/settings", icon: "fa-solid fa-gear", perm: "admin_only" }`); Test `tests/storeSettingsInput.test.js`

**Interfaces — Produces:**
- Singleton `StoreSettings { key: "store" (unique), refundPolicy (≤5000), sizeGuideText (≤5000), sizeGuideImage ("" or an allowed image URL — reuse the productInput image rule) }`. Phase 2 will add shipping and tax fields to this same document.
- `normalizeSettingsInput(body)` → `{ ok, value } | { ok:false, error }`.
- `GET /api/store/settings` (public) → saved values, or defaults `{ refundPolicy:"", sizeGuideText:"", sizeGuideImage:"" }` when no document exists. `PUT` (site admin) upserts the document.
- `getStoreSettings()` server helper in `src/lib/store/catalog.js` (or a new `settings.js`), used by the product page.
- Admin page: the amenities/categories pattern. Textareas for the two texts, image upload via `uploadImage`, Save.

- [ ] Tests for `normalizeSettingsInput` (limits, image rule, non-object body) → FAIL → implement → PASS
- [ ] Routes + admin page + nav; curl smoke (GET before any save returns defaults; PUT as admin; organizer 403); lint; `npm test`; commit `feat: store settings for refund policy and size guide`

### Task 3: Admin editor for the new fields

**Files:** Modify `src/components/store/admin/ProductForm.js`, `VariantsEditor.js` (or Create `src/components/store/admin/ColorPhotosEditor.js` and `ProductContentFields.js` to stay ≤ 400 lines)

**Interfaces — Consumes:** Task 1 fields. **Produces:** the form sends `subtitle, highlight, details, specsCare, tags, newBadge, colorImages` on POST and PUT, keeping the existing always-send-status rule.

- [ ] Inputs: Subtitle; Description headline (highlight); Product Details and Specs & Care textareas; Tags (comma-separated input → array); New badge select ("Automatic (30 days)", "Always show", "Never show").
- [ ] Colour photos: for each distinct variant colour, a row of the product's uploaded image thumbnails to pick from (radio), plus "None (use first image)". Removing an image in ImagesEditor clears any colour mapping that pointed at it.
- [ ] Verify via HTTP (create and edit with all fields, through the admin cookie) + lint + `npm test`; commit `feat: edit product content, tags, badge and colour photos`

### Task 4: Listing fidelity (`/store`) — template `new/store.html`

**Files:** Modify `src/components/store/CategoryStrip.js` (or rename to `ActivityCarousel.js`), `StoreFilters.js`, `ProductCard.js`, `src/app/store/page.js`

**Fidelity checklist (all required):**
- [ ] `.store-banner-section`: `<h2>Shop by Activity</h2>`, a "See All" `.btn.btn-primary` linking to `/store`, and a `.store-banner-carousel-wrapper > .store-banner-carousel.owl-carousel.owl-theme > .item` carousel. Template responsive counts: 1 item <600px (no nav), 2 at ≥600, 3 at ≥1200; arrows on; no dots; no loop.
  - Items are the categories that have active products, each tile linking to `/store?category=<slug>`. A category image is used when set; otherwise the template banners `/assets/images/sb1.png`, `sb2.png`, `sb3.png` rotate as fallbacks.
  - The section is hidden only in the empty-catalog "opening soon" state.
  - Use the site's already-loaded Owl (see how `src/components/GalleryCarousel.js` or `TestimonialCarousel.js` initialise it), with destroy on unmount. If that is not feasible, use a CSS scroll-snap carousel that keeps the same classes and arrow nav.
- [ ] Price filter: template `.price-filter > .slider > .progress` plus `.range-input` holding two `input[type=range].range-min/.range-max`, plus the existing `.price-input` boxes. Slider and boxes stay in sync and share the existing debounce and `go()` path. Bounds are 0…`facets.maxPrice`. The `.progress` bar shows the selected range.
- [ ] `ProductCard`: `<p>{subtitle}</p>` under `<h5>`. `.buttom-wrap` holds `.number-spinner.qty` with `<h5>Qty</h5>`, the ns-btn minus/plus and `.pl-ns-value` (1–99), then `<a className="btn btn-primary">Add to cart</a>`, which links to `/store/<slug>?qty=<n>` until Phase 2. Price markup stays `span / bdi / bdo`.
- [ ] Screenshot `/store` at 1440 and compare against `new/store.html` opened the same way (headless Edge), side by side; note any remaining difference in the report.
- [ ] lint, `npm test`, commit `feat: store listing matches approved template`

### Task 5: Wishlist

**Files:** Create `src/lib/store/wishlist.js` (pure CJS core + storage adapter), `src/app/wishlist/page.js`, `src/components/store/WishlistGrid.js`, `src/components/store/WishlistHeart.js` (client: props `{ slug, size, color }`, renders the template `<li><a><i class="fa-regular|fa-solid fa-heart"></i></a></li>` toggle, listens to `wishlist:change`); Modify `src/app/api/store/products/route.js` (support `?slugs=a,b,c`, public, active only, ≤50 slugs, each matching the slug charset) ; Test `tests/storeWishlist.test.js`

**Interfaces — Produces:**
- `wishlist.js`: pure `addItem(list, item)`, `removeItem(list, slug, size, color)`, `hasItem(list, slug)`, `parseStored(raw): Item[]` (corrupt/invalid → `[]`, max 100 items), `Item = { slug, size, color, addedAt }`; browser adapter `readWishlist()` / `writeWishlist(list)` wrapped in try/catch, which dispatches a `wishlist:change` window event so the hearts update.
- `/wishlist` page per `new/wishlist.html`: `.wishlist-section` > `.heading-part` (`<h2>My Wishlist</h2>` + `<p>` intro: "Products you've saved for later."), `.row.g-4` of `.col-md-6.col-lg-4 > .wishlist-item > .image-area img + .content-area (h4 name, p subtitle, p "Size: <span>…</span>" when a size was saved, h6 price, a.btn.btn-primary "add to bag")`. "add to bag" → `/store/<slug>?size=&color=` (Task 6 makes the product page honour these). **Addition beyond the template** (needed for usability): a small remove control (heart-filled icon button) on each item. Empty state: "Your wishlist is empty." + a link to `/store`.
- Products no longer returned by the API are pruned from storage.

- [ ] Tests for the pure functions (add dedupe by slug+size+color, remove, corrupt JSON, the cap) → FAIL → implement → PASS
- [ ] `?slugs=` API + page + `WishlistHeart`; curl smoke (`/wishlist` 200 and the API with slugs); lint; `npm test`; commit `feat: wishlist from approved template`

### Task 6: Product page fidelity (`/store/[slug]`) — template `new/store-details.html`

**Files:** Modify `src/app/store/[slug]/page.js`, `ProductGallery.js`, `ProductOptions.js`; Create `src/components/store/ProductHeaderActions.js` (share + heart), `ProductAccordion.js`, `SizeGuideModal.js`

**Fidelity checklist (all required, template order):**
- [ ] Gallery: the main image slider plus `.thumb-nav`. The 4th thumbnail becomes `li.more` with `<span>+N More</span>` when there are more than 4 images. Clicking the main image or the "more" tile opens a full-screen lightbox (fancybox CSS is loaded; use fancybox JS if available, else a small React lightbox with prev/next/close and Esc). The gallery accepts a `activeImage` prop so a colour change can switch it.
- [ ] `.row.justify-content-between`: `ul.tag` (category first, then `tags`, each a link to `/store?category=…` for the category and `/store?q=<tag>` for tags) + `ul.social` (paper-plane share via `navigator.share`, falling back to clipboard copy with a toast or "Link copied" text; `WishlistHeart` from Task 5 with the current size/colour).
- [ ] `<h6><img src="/assets/images/icon-hot.png" alt=""> New</h6>` only when `isNewProduct`.
- [ ] `<h2>{name}</h2>`, `<h4>{subtitle}</h4>`; price row: `<h3>` price (+ compare-at and % off as now) and `ul.star-rating` with 5 `fa-solid fa-star`.
- [ ] `.product-image-variant`: `<h4>` selected colour name (+ " - " + selected SKU), radio thumbnails using `colorImages[color]` (fallback: first image). Selecting a colour sets the gallery's active image. Hidden only when the product has no colours.
- [ ] `.size-wrap > .size-row`: `<h4>Size</h4>` + `<h4><a href="#">Size &amp; Fit Guide</a></h4>` opening `SizeGuideModal` (StoreSettings text + image; empty state "Size guide coming soon."). Size labels use `sizeLabel()`.
- [ ] `.quantity-wrap` (as now).
- [ ] `.ship-type`: two radios, `label.ship` (`<h6>Ship</h6><p>…</p>`) and `label.pick` (`<h6>Pick Up</h6><p>…</p>`), Ship selected by default. Copy: until a size is chosen, both `<p>` read "Select a size" (template copy); after that, Ship → "Ships in 3–5 business days" and Pick Up → "Pick up details at checkout". The choice is included in `ProductOptions`' `onChange` payload as `fulfilment`.
- [ ] "Add to Bag" (disabled + "Checkout opens soon", as now).
- [ ] `.description-area`: `<h5>{highlight}</h5><p>{description}</p>`. Omit the h5 only if highlight is empty.
- [ ] `ProductAccordion`: the template's `.accordion#accordionExample` markup, with three items in order — "Product Details" (`details`, open by default), "Specs & Care" (`specsCare`), "Refund Policy" (StoreSettings `refundPolicy`). An empty section shows "Details coming soon." Use Bootstrap data attributes, which work via the global bundle.
- [ ] Reviews block unchanged. Related products use `ProductCard` (Task 4 card with Qty + Add to cart).
- [ ] Honour `?qty=`, `?size=`, `?color=` (from card and wishlist links) as initial selections (clamped / ignored when invalid).
- [ ] Screenshot at 1440 vs `new/store-details.html`; note any remaining differences. lint, `npm test`, commit `feat: product page matches approved template`

### Task 7: Final fidelity verification

- [ ] `npm test`, lint on changed files, `npm run build` (in a worktree with real node_modules).
- [ ] Controller screenshots at 1440: `/store`, `/store/<slug>` (product with 5+ images, 2 colours with photos, "New" on, tags, all text fields), `/wishlist` with 2 items, each next to its template screenshot; walk each task's checklist.
- [ ] Final whole-branch review over the fidelity commits.
