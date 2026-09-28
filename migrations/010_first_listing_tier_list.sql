-- 010_first_listing_tier_list.sql — any number of free-highlight tiers:
--   [{ "sellers": 30, "days": 30 }, { "sellers": 20, "days": 20 }, { "sellers": 10, "days": 10 }]
-- = sellers #1–30 get 30 days, the next 20 (#31–50) get 20, the next 10 (#51–60) get 10;
-- everyone after that gets later_free_days. Replaces the single first_tier_count/free_days
-- pair (kept in sync with the first tier for older code). Additive and idempotent.
alter table public.automations add column if not exists free_tiers jsonb;
alter table public.automations drop constraint if exists automations_free_tiers_chk;
alter table public.automations add constraint automations_free_tiers_chk
  check (free_tiers is null or jsonb_typeof(free_tiers) = 'array');
-- start from today's single tier (first 25 sellers → 30 days)
update public.automations
   set free_tiers = jsonb_build_array(jsonb_build_object('sellers', first_tier_count, 'days', free_days))
 where id = 'first_listing_free_home' and free_tiers is null;
