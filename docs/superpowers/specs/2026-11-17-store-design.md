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

## Phase 1 product rules

- Price lives on the product (`price`, optional `compareAtPrice` > `price`). No per-variant price in phase 1.
- Variants = `{ sku, size, color, colorHex, stock }`. A product with no options has exactly one variant with empty size/color.
- Status `draft | active | archived`. The public only ever sees `active`.
- Images: 1–8 URLs, each must start with `/api/uploads/` or `/assets/images/`.
- Admin = site admin role only (not organizers): `role === "admin"` or `roles` includes `"admin"`.
- Listing page size: 12. Sorts: `newest` (default), `price-asc`, `price-desc`, `name`.
- Low-stock threshold: total stock ≤ 5 → "Only N left".
