-- 019: the first-listing gift is granted only when the seller clicks
-- "Verificar mi publicación" in the email (app/api/gift/claim, lib/automations/firstListing.js).
-- No schema change: an open offer is automation_runs.status='skipped' + skip_reason='offered'.
-- This only rewrites the gift email — and only where it is still the original text
-- (an admin's own edits are left alone; they then need {{claim_url}} as the button link).
update public.email_templates
set subject      = '{{name}}, tenés un regalo: tu propiedad en la portada',
    heading      = 'Verificá tu publicación y destacala gratis',
    body         = $body$Hola {{name}},

Gracias por publicar tu primera propiedad en Casa Libre. Como regalo, queremos destacar **{{property_title}}** en la portada del sitio durante {{free_days}} días, gratis.

Solo tenés que verificar tu publicación con el botón de abajo: al instante queda destacada en la portada, donde la ven más compradores.

El regalo está disponible por 14 días.$body$,
    button_label = 'Verificar mi publicación',
    button_url   = '{{claim_url}}',
    updated_at   = now()
where key = 'first-listing-gift'
  and body like '%No tenés que hacer nada%';
