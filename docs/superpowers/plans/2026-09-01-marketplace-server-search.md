# Marketplace Server-Side Search + Pagination Implementation Plan

> **For agentic workers:** implement task-by-task; each task ends with an independently verifiable deliverable.

**Goal:** Make all ~25k complete active listings searchable and mappable without loading them into the browser — server-side filtered/paginated list + a compact all-pins map feed — while keeping the current UI (desktop + mobile) and speed.

**Architecture:** A persisted `is_complete` boolean on `properties` (computed by a recompute job, applying the existing FX-aware completeness gate) lets the DB filter/paginate the exact marketplace set cheaply. Two buyer-portal API routes expose it: `/api/listings/search` (one page of filtered results + exact count) and `/api/listings/pins` (compact `[id,lat,lng,price,mode]` for ALL matches of a filter, cached). `MarketplaceClient` / `MobileMarketplace` fetch from these (debounced) instead of filtering a 5k client slice.

**Tech Stack:** Next.js 14 App Router, PostgREST (AiroBase), Google Maps + @googlemaps/markerclusterer, Node backfill script.

**Repos:** buyer portal (`casa-libre-BuyerPortal`, dual remotes clubx079+airosofts) for API + client + migration SQL; a recompute script (buyer portal `scripts/`) run as a cron.

## Global Constraints
- Keep desktop `MarketplaceClient` layout/UX visually identical; mobile matches the app UI already shipped.
- Completeness parity: server results MUST equal the current `isCompleteListing()` gate (contact ≥6 digits, location, FX price floors US$5k / ₲300k, sale-as-rent >US$15k drop, beds/baths/parking ≤10, built area 5–2000, buildings only — land excluded).
- Prod DB writes (migration, backfill) are user/Hamza-run or explicitly approved; scripts default to dry-run.
- Both buyer-portal remotes stay identical (push to clubx079 + airosofts).

---

### Task 1: `is_complete` column + recompute script
**Files:** Create `db/migrations/00X-add-is-complete.sql` (buyer portal, for record) · Create `scripts/recompute-complete.mjs`.
- Migration SQL: `ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_complete boolean NOT NULL DEFAULT false;` + `CREATE INDEX IF NOT EXISTS idx_props_complete ON properties (is_complete, admin_status, listing_type);`
- `recompute-complete.mjs`: page all `admin_status=active` building rows (the columns the gate needs), compute `isCompleteListing` with the current FX rate, and `PATCH` `is_complete` where it changed. Dry-run by default (`--commit` to write). Idempotent; safe to run on a schedule (hourly cron).
- **Verify:** dry-run prints how many rows would flip true/false and the resulting complete count (~25k). After a committed run, `count=exact` on `is_complete=eq.true&buildings` matches the JS gate count.

### Task 2: `/api/listings/search` (filtered + paginated)
**Files:** Create `app/api/listings/search/route.js`.
- Query params: `op` (venta/alquiler/all → listing_type), `type` (bucket → property_type ilike group), `price` band (USD/PYG per mode), `beds`, `q` (text → PostgREST `or=(neighborhood.ilike,city.ilike,address.ilike,property_type.ilike)`), `sort`, `page`, `pageSize` (default 24).
- Always `is_complete=eq.true` + buildings + `admin_status=eq.active`. Return `{ listings: shaped-slim, count (count=exact), page }`.
- **Verify:** curl with each filter returns a page + a plausible exact count; empty/edge queries return `[]` + 0.

### Task 3: `/api/listings/pins` (compact all-pins)
**Files:** Create `app/api/listings/pins/route.js`.
- Same filters as search (minus pagination); select ONLY `id,latitude,longitude,price,currency,listing_type`; return compact `{ pins: [{id,lat,lng,usd,mode}], count }`. Cache with `revalidate` ~120s. Skip null coords + non-PY coords (bbox).
- **Verify:** unfiltered returns ~all in-PY complete pins (< ~1MB); a filter narrows it.

### Task 4: Rewire `MarketplaceClient` (desktop) to server data
**Files:** Modify `components/MarketplaceClient.js`.
- Replace client-side `rows` filtering with a debounced fetch to `/api/listings/search` on any filter/sort/query/page change; keep the SAME list UI. Header count = server `count`. Map markers from `/api/listings/pins`. Keep hover/pan/cluster behavior.
- **Verify:** desktop list + count + map reflect the full 25k under filters; layout unchanged.

### Task 5: Rewire `MobileMarketplace` to server data
**Files:** Modify `components/MobileMarketplace.js`.
- Same server-driven data; keep the app-style mobile UI + filters sheet. Map uses `/api/listings/pins`.
- **Verify:** mobile search/filter/map cover the full set.

### Task 6: Publish sets `is_complete` (instant appearance)
**Files:** Modify `app/api/publish/route.js` (+ note for scrapers).
- On publish, set `is_complete=true` for the new listing (it already passed the form's completeness validation) so it appears without waiting for the cron.
- **Verify:** a freshly published listing is searchable immediately.

## Self-Review
- Parity: Task 1 uses the exact `isCompleteListing` import → server set == JS set. ✓
- Perf: list paginated; pins compact + cached; map clustering. ✓
- Rollback: `is_complete` defaults false but the recompute backfills; the API falls back gracefully to empty on error. ✓
