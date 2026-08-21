-- Business/partner inquiries captured by /empresas (POST /api/partner-inquiries).
-- Apply in the AiroBase SQL editor (shared DB). Status workflow drives the
-- (future) admin leads page: new -> contacted -> migrating -> live | discarded.
create table if not exists public.partner_inquiries (
  id             uuid primary key default gen_random_uuid(),
  business_type  text,
  portfolio_size text,
  name           text not null,
  company        text,
  phone          text not null,
  email          text not null,
  city           text,
  message        text,
  lang           text default 'es',
  source         text default 'empresas',
  status         text default 'new',      -- new | contacted | migrating | live | discarded
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create index if not exists ix_partner_inquiries_status
  on public.partner_inquiries (status, created_at desc);
