-- Saves by visitors who are NOT logged in (heart on a listing). Keyed by the browser's
-- device id (cookie cl_did, lib/deviceSignals.js). When that person signs in, their guest
-- saves move into `favorites` (lib/favorites.js mergeGuestFavorites). Sellers see the total
-- (favorites + guest_favorites) as "N personas guardaron tu propiedad".
-- Safe to run more than once.
create table if not exists public.guest_favorites (
  device_id   text        not null,
  property_id uuid        not null references public.properties(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (device_id, property_id)
);

create index if not exists guest_favorites_property_idx on public.guest_favorites (property_id);

alter table public.guest_favorites enable row level security;
