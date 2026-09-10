-- Casa Libre Buyer Portal — two promotion plans (Verified + Landing) replacing the
-- single $5 highlight. Apply to the buyer/test AiroBase DB (proj_d34d…). Idempotent.
--   • AiroBase SQL Editor: paste this whole file and Run.
--   • or psql "postgresql://role_…:<password>@db.airosofts.com:5432/proj_…" -f migrations/004_promotion_plans.sql
--
-- FULLY ADDITIVE + NON-BREAKING. The legacy is_highlighted/highlighted_at/highlighted_until
-- columns from 003 are LEFT IN PLACE and the currently-deployed prod site keeps using them.
-- The new promotion code writes ONLY the promotion_* columns below, so applying this and
-- running the new code locally CANNOT float/badge anything on the live marketplace.
--
-- Plans:  'verified' = US$5/30d  → Verified badge + map star (normal order)
--         'home'     = US$20/30d → everything in verified + shown on the landing page
--         (home ⊃ verified: both are "promoted")

-- 1. properties — the tiered 30-day promotion state.
alter table public.properties add column if not exists promotion_plan       text;
alter table public.properties add column if not exists promoted_at          timestamptz;
alter table public.properties add column if not exists promotion_expires_at timestamptz;
alter table public.properties add column if not exists renewal_reminded_at  timestamptz;  -- day-29 email dedupe; cleared on renew/expire

-- Constrain the plan values (allow NULL = not promoted). Drop-then-add so re-runs stay clean.
alter table public.properties drop constraint if exists properties_promotion_plan_chk;
alter table public.properties add  constraint properties_promotion_plan_chk
  check (promotion_plan is null or promotion_plan in ('verified','home'));

-- Only currently-promoted rows matter for expiry/reminder scans (a tiny subset).
create index if not exists properties_promotion_idx
  on public.properties (promotion_expires_at desc)
  where promotion_plan is not null;

-- 2. payments — which plan a charge was for + allow the 'renewal' kind.
alter table public.payments add column if not exists plan text;   -- 'verified' | 'home' (null on legacy rows)

-- 3. Backfill: any live legacy highlight becomes the premium 'home' tier (old highlight
--    was top-of-list + home placement, closest to the new landing plan). Only touches rows
--    not already migrated; leaves is_highlighted untouched.
update public.properties
   set promotion_plan       = 'home',
       promoted_at          = coalesce(highlighted_at, now()),
       promotion_expires_at = highlighted_until
 where is_highlighted = true
   and promotion_plan is null;
