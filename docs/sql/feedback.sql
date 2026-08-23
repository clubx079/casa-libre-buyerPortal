-- User feedback (1–5 stars + comment) from /feedback. Feeds the admin Feedback
-- page. Apply once in the AiroBase SQL editor, then reload the API cache:
--   NOTIFY pgrst, 'reload schema';
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  name        text,
  email       text,
  rating      int,
  message     text,
  source      text default 'site',   -- welcome | listing | site
  created_at  timestamptz not null default now()
);
create index if not exists ix_feedback_created on public.feedback (created_at desc);
