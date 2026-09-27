-- 007_zoning.sql — per-listing zoning (Asunción first; other cities later via
-- lib/zoning/providers.js). Additive and idempotent: only adds nullable columns.
alter table public.properties add column if not exists zoning_code       text;
alter table public.properties add column if not exists zoning_category   text;
alter table public.properties add column if not exists zoning_max_floors integer;
alter table public.properties add column if not exists zoning_source     text;
alter table public.properties add column if not exists zoning_checked_at timestamptz;
-- the coordinates the zone was computed for, so a moved listing gets re-zoned
alter table public.properties add column if not exists zoning_lat        double precision;
alter table public.properties add column if not exists zoning_lng        double precision;
alter table public.properties drop constraint if exists properties_zoning_category_chk;
alter table public.properties add constraint properties_zoning_category_chk
  check (zoning_category is null or zoning_category in ('baja','media','alta','otro'));
create index if not exists properties_zoning_category_idx
  on public.properties (zoning_category) where zoning_category is not null;
