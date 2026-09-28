-- 008_listing_drafts.sql — unfinished sell-wizard listings ("Borradores").
-- A draft is created once a signed-in user has picked the property's address, is
-- autosaved as they fill the details, and deleted when the listing is published.
-- Additive and idempotent; touches no existing table.
create table if not exists public.listing_drafts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists listing_drafts_user_idx on public.listing_drafts (user_id, updated_at desc);
