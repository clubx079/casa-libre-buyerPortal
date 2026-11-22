-- Casa-Libre — "Share your listing": the share emails + the share reward (2026-11-22).
-- Apply to EACH country DB (PY, BO, UY, VE, SV) in the AiroBase SQL editor. Idempotent: safe to
-- run twice; an existing row (maybe edited in the admin) is left as it is. No begin/commit (the
-- editor rejects them). NO new table or column: settings live in `automations`, records in
-- `email_log` (lib/shareReward.js, lib/automations/shareListing.js).
-- The code works before this runs: without the rows the cron reports skippedReason 'not_set_up'.
--   1. three email templates: share-nudge-published, share-nudge-lowviews, share-reward-earned
--      (same text as the admin's defaults)
--   2. automations 'share_nudge'  — OFF; email; milestones = hours after publishing [24, 168];
--      template_id = share-nudge-published, reminder_template_id = share-nudge-lowviews;
--      free_tiers[0].lowViews = { enabled, threshold, afterHours }
--   3. automations 'share_reward' — OFF; template_id = share-reward-earned;
--      free_tiers[0] = { visits: 20, reward: 'verified', days: 3, perListingOnce: true }

-- 1. Templates
insert into public.email_templates (key, name, subject, heading, body, button_label, button_url, is_active)
values ($cl$share-nudge-published$cl$, $cl$Compartir — publicación nueva$cl$,
$cl$Compartí tu publicación y llegá a más interesados$cl$,
$cl$Tu propiedad ya está en Casa-Libre: compartila$cl$,
$cl$Hola {{name}},

Tu publicación «{{listing_title}}» ya está en Casa-Libre. Compartirla en WhatsApp, Instagram o Facebook es la forma más rápida de que más personas la vean: cada persona que entra por tu link ve tu propiedad y te escribe directo a tu WhatsApp.

Compartila en un minuto desde la web o desde la app de Casa-Libre para iPhone y Android.$cl$,
$cl$Compartir mi publicación$cl$, $cl${{share_url}}$cl$, true)
on conflict (key) do nothing;

insert into public.email_templates (key, name, subject, heading, body, button_label, button_url, is_active)
values ($cl$share-nudge-lowviews$cl$, $cl$Compartir — pocas visitas$cl$,
$cl$Tu publicación puede llegar a más personas$cl$,
$cl$Más visitas con un solo link$cl$,
$cl$Hola {{name}},

Tu publicación «{{listing_title}}» tiene {{views}} visitas hasta ahora. Las propiedades que sus dueños comparten en WhatsApp, Instagram o Facebook reciben más visitas y más consultas.

Compartila desde la web o desde la app de Casa-Libre para iPhone y Android: los interesados te escriben directo a tu WhatsApp.$cl$,
$cl$Compartir mi publicación$cl$, $cl${{share_url}}$cl$, true)
on conflict (key) do nothing;

insert into public.email_templates (key, name, subject, heading, body, button_label, button_url, is_active)
values ($cl$share-reward-earned$cl$, $cl$Compartir — premio ganado$cl$,
$cl$¡Ganaste {{reward_text}} en Casa-Libre!$cl$,
$cl$Gracias por compartir tu publicación$cl$,
$cl$Hola {{name}},

{{visits_needed}} personas entraron a «{{listing_title}}» por los links que compartiste. Como agradecimiento, tu publicación tiene {{reward_text}} durante {{reward_days}} días.

Seguí compartiendo desde la web o desde la app de Casa-Libre para iPhone y Android.$cl$,
$cl$Ver mi publicación$cl$, $cl${{listing_url}}$cl$, true)
on conflict (key) do nothing;

-- 2. The share emails (OFF)
insert into public.automations (id, enabled, wait_days, channel, milestones, template_id, reminder_template_id, free_tiers, updated_at)
select 'share_nudge', false, 0, 'email', array[24, 168]::integer[],
  (select id from public.email_templates where key = 'share-nudge-published' limit 1),
  (select id from public.email_templates where key = 'share-nudge-lowviews' limit 1),
  jsonb_build_array(jsonb_build_object('lowViews', jsonb_build_object('enabled', true, 'threshold', 10, 'afterHours', 72))),
  now()
on conflict (id) do nothing;

-- 3. The share reward (OFF)
insert into public.automations (id, enabled, wait_days, channel, template_id, free_tiers, updated_at)
select 'share_reward', false, 0, 'email',
  (select id from public.email_templates where key = 'share-reward-earned' limit 1),
  jsonb_build_array(jsonb_build_object('visits', 20, 'reward', 'verified', 'days', 3, 'perListingOnce', true)),
  now()
on conflict (id) do nothing;
