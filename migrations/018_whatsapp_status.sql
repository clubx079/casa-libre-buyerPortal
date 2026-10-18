-- 018 — email_log.status also takes the WhatsApp ticks from the Relay webhook
-- (sent → delivered → read). 005 allowed only sending / sent / failed / test, so the
-- webhook's updates were refused. Emails keep using the same values as before.
-- Run on each country DB (SANDBOX first; PY is live: apply on purpose).
alter table public.email_log drop constraint if exists email_log_status_check;
alter table public.email_log add constraint email_log_status_check
  check (status in ('sending', 'sent', 'failed', 'test', 'delivered', 'read'));

notify pgrst, 'reload schema';
