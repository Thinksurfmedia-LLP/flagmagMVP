# FlagMag Store — Design

**Date:** 2026-11-17 · **Status:** approved scope, phase 1 planned

## Scope decisions (from product owner)

- **FlagMag-only store** selling the organization's own merch. No per-league / per-organization stores yet. Product keeps a nullable `organization` field so per-org stores can be added later without migration.
- **PayPal only.** Reuse `src/lib/paypal.js` (Orders v2, create + capture). No Stripe.
- **Shipping and tax are flat amounts set by an admin** (StoreSettings). No live tax or carrier-rate APIs.
- **Keep the template's reviews block** on the product page exactly as it looks today; it will be redesigned later. Do not delete it.
- **No legacy data migration.** The old OpenCart store had 5 products / 3 orders. Its products are seeded as drafts only.

## Phases

1. **Catalog** — Product + ProductCategory models, admin CRUD, public `/store` listing with working filters/pagination, `/store/[slug]` product page. Cart/checkout buttons present but disabled ("Checkout opens soon"). *Not to be announced publicly until phase 2 ships.*
2. **Cart + checkout** — localStorage cart, `/cart`, `/checkout`, Order model, StoreSettings (flat shipping rates, tax rate, pickup locations), PayPal via new `/api/store/checkout` + `/api/store/orders/[id]/capture` (server recomputes every price; atomic stock decrement on capture; oversold → order flagged for admin refund), confirmation page + buyer/admin emails.
3. **Order management** — admin orders list, status workflow + history, PayPal refunds, "My orders" for logged-in users.
4. **Personalization** — per-product custom fields (team name, player name, number, logo upload); optional team bulk order from roster.
5. **Later** — coupons, PayPal webhook, wishlist, real reviews.

## Template fidelity (binding — added 2026-11-17)

The HTML templates in `new/*.html` are the **client-approved design**. Nothing in them may be dropped. Every element is either wired to real data, or rendered static/inert until its phase arrives. Elements we add beyond the template, such as the Sort and Size filters, are allowed.

Decisions for elements that need data:
- **"New" badge:** each product has `newBadge: auto | on | off` (default `auto`). `auto` shows the badge for 30 days after `createdAt`; `on` and `off` force it.
- **Colour photo thumbnails:** each product has a `colorImages` map from colour name to one of the product's own image URLs, picked in the editor. Choosing a colour switches the gallery to that colour's image. A colour with no mapping uses the first image.
- **Accordion:** "Product Details" and "Specs & Care" are per-product text fields. "Refund Policy" and the "Size & Fit Guide" (text plus optional image, shown in a modal) are store-wide, held in a singleton StoreSettings that site admins edit.
- **Wishlist:** the heart toggles the product, with the chosen size and colour, in the shopper's browser (localStorage). `/wishlist` is built from `new/wishlist.html`.
- **Other new product fields:** `subtitle` (h4 under the name, and the card's `<p>`), `highlight` (the description-area h5), `tags` (extra tag pills beside the category).
- **Static until reviews exist:** the 5-star rating next to the price, matching the reviews block.
- **Ship / Pick Up:** stays on the product page and is selectable. Pickup locations come in Phase 2.
- **Card "Add to cart" (listing, related products, wishlist) before Phase 2:** links to the product page with the chosen qty.

## Phase 1 product rules

- Price lives on the product (`price`, optional `compareAtPrice` > `price`). No per-variant price in phase 1.
- Variants = `{ sku, size, color, colorHex, stock }`. A product with no options has exactly one variant with empty size/color.
- Status `draft | active | archived`. The public only ever sees `active`.
- Images: 1–8 URLs, each must start with `/api/uploads/` or `/assets/images/`.
- Admin = site admin role only (not organizers): `role === "admin"` or `roles` includes `"admin"`.
- Listing page size: 12. Sorts: `newest` (default), `price-asc`, `price-desc`, `name`.
- Low-stock threshold: total stock ≤ 5 → "Only N left".
