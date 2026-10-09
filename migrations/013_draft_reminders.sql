-- Casa Libre — "unfinished draft reminders" automation. Run AFTER 005, 006 and 008, on
-- each country DB. Idempotent: safe to run twice.
--   • AiroBase SQL Editor: paste this whole file and Run.
--
-- DATA ONLY — no table or column is added or changed. It reuses the columns 006 added:
--   automations.milestones  = the reminder steps, in HOURS since the draft was last
--                             changed (e.g. {24,72,168} = after 1, 3 and 7 days; 1–5 steps)
--   automations.template_id = the email sent at every step
-- Sent emails are logged in email_log (automation_id 'draft_reminders', run_id = the
-- draft id, dedupe_key draft:<draft id>:<step>), so each step goes once per draft.
--
-- Already inserted (via the REST API) into PY, BO, UY and VE on 2026-10-09; this file
-- is for new country DBs. The automation is seeded DISABLED: nothing is sent until an
-- admin switches it on in Admin → Automations.

-- 1. The Spanish template (edit it in Admin → Email templates).
insert into public.email_templates (key, name, subject, heading, body, button_label, button_url)
values
  ('draft-reminder',
   'Borrador sin terminar — recordatorio',
   'Te falta poco para publicar tu propiedad',
   'Tu propiedad está casi lista',
   $body$Hola {{name}},

Empezaste a publicar **{{property_title}}** en Casa Libre y quedó guardada como borrador. Lo que cargaste sigue ahí.

![{{property_title}}]({{photo_url}})

Te falta poco: tocá el botón y seguí justo donde lo dejaste. Publicar es gratis.$body$,
   'Continuar mi publicación',
   '{{draft_url}}')
on conflict (key) do nothing;

-- 2. The automation, DISABLED: reminders after 1, 3 and 7 days without changes.
insert into public.automations (id, enabled, milestones, template_id)
select 'draft_reminders', false, array[24, 72, 168],
       (select id from public.email_templates where key = 'draft-reminder')
on conflict (id) do nothing;
