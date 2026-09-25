-- Casa Libre — email templates + the "first listing → free home display" automation.
-- Apply to EACH country DB (PY, BO, UY, VE) — same AiroBase DB the buyer portal and the
-- admin portal read for that country. Idempotent: safe to run twice.
--   • AiroBase SQL Editor: paste this whole file and Run.
--   • or psql "postgresql://…/proj_…" -f migrations/005_automations.sql
--
-- FULLY ADDITIVE. No existing table or column is changed. The automation row is seeded
-- DISABLED — nothing is sent or granted until an admin switches it on in the admin
-- portal (Automations page), and only first listings created after that moment count.

create extension if not exists pgcrypto;

-- 1. Email templates (system ones have a fixed key; custom ones have key = null).
create table if not exists public.email_templates (
  id           uuid primary key default gen_random_uuid(),
  key          text unique,
  name         text not null,
  subject      text not null,
  heading      text not null default '',
  body         text not null default '',
  button_label text,
  button_url   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. Automations (one row per built-in flow).
create table if not exists public.automations (
  id                   text primary key,
  enabled              boolean not null default false,
  enabled_at           timestamptz,
  wait_days            integer not null default 2  check (wait_days between 0 and 60),
  free_days            integer not null default 30 check (free_days between 1 and 365),
  remind_days_before   integer not null default 3  check (remind_days_before between 1 and 60),
  gift_template_id     uuid references public.email_templates(id) on delete set null,
  reminder_template_id uuid references public.email_templates(id) on delete set null,
  updated_at           timestamptz not null default now()
);

-- 3. One run per user per automation — the state machine.
create table if not exists public.automation_runs (
  id              uuid primary key default gen_random_uuid(),
  automation_id   text not null references public.automations(id) on delete cascade,
  user_id         uuid not null,
  property_id     uuid,
  status          text not null check (status in ('gifted','reminded','converted','done','skipped')),
  skip_reason     text,
  first_listed_at timestamptz,
  gifted_at       timestamptz,
  free_until      timestamptz,
  reminded_at     timestamptz,
  converted_at    timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (automation_id, user_id)
);
create index if not exists automation_runs_status_idx on public.automation_runs (automation_id, status);

-- 4. Every automated / test email sent (dedupe + history for the admin pages).
create table if not exists public.email_log (
  id            uuid primary key default gen_random_uuid(),
  automation_id text,
  run_id        uuid,
  template_id   uuid,
  template_key  text,
  to_email      text not null,
  subject       text,
  resend_id     text,
  status        text not null check (status in ('sending','sent','failed','test')),
  error         text,
  dedupe_key    text unique,
  created_at    timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);

-- Service role only (the portals use the secret key); no anon access.
alter table public.email_templates enable row level security;
alter table public.automations     enable row level security;
alter table public.automation_runs enable row level security;
alter table public.email_log       enable row level security;

-- 5. Seed the two Spanish system templates (edit them in the admin portal).
insert into public.email_templates (key, name, subject, heading, body, button_label, button_url)
values
  ('first-listing-gift',
   'Primera publicación — regalo portada',
   '{{name}}, tu propiedad está en la portada de Casa Libre',
   'Un regalo por publicar con nosotros',
   $body$Hola {{name}},

Gracias por publicar tu primera propiedad en Casa Libre. Como regalo, destacamos **{{property_title}}** en la portada del sitio durante {{free_days}} días, gratis.

La vas a ver ahí hasta el **{{free_until}}**. No tenés que hacer nada.$body$,
   'Ver mi propiedad',
   '{{property_url}}'),
  ('first-listing-ending',
   'Primera publicación — fin de portada gratis',
   'Tu propiedad deja la portada el {{free_until}}',
   'Quedan {{days_left}} días en la portada',
   $body$Hola {{name}},

Tu período gratis en la portada de Casa Libre para **{{property_title}}** termina el **{{free_until}}**.

Si querés seguir frente a todos los compradores, extendelo 30 días más por {{price}}. Los días se suman al final del período gratis.$body$,
   'Extender por {{price}}',
   '{{extend_url}}')
on conflict (key) do nothing;

-- 6. Seed the automation, DISABLED, pointing at those templates.
insert into public.automations (id, enabled, wait_days, free_days, remind_days_before, gift_template_id, reminder_template_id)
select 'first_listing_free_home', false, 2, 30, 3,
       (select id from public.email_templates where key = 'first-listing-gift'),
       (select id from public.email_templates where key = 'first-listing-ending')
on conflict (id) do nothing;
