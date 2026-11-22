-- 023: "Buyer or seller" — lib/userType.js, lib/userTypeStore.js, POST /api/account/user-type,
-- the "¿Sos vendedor o comprador?" question after sign-up (website + app), admin Users "Type".
--
--   user_type         'seller' | 'buyer'; null = not known yet (treated as before: still gets
--                     every email, lib/userType.js inSellerAudience)
--   user_type_source  how we know: sell_funnel | signup_choice | login_choice | listing |
--                     app_sell | backfill_listed | backfill_sell_funnel | backfill_draft |
--                     backfill_login
--   user_type_at      when it was set
--   first_listed_at   first time the account published a listing (kept when the listing is
--                     deleted). "Listed" in the admin = this OR a listing still owned.
--
-- The code works before this runs (writes are skipped, nobody is asked, no filter applied).
-- Afterwards run the backfill (admin scripts/backfill-user-type.mjs) per country.
-- Safe to run more than once. No begin/commit (the AiroBase SQL editor rejects them).
alter table public.users add column if not exists user_type        text;
alter table public.users add column if not exists user_type_source text;
alter table public.users add column if not exists user_type_at     timestamptz;
alter table public.users add column if not exists first_listed_at  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_user_type_check') then
    alter table public.users add constraint users_user_type_check
      check (user_type is null or user_type in ('seller', 'buyer'));
  end if;
end $$;

create index if not exists users_user_type_idx on public.users (user_type);

-- PostgREST: pick up the new columns now.
notify pgrst, 'reload schema';
