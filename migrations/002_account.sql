-- Casa Libre Buyer Portal — account features: saved properties + Google login.
-- Run in the AiroBase SQL Editor for the buyer/test DB (proj_d34d…). Idempotent.

-- 1. Saved / favorite properties.
create table if not exists public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, property_id)
);
create index if not exists favorites_user_idx on public.favorites (user_id);

-- 2. Google login support on the existing users table.
alter table public.users add column if not exists google_id     text;
alter table public.users add column if not exists auth_provider text not null default 'email';
create index if not exists users_google_id_idx on public.users (google_id);

-- 3. Lock down: RLS on, no policies -> only the service_role key (server-side) touches it.
alter table public.favorites enable row level security;
