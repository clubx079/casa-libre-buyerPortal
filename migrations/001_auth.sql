-- Casa Libre Buyer Portal — accounts + email-OTP auth.
-- Apply to the buyer/test AiroBase DB (proj_d34d…). Idempotent.
--   psql "postgresql://role_…:<password>@db.airosofts.com:5432/proj_…" -f migrations/001_auth.sql

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- 1. users — registered publishers/buyers. Password is bcrypt (hashed in Node).
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text,                       -- bcrypt; null only for future social logins
  full_name     text,
  phone         text,
  verified      boolean not null default false,   -- email confirmed via OTP
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login_at timestamptz
);
create index if not exists users_email_idx on public.users (lower(email));

-- 2. otp_codes — one active code per (identifier, purpose). code_hash is bcrypt.
create table if not exists public.otp_codes (
  id                uuid primary key default gen_random_uuid(),
  identifier        text not null,          -- lowercased email
  purpose           text not null,          -- 'signup' | 'login' | 'password_reset'
  code_hash         text not null,          -- bcrypt of the 6-digit code
  meta              jsonb not null default '{}'::jsonb,   -- pending signup fields
  attempts          int  not null default 0,
  send_count        int  not null default 1,
  window_started_at timestamptz not null default now(),
  last_sent_at      timestamptz not null default now(),
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now()
);
create unique index if not exists otp_codes_identifier_purpose_key
  on public.otp_codes (identifier, purpose);

-- 3. Lock down: RLS on, NO policies -> only the service_role key (server-side) can touch them.
alter table public.users     enable row level security;
alter table public.otp_codes enable row level security;

-- 4. Ownership of published deals lives in the existing properties columns
--    (created_by / posted_by, both uuid). The publish API sets them to users.id.
--    No schema change needed here; documented for clarity.
