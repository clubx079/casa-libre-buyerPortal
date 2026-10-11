-- Casa Libre — "same property listed twice" automation (lib/automations/duplicateListings.js).
-- Run on each country DB, after 005/006. Idempotent. DATA ONLY — no table or column changes.
-- Already inserted (via the REST API) into PY, BO, UY and VE on 2026-10-12, switched ON;
-- this file is for new country DBs (seeded OFF: switch it on in Admin → Automations).
-- Emails: email_log automation_id 'duplicate_listings', run_id = the newest copy,
-- dedupe_key dup:<every copy's id, sorted> — once per set of copies.

insert into public.email_templates (key, name, subject, heading, body, button_label, button_url)
values
  ('duplicate-listing',
   'Propiedad publicada más de una vez',
   'Publicaste la misma propiedad más de una vez',
   'Notamos una publicación repetida',
   $body$Hola {{name}},

Notamos que publicaste **{{property_title}}** {{listing_count}} veces en Casa Libre, con los mismos datos:

{{listing_links}}

Para que los compradores no vean la misma propiedad repetida, te recomendamos dejar una sola publicación y eliminar las demás desde Mis publicaciones.$body$,
   'Ir a Mis publicaciones',
   '{{my_listings_url}}')
on conflict (key) do nothing;

insert into public.automations (id, enabled, template_id)
select 'duplicate_listings', false, (select id from public.email_templates where key = 'duplicate-listing')
on conflict (id) do nothing;
