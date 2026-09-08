-- Casa Libre Buyer Portal — "Destacar" (highlight) paid promotion + Stripe payments.
-- Apply to the buyer/test AiroBase DB (proj_d34d…). Idempotent — safe to re-run.
--   • AiroBase SQL Editor: paste this whole file and Run.
--   • or psql "postgresql://role_…:<password>@db.airosofts.com:5432/proj_…" -f migrations/003_highlight_payments.sql
--
-- FULLY ADDITIVE: new nullable columns + one new table + indexes. Nothing existing
-- reads them until the highlight code ships, so applying this does NOT affect the
-- live site. Highlight = a paid 30-day featured state; $5 per highlight.

-- (pgcrypto / gen_random_uuid() is already installed by migration 001_auth.sql.)

-- 1. properties — the paid 30-day highlight state.
alter table public.properties add column if not exists is_highlighted   boolean not null default false;
alter table public.properties add column if not exists highlighted_at    timestamptz;
alter table public.properties add column if not exists highlighted_until timestamptz;
-- The marketplace "highlighted on top" ordering only cares about currently-highlighted
-- rows (a tiny subset), so index just those.
create index if not exists properties_highlighted_idx
  on public.properties (highlighted_until desc)
  where is_highlighted;

-- 2. users — Stripe customer + the vaulted default card (for one-click re-highlight).
alter table public.users add column if not exists stripe_customer_id text;
alter table public.users add column if not exists card_brand         text;
alter table public.users add column if not exists card_last4         text;
alter table public.users add column if not exists card_exp_month     int;
alter table public.users add column if not exists card_exp_year      int;
alter table public.users add column if not exists card_pm_id         text;   -- default PaymentMethod for off_session charges

-- 3. payments — one row per highlight charge attempt (success OR failure) = the
--    user's transaction history.
create table if not exists public.payments (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.users(id) on delete cascade,
  property_id              uuid references public.properties(id) on delete set null,
  kind                     text not null default 'highlight',
  amount_usd               numeric(10,2) not null,
  currency                 text not null default 'usd',
  status                   text not null,          -- 'succeeded' | 'failed'
  stripe_payment_intent_id text,
  card_brand               text,
  card_last4               text,
  failure_reason           text,
  highlight_until          timestamptz,            -- the window this charge granted (on success)
  created_at               timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
-- Guard against double-granting on a retried confirm: at most one succeeded row per PaymentIntent.
create unique index if not exists payments_pi_unique
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null and status = 'succeeded';

-- 4. Lock down: RLS on, NO policies -> only the service_role key (server-side) touches it.
alter table public.payments enable row level security;
