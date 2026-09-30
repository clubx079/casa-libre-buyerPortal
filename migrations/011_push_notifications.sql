-- 011_push_notifications.sql — remote push for the mobile app (Expo push service).
--   push_tokens        one row per device (Expo push token), linked to the signed-in user
--   notification_prefs per-user switches for the three notification channels
--   push_log           every send attempt; dedupe_key makes automated pushes send-once
-- Additive and idempotent; touches no existing table.

create table if not exists public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  token        text not null unique,              -- ExponentPushToken[...]
  platform     text not null check (platform in ('ios', 'android')),
  app_version  text,
  device_name  text,
  enabled      boolean not null default true,      -- false after logout / DeviceNotRegistered
  last_error   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id) where enabled;

create table if not exists public.notification_prefs (
  user_id    uuid primary key,
  listings   boolean not null default true,   -- about the user's own listings (views, expiring highlight…)
  saved      boolean not null default true,   -- saved properties / searches (price drops, new matches…)
  news       boolean not null default true,   -- product news and tips
  updated_at timestamptz not null default now()
);

create table if not exists public.push_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  token       text,
  channel     text,
  kind        text,                          -- e.g. 'test', 'listing_views', 'price_drop'
  title       text,
  body        text,
  data        jsonb not null default '{}'::jsonb,
  status      text not null,                 -- 'ok' | 'error' | 'skipped'
  ticket_id   text,
  error       text,
  dedupe_key  text unique,                   -- set for automated sends → never twice
  created_at  timestamptz not null default now()
);
create index if not exists push_log_user_idx on public.push_log (user_id, created_at desc);
