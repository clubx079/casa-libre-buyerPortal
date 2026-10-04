-- 012 — where the buyer was when they contacted a seller (WhatsApp / call / copy).
-- The admin's UTM Links → WhatsApp contacts tab shows IP + location per contact and
-- hides contacts from the dev team's country. Filled by /api/contact-track from
-- Cloudflare's headers (lib/contactGeo.js). Nullable: older rows stay empty.
-- Safe to run more than once. Run on each country DB (PY is live: apply on purpose).
alter table public.contact_link_clicks add column if not exists buyer_ip text;
alter table public.contact_link_clicks add column if not exists buyer_country text;  -- ISO code, e.g. PY
alter table public.contact_link_clicks add column if not exists buyer_city text;
