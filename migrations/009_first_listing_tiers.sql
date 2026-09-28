-- 009_first_listing_tiers.sql — Roland's free-highlight tiers for the
-- "first listing → free home display" automation:
--   • the first N sellers to ever list get free_days (30) on the home page,
--   • everyone after that gets later_free_days (7),
--   • the ending email goes remind_days_before (1) day before the end — "day 6 of 7".
-- A seller's place in line counts EVERY seller who published before them (including
-- the early sellers handled by hand before the automation existed).
-- Additive and idempotent. All three numbers are editable in Admin → Automations.
alter table public.automations add column if not exists first_tier_count integer not null default 25;
alter table public.automations add column if not exists later_free_days  integer not null default 7;
alter table public.automations drop constraint if exists automations_first_tier_count_chk;
alter table public.automations add constraint automations_first_tier_count_chk check (first_tier_count between 0 and 100000);
alter table public.automations drop constraint if exists automations_later_free_days_chk;
alter table public.automations add constraint automations_later_free_days_chk check (later_free_days between 1 and 365);
-- the ending email on the last day ("your highlight expires today"), unless someone already changed it
update public.automations set remind_days_before = 1 where id = 'first_listing_free_home' and remind_days_before = 3;
