# Casa Libre — Two Promotion Plans (Verified + Landing) — Design

**Date:** 2026-09-10
**Status:** Approved by user (dictated request, explicit "just build it"). LOCAL ONLY — do not push to clubx079/airosofts.

## Problem

Today there is a single paid promotion: **US$5 "Destacar"** which (a) floats a listing to the
top of the marketplace + home lists and (b) shows a "Destacada"/Featured star tag. The client
wants a **two-tier** model with clearer value and different pricing.

## Pricing (client-facing)

- **US$5 — Verified**
- **US$20 — Feature on landing page**

## The two plans

### Plan A — Verified (US$5 / 30 days)
- Card badge becomes **"Verified" / "Verificada"** with a verified-seal icon (brand ink/paper — no color, no emoji).
- **Normal ordering** — the listing is NOT floated to the top of the marketplace/home. It sits in
  its natural relevance/sort position. (This removes the current `is_highlighted.desc` prefix, so
  verified listings now correctly participate in the relevance/price/area sorts.)
- **Map treatment:** its price pin gets a **star** and is drawn **slightly larger**, and it is
  **always exposed on the map** — never swallowed into a cluster (because the user paid for
  visibility). Applies to the desktop marketplace map, the mobile-web marketplace map, and the RN
  app map.
- The map's active filters still apply to verified pins (they're not special-cased out of the
  filter — only out of the clustering).

### Plan B — Feature on landing page (US$20 / 30 days)
- Everything in **Verified**, PLUS the listing **appears on the home / landing page**.
- On the marketplace card it shows the same **Verified** badge (per the client: "Verified tag on
  marketplace + Display on home page"). The home-page placement is the extra value.

`home` is a strict superset of `verified`. Both tiers are "promoted": both get the Verified badge
and the map star treatment. Only `home` appears on the landing page.

## Data model (migration 004, additive & non-breaking)

`properties` (new columns; existing `is_highlighted`/`highlighted_at`/`highlighted_until` are LEFT
IN PLACE so the currently-deployed prod site is unaffected):
- `promotion_plan text` — `null | 'verified' | 'home'` (CHECK).
- `promoted_at timestamptz`
- `promotion_expires_at timestamptz`
- `renewal_reminded_at timestamptz` — set when the day-29 email is sent (dedupe); cleared on renew/expire.

`payments` (new column):
- `plan text` — `'verified' | 'home'` (nullable; old rows null).

**Backfill:** any row currently `is_highlighted=true` → `promotion_plan='home'`,
`promoted_at=coalesce(highlighted_at,now())`, `promotion_expires_at=highlighted_until`. (Old
highlight = top + home, closest to the new premium tier.)

**Why the live site is safe:** all NEW reads/writes use `promotion_*`. New code never sets
`is_highlighted`. The deployed prod site keys off `is_highlighted`, which my local testing never
writes — so promoting/expiring test rows against the shared DB cannot float or badge anything on
the live marketplace. Test rows are additionally created→tested→deleted in one run.

## Renewal (auto-email at day 29 + one-click renew)

- **Cron `expire-promotions`** (extends the existing `expire-highlights` route): clears
  `promotion_plan` for rows past `promotion_expires_at` (and keeps the legacy `is_highlighted=false`
  expiry so prod stays correct), busts the `listings` cache.
- **Cron `renewal-reminders`** (new): for rows with `promotion_plan` not null,
  `promotion_expires_at` within the next 24h, and `renewal_reminded_at is null` → send a
  brand-styled reminder email and set `renewal_reminded_at=now`.
- **Reminder email** (brand shell in `lib/email.js`): professional copy — for `home` "your listing
  will be removed from the home page in 1 day", for `verified` "your listing will lose its Verified
  badge in 1 day" — with a **one-click "Renew 30 days · US$X"** button.
- **One-click renew** `GET /api/promo/renew?token=…`: HMAC-signed token (pid+uid+plan+exp) so the
  link works straight from the email. Charges the vaulted card **off-session**, extends
  `promotion_expires_at` by 30 days, records a `payments` row (`kind='renewal'`, `plan`), resets
  `renewal_reminded_at=null`, shows a confirmation page. If the card needs authentication / there's
  no saved card, it redirects to `/cuenta/pagos` to complete. The renewal appears in the buyer
  portal transaction history.

## Sell UI (wizard + /publicar)

Replace the single checkbox with **two mutually-exclusive selectable boxes**:
- **Box A — Verified (US$5):** heading + benefits (Verified badge on marketplace & home; star pin
  on the map that never hides in clusters; normal order).
- **Box B — Feature on landing page (US$20):** carries a **"Recommended" / "Recomendado"** badge
  (this replaces the old "Featured" star tag on the box); benefits = "Everything in Verified" +
  "Shown on the home page", with the explicit line "Verified tag on marketplace + Display on home
  page".
- You cannot select both at once. Selecting one deselects the other; clicking the selected box
  clears back to free.
- The publish button label switches: **Publish for free → Publish for US$5 → Publish for US$20**.
- After the free publish, the payment modal opens for the selected plan.

## Payment modal (PromotionModal, extends HighlightModal)

Plan-aware (`plan` prop → price/copy) and bilingual (`lang` prop). Saved-card one-click + new-card
PaymentElement, card-only, brand appearance — unchanged mechanics, parameterized by plan.

## Out of scope / unchanged
- Free publishing flow, completeness gate, image pipeline, auth.
- Stripe vaulting mechanics (customer, saveDefaultCard, off_session).
- Admin portal (only has a manual `is_highlighted` toggle; not part of this feature).

## Testing (Stripe sandbox + shared AiroBase, with cleanup)
Every case: verified purchase (new card + saved card), home purchase, ordering is NOT floated,
relevance sort includes promoted, map pin flags (`hl`+plan) and the promoted pin renders a
star/larger, home-page shows home-tier, expiry clears promotion, day-29 reminder selects+emails+
sets reminded flag, one-click token renew charges+extends+logs to history, mutual exclusivity +
button text. Test rows created→verified→deleted (DELETE with no Content-Type).
