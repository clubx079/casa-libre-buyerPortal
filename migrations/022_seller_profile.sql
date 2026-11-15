-- 022: seller "Perfil profesional" — lib/sellerProfile.js, PATCH /api/account/profile,
-- Mi cuenta → Ajustes → "Perfil profesional", seller card on the listings (PropertyContactCard).
--
--   first_name / last_name   the seller's name; saving them also rewrites users.full_name
--                            (first + last), which the rest of the site keeps using
--   job_title                cargo, e.g. "Agente inmobiliario"
--   company_name             empresa / inmobiliaria
--   company_website          normalised http(s) URL (validated by the API); linked on the
--                            listings with rel="nofollow noopener"
-- All optional / nullable. The confirmed WhatsApp already lives in users.phone +
-- users.phone_verified_at (no new column).
--
-- Safe to run more than once. No begin/commit (the AiroBase SQL editor rejects them).
alter table public.users add column if not exists first_name      text;
alter table public.users add column if not exists last_name       text;
alter table public.users add column if not exists job_title       text;
alter table public.users add column if not exists company_name    text;
alter table public.users add column if not exists company_website text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_company_website_check') then
    alter table public.users add constraint users_company_website_check
      check (company_website is null or (company_website ~* '^https?://' and length(company_website) <= 200));
  end if;
end $$;

-- PostgREST: pick up the new columns now.
notify pgrst, 'reload schema';
