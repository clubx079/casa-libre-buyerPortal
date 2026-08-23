-- WhatsApp contact-link tracking (buyer -> seller). A buyer tapping "Chat on
-- WhatsApp" creates a row; the message links back to the listing with a ?t=token,
-- and when the seller opens it the row is flagged opened. Feeds the admin
-- Contacts analytics page. Apply once in the AiroBase SQL editor.
create table if not exists public.contact_link_clicks (
  id             uuid primary key default gen_random_uuid(),
  token          text unique not null,
  buyer_user_id  uuid,
  buyer_name     text,
  buyer_email    text,
  property_id    text,
  listing_ref    text,
  seller_name    text,
  seller_phone   text,
  channel        text default 'whatsapp',   -- whatsapp | call | copy
  status         text default 'sent',       -- sent | opened
  created_at     timestamptz not null default now(),
  opened_at      timestamptz
);
create index if not exists ix_contact_clicks_created  on public.contact_link_clicks (created_at desc);
create index if not exists ix_contact_clicks_property on public.contact_link_clicks (property_id);
