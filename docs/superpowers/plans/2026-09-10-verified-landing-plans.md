# Verified + Landing Promotion Plans — Implementation Plan

> **For agentic workers:** implement task-by-task, commit locally after each. LOCAL ONLY — never push.

**Goal:** Replace the single US$5 "Destacar" highlight with two plans — **Verified (US$5)** and
**Feature on landing page (US$20)** — with new card badge, map star + cluster-exposure, normal
ordering, home-page placement for the $20 tier, a day-29 renewal email, and one-click token renew.

**Architecture:** New `promotion_plan`/`promotion_expires_at` columns on `properties` drive all new
reads/writes; the legacy `is_highlighted` columns are left in place so the deployed prod site is
untouched. Server helpers in `lib/billing.js`+`lib/stripe.js`; plan-aware API routes; two crons
(expire + renewal-reminder); a signed one-click renew endpoint; a plan-aware bilingual modal; two
new brand-mono tag components; map changes in `utils/gmap.js` + 3 map consumers.

**Tech Stack:** Next.js 14.2 App Router (plain JS), Stripe (vaulting + off_session), Resend email,
AiroBase (PostgREST), Google Maps JS + @googlemaps/markerclusterer, React Native/Expo (RN map).

**Spec:** `docs/superpowers/specs/2026-09-10-verified-landing-plans-design.md`

## Global Constraints
- **LOCAL ONLY.** Commit to local `main` (buyer) / `master` (mobile). Do NOT push to clubx079 or airosofts.
- New code MUST NOT write `is_highlighted`/`highlighted_until` (keeps the live prod site inert during testing).
- Prices exact: **verified = US$5 (500¢)**, **home = US$20 (2000¢)**. Duration **30 days** both.
- Brand: ink `#111`, paper `#f9f4ee`. Tags are ink/paper only, SVG icons (no emoji, no color).
- Plan tiers: `home` ⊃ `verified`. Both = "promoted" (Verified badge + map star). Only `home` on landing.
- Migration additive & idempotent; apply to AiroBase via SQL editor (same as 003).
- Test with Stripe **test** keys already in `.env.local`; create→test→delete test rows (DELETE sends NO Content-Type).

---

### Task 1: Migration 004 — promotion columns
**Files:** Create `migrations/004_promotion_plans.sql`
- [ ] Add to `properties`: `promotion_plan text`, `promoted_at timestamptz`, `promotion_expires_at timestamptz`, `renewal_reminded_at timestamptz`; CHECK `promotion_plan in ('verified','home')`; partial index on `(promotion_expires_at desc) where promotion_plan is not null`.
- [ ] Add `payments.plan text`.
- [ ] Backfill `is_highlighted=true` → `promotion_plan='home'`, `promoted_at`, `promotion_expires_at` from legacy cols.
- [ ] Apply to AiroBase; verify columns exist via PostgREST select.

### Task 2: `lib/stripe.js` — plan pricing
**Files:** Modify `lib/stripe.js`
- [ ] Add `PROMO = { verified: { usd:5, cents:500, label }, home: { usd:20, cents:2000, label } }`, `PROMO_DAYS=30`, helper `promoCents(plan)`, `isPromoPlan(plan)`. Keep `HIGHLIGHT_*` as aliases to `verified` for any stragglers.

### Task 3: `lib/billing.js` — grant + record + renew helpers
**Files:** Modify `lib/billing.js`
- [ ] `grantPromotion(propertyId, plan, { extendFrom } = {})`: sets `promotion_plan=plan`, `promoted_at=now`, `promotion_expires_at = base + 30d` (base = `extendFrom` if in future else now), `renewal_reminded_at=null`. Returns expiry ISO. (Do NOT set is_highlighted.)
- [ ] `recordPayment` rows now include `plan` + `kind` ('highlight'|'renewal').
- [ ] `getUserBilling` select adds `plan,kind`.
- [ ] Keep `ensureStripeCustomer`/`saveDefaultCard`/`paymentAlreadyRecorded` unchanged.

### Task 4: `lib/promoToken.js` — signed one-click renew token
**Files:** Create `lib/promoToken.js`
- [ ] `signRenewToken({pid,uid,plan})` + `verifyRenewToken(token)` using HMAC-SHA256 (`node:crypto`), secret `process.env.PROMO_LINK_SECRET || SESSION_SECRET || CRON_SECRET`, 14-day expiry, base64url payload. Pure/DB-free.

### Task 5: API — create-intent + confirm (plan-aware)
**Files:** Modify `app/api/highlight/create-intent/route.js`, `app/api/highlight/confirm/route.js`
- [ ] Accept `plan` in body (default `'verified'`); validate via `isPromoPlan`. Amount = `promoCents(plan)`. Metadata `product:'casa-libre-promo', plan`.
- [ ] Ownership/active/complete checks unchanged; "already promoted live" guard uses `promotion_plan`+`promotion_expires_at`.
- [ ] On success → `grantPromotion(pid, plan)`, `recordPayment({..., plan, kind:'highlight'})`, `revalidateTag('listings')`.
- [ ] `confirm` verifies `pi.metadata.plan`, idempotency via `paymentAlreadyRecorded`.

### Task 6: API — one-click renew
**Files:** Create `app/api/promo/renew/route.js` (GET)
- [ ] Verify token → load property+user; if not still owned → error page. Charge saved card off_session for `promoCents(plan)`; on `succeeded` → `grantPromotion(pid, plan, { extendFrom: current expiry })`, `recordPayment(kind:'renewal', plan)`, reset reminded, revalidate; render minimal branded confirmation HTML. On `requires_action`/no card → 302 to `/cuenta/pagos?renew=<pid>`.

### Task 7: Reads — listings.js + marketplace.js
**Files:** Modify `lib/listings.js`, `lib/marketplace.js`
- [ ] SELECT/LIGHT_SELECT: swap `is_highlighted,highlighted_until` → `promotion_plan,promotion_expires_at`.
- [ ] `shape()`: `promoted = plan && expires>now`; add `verified: promoted`, `plan`, `onHome: plan==='home'`, keep `highlighted: promoted` alias, `promotion_expires_at`.
- [ ] Remove `is_highlighted.desc` from `getListings` order → `created_at.desc`.
- [ ] `slimForMarketplace` add `verified`, `plan`.
- [ ] `getUserListings`: use promotion cols; expose `plan`, `promotion_expires_at`.
- [ ] `marketplace.js`: `isPromoted(r)`; select promotion cols; `searchListings` order = `${primary}` only (no float); return `verified`,`plan`. `getPins` order `created_at.desc`, return `hl: isPromoted(r)`, `plan`.

### Task 8: Home page selection
**Files:** Modify `app/page.js`
- [ ] `featured` = home-tier promoted-with-image first, topped up with newest-with-image to a min of 3, cap 6.

### Task 9: Tag components
**Files:** Create `components/VerifiedTag.js`, `components/RecommendedTag.js`; delete/retire `components/FeaturedTag.js` usages
- [ ] `VerifiedTag` = ink pill + paper Material `verified` seal-check SVG + `Verificada`/`Verified`.
- [ ] `RecommendedTag` = ink pill + paper star SVG + `Recomendado`/`Recommended`.
- [ ] Swap card renders to `VerifiedTag` gated on `l.verified`: `LandingClient.js`, `MobileHome.js`, `MobileMarketplace.js`, `MarketplaceClient.js` (list card), `account/ListingCard.js`. Keep rings gated on `l.verified`.

### Task 10: Maps — star + larger + cluster exposure
**Files:** Modify `utils/gmap.js`, `components/MarketplaceClient.js`, `components/MobileMarketplace.js`, `casa-libre-mobile-app/components/PropertyMap.js`
- [ ] `pinIcon(google,label,hot,{promoted})`: promoted → +star glyph, larger box (h 28, font 13).
- [ ] Web maps: promoted pins built with `{promoted:true}`, added directly to the map (higher zIndex), EXCLUDED from the clusterer; non-promoted added to the clusterer. Hover keeps invert. Requires pins to carry `hl`/`verified` (search + pins already return `hl`; add to search pin build).
- [ ] RN `PropertyMap.js`: point objects carry `promoted`; promoted markers star+larger and added directly (not clustered). Mobile listings must include the flag — extend `/api/mobile/*` shaping (`lib/listings.js shape()` already adds it; confirm mobile endpoints pass it through).

### Task 10b: Mobile API flag passthrough
**Files:** Inspect/मmodify `app/api/mobile/*`
- [ ] Ensure the mobile listing payloads include `verified`/`plan` (shape already yields them; verify the `/api/mobile/listings` + `/byids` mappers don't strip them).

### Task 11: Sell UI — two boxes
**Files:** Modify `components/SellFlow.js`, `components/PublicarClient.js`
- [ ] Replace single `highlight` bool with `plan` state (`null|'verified'|'home'`), mutually exclusive boxes; Box B carries `RecommendedTag`; per-plan benefit copy; explicit "$20 = Verified + Home" line.
- [ ] Button label from `plan`: free / US$5 / US$20.
- [ ] After free publish, open modal with `plan`.
- [ ] Post-publish upsell box + `hiDone` copy updated for verified/home.

### Task 12: PromotionModal
**Files:** Modify `components/HighlightModal.js` (accept `plan`,`lang`); update mounts in SellFlow/PublicarClient
- [ ] Price/copy from plan; bilingual strings; pass `plan` to create-intent/confirm; success copy per plan.

### Task 13: Email — renewal reminder
**Files:** Modify `lib/email.js`
- [ ] `promotionRenewalHtml({name, plan, propertyTitle, ref, renewUrl, expires})` using `shell()`+`btn()`; per-plan copy; `sendPromotionRenewalEmail(email, {...})`.

### Task 14: Crons
**Files:** Modify `app/api/cron/expire-highlights/route.js`; create `app/api/cron/renewal-reminders/route.js`
- [ ] expire: also `promotion_plan=null, renewal_reminded_at=null where promotion_plan not null & promotion_expires_at<now`. Keep legacy is_highlighted expiry. Revalidate if any.
- [ ] renewal-reminders (Bearer CRON_SECRET): select promotion rows expiring in (now, now+24h] with `renewal_reminded_at is null` (+ owner email/name, property title/ref); send email with signed renew link; set `renewal_reminded_at=now`. Return counts.

### Task 15: Dashboard + payments page
**Files:** Modify `components/account/ListingCard.js`, `app/cuenta/publicaciones/page.js`, `app/cuenta/pagos/page.js`
- [ ] ListingCard: VerifiedTag + days-left; a "Renovar/Verificar/Destacar" action that opens the modal with the property's current plan (or verified default).
- [ ] pagos: show `plan` (Verified/Landing) + `kind` (renewal) in the history rows.

### Task 16: i18n copy
**Files:** SellFlow.js, PublicarClient.js, HighlightModal.js, lib/ui.js
- [ ] Replace all "Destacar/Featured/US$5/30 días arriba" copy with the two-plan, verified/home wording (es+en). `lib/ui.js` `featured` label → `verified` semantics if used as a filter/section.

### Task 17: Tests (all cases) + build
**Files:** scratchpad test scripts + `next build`
- [ ] Node harness (Stripe test API + REST + forged buyer session against `npm run dev`): verified new-card, verified saved-card, home purchase, ordering-not-floated, relevance-includes-promoted, pins hl+plan, promoted pin renders star (unit on `pinIcon`), home-page shows home-tier, expiry clears, day-29 reminder selects+sends+sets flag, token renew charges+extends+logs, mutual-exclusivity/button-text (component logic), transaction-history shows plan+renewal.
- [ ] `next build` passes. Clean up all test rows.
