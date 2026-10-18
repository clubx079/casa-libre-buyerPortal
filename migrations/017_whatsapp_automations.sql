-- 017 — automations by WhatsApp (Relay templates) as well as email.
-- Additive + nullable/defaulted: nothing changes until an admin picks WhatsApp on an
-- automation (admin → Automations → WhatsApp & channels). Run on each country DB
-- (SANDBOX first; PY is live: apply on purpose).

-- Per automation: how it sends, and which approved WhatsApp template stands in for each
-- of its email templates: { "<email_templates.id>": "cl_visitas", … }.
alter table public.automations add column if not exists channel text not null default 'email';
alter table public.automations add column if not exists wa_templates jsonb;

-- WhatsApp consent ("Acepto recibir avisos por WhatsApp") and opt-out (STOP / "No recibir más").
alter table public.users add column if not exists whatsapp_opt_in_at timestamptz;
alter table public.users add column if not exists whatsapp_opted_out_at timestamptz;

-- One log for both channels: WhatsApp rows have channel 'whatsapp', the number and
-- Relay's message id (the Relay webhook moves them to delivered / read / failed).
alter table public.email_log add column if not exists channel text not null default 'email';
alter table public.email_log add column if not exists to_phone text;
alter table public.email_log add column if not exists relay_message_id text;
create index if not exists email_log_relay_message_idx on public.email_log (relay_message_id) where relay_message_id is not null;

notify pgrst, 'reload schema';
