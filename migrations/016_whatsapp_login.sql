-- 016 — sign in with WhatsApp (Relay one-time codes).
-- users.phone already exists (free text typed at sign-up). A WhatsApp code proves the
-- person owns the number: we then store it as E.164 (+595981234567) and stamp
-- phone_verified_at. Only verified numbers can sign in, and one verified number
-- belongs to one account.
alter table public.users add column if not exists phone_verified_at timestamptz;

create unique index if not exists users_verified_phone_key
  on public.users (phone)
  where phone_verified_at is not null;
