-- Casa Libre — "listing getting views" automation. Run AFTER 005_automations.sql, on
-- each country DB where you want it. Idempotent: safe to run twice.
--   • AiroBase SQL Editor: paste this whole file and Run.
--
-- FULLY ADDITIVE. Adds one column to `automations`, one new table, one template and
-- one automation row seeded DISABLED. Nothing is sent until an admin switches it on.

-- 1. The view numbers that trigger an email (e.g. {50} or {25,50,100}).
alter table public.automations add column if not exists milestones integer[];
-- Generic "which template does this automation send" (single-email automations).
alter table public.automations add column if not exists template_id uuid references public.email_templates(id) on delete set null;

-- 2. The last view number already handled per listing (so each number is emailed once).
create table if not exists public.listing_view_milestones (
  property_id    uuid primary key,
  user_id        uuid,
  last_milestone integer not null default 0,
  last_views     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.listing_view_milestones enable row level security;

-- 3. The Spanish template (edit it in the admin portal).
insert into public.email_templates (key, name, subject, heading, body, button_label, button_url)
values
  ('listing-views',
   'Tu propiedad tiene visitas',
   '{{property_title}} ya tiene {{views}} visitas',
   'Tu propiedad está llamando la atención',
   $body$Hola {{name}},

Tu publicación [{{property_title}}]({{property_url}}) ya recibió **{{views}} visitas** en Casa Libre. Los compradores la están mirando.

¿Tenés otra propiedad? Publicala gratis y llegá a los mismos compradores.$body$,
   'Publicar otra propiedad',
   '{{publish_url}}')
on conflict (key) do nothing;

-- 4. The automation, DISABLED, emailing at 50 views by default.
insert into public.automations (id, enabled, milestones, template_id)
select 'listing_views_milestone', false, array[50],
       (select id from public.email_templates where key = 'listing-views')
on conflict (id) do nothing;
