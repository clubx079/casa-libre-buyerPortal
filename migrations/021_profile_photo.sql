-- 021: seller profile photo (faces only, AI-checked) — lib/profilePhoto.js, lib/profilePhotoScan.js,
-- /api/account/profile-photo, Mi cuenta → "Tu foto de perfil".
--
-- One photo per account, kept on the account itself (users):
--   profile_photo_url / _key           the APPROVED photo: the one buyers see on the seller's
--                                      listings (cards, map, property page, app). null = none.
--   profile_photo_pending_url / _key   the latest upload or replacement (a draft, saved at once)
--                                      while it is checked, or after it was rejected. Never shown
--                                      to buyers; the approved one keeps showing meanwhile.
--   profile_photo_status               of the latest upload: 'checking' | 'approved' | 'rejected'
--                                      (null = never uploaded / removed)
--   profile_photo_category / _reason   why it was rejected (category code + short Spanish text)
--   profile_photo_checked_at           when the AI check last decided
--   profile_photo_attempts / _error    AI check tries (an AI error keeps it 'checking' and the
--                                      hourly cron /api/cron/image-scan asks again)
--   profile_photo_updated_at           last upload / replacement / removal
-- Files live in the listing-photo bucket (lib/b2.js) under avatars/<user id>/<random>.jpg.
--
-- Safe to run more than once. No begin/commit (the AiroBase SQL editor rejects them).
alter table public.users add column if not exists profile_photo_url         text;
alter table public.users add column if not exists profile_photo_key         text;
alter table public.users add column if not exists profile_photo_pending_url text;
alter table public.users add column if not exists profile_photo_pending_key text;
alter table public.users add column if not exists profile_photo_status      text;
alter table public.users add column if not exists profile_photo_category    text;
alter table public.users add column if not exists profile_photo_reason      text;
alter table public.users add column if not exists profile_photo_checked_at  timestamptz;
alter table public.users add column if not exists profile_photo_attempts    integer not null default 0;
alter table public.users add column if not exists profile_photo_error       text;
alter table public.users add column if not exists profile_photo_updated_at  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_profile_photo_status_check') then
    alter table public.users add constraint users_profile_photo_status_check
      check (profile_photo_status is null or profile_photo_status in ('checking', 'approved', 'rejected'));
  end if;
end $$;

-- The hourly retry looks for photos still being checked; the listing pages look up sellers
-- with an approved photo. Both sets are small → partial indexes.
create index if not exists users_profile_photo_checking_idx on public.users (profile_photo_updated_at)
  where profile_photo_status = 'checking';
create index if not exists users_profile_photo_url_idx on public.users (id)
  where profile_photo_url is not null;
