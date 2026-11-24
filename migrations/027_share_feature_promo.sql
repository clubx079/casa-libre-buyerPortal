-- Casa-Libre — "New: share your listing" announcement email + its automation (2026-11-25).
-- Apply to EACH country DB (PY, BO, UY, VE, SV) in the AiroBase SQL editor — only after the test
-- email is approved. Idempotent: safe to run twice; an existing row (maybe edited in the admin) is
-- left as it is. No begin/commit (the editor rejects them). NO new table, column or constraint:
-- automations.id is free text (no CHECK / enum), settings live in `automations`, sends in
-- `email_log` (lib/shareFeature.js, lib/automations/shareFeature.js).
-- The code works before this runs: without the row the cron reports skippedReason 'not_set_up'.
--   1. email template share-feature-promo (same text as lib/shareFeature.js SHARE_FEATURE_TEMPLATE)
--   2. automations 'share_feature_promo' — OFF; email; template_id = share-feature-promo;
--      free_tiers[0] = { firstAfterHours: 24, everyHours: 48, maxSends: 0 (= no limit), perRun: 100 }
-- Switch it on per country in Admin → Automations → "Share feature announcement" after approval.

-- 1. Template
insert into public.email_templates (key, name, subject, heading, body, button_label, button_url, is_active)
values ($cl$share-feature-promo$cl$, $cl$Compartir — anuncio de la nueva función$cl$,
$cl$Nuevo en Casa-Libre: compartí tu propiedad y sumá más visitas$cl$,
$cl$Compartí tu propiedad y llegá a más interesados$cl$,
$cl$>> WhatsApp, Instagram, Gmail, X o un link: tu propiedad llega a más personas en un toque. Mirá la demo.
Hola {{name}},

Ahora podés compartir tu propiedad de Casa-Libre en WhatsApp, Instagram, Gmail o X, o copiar su link, en un solo toque. Compartirla es la forma más rápida de sumar visitas: cada persona que abre tu link ve tu propiedad, y los compradores o inquilinos interesados te escriben directo a tu WhatsApp.

Funciona en la web y en la app de Casa-Libre para iPhone y Android. Mirá la demo aquí:

[[Ver la demo]](https://www.youtube.com/watch?v=FcI87hgYEMY)$cl$,
$cl$Compartir mi propiedad$cl$, $cl${{my_listings_url}}$cl$, true)
on conflict (key) do nothing;

-- 2. The automation (OFF)
insert into public.automations (id, enabled, wait_days, channel, template_id, free_tiers, updated_at)
select 'share_feature_promo', false, 0, 'email',
  (select id from public.email_templates where key = 'share-feature-promo' limit 1),
  jsonb_build_array(jsonb_build_object('firstAfterHours', 24, 'everyHours', 48, 'maxSends', 0, 'perRun', 100)),
  now()
on conflict (id) do nothing;

-- Check:
-- select id, enabled, template_id, free_tiers from public.automations where id = 'share_feature_promo';
-- select key, subject from public.email_templates where key = 'share-feature-promo';
