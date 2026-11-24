-- Casa-Libre — weekly newsletter EDITIONS written automatically (admin lib/newsletterEditionRun.js).
-- Apply to EACH country DB (PY, BO, UY, VE, SV) in the AiroBase SQL editor. Idempotent: safe to
-- run twice. No begin/commit (the editor rejects them).
--
-- One row per generation attempt. status:
--   generating → the admin is writing it (a claim: only one generating/published row per week)
--   published  → complete and validated: the website shows it (/newsletter, /newsletter/<date>,
--                sitemap) and that week's weekly_newsletter email uses it
--   failed     → nothing was published; error says why (up to 3 tries a week)
-- issues  = [{ slug, cat, audience, name, subject, heading, body: [paragraphs], button_label,
--             button_url, story?, en: { subject, heading, body: [paragraphs] } }]
-- stories = 12 × { slug, metric, when, who, title, challenge, did, result, quote } (each { es, en })
-- vars    = the numbers measured when it was written (for the record; the page re-measures).

create table if not exists public.newsletter_editions (
  id           uuid primary key default gen_random_uuid(),
  week         text not null check (week ~ '^\d{4}-W\d{2}$'),
  date         date not null,
  status       text not null default 'generating' check (status in ('generating', 'published', 'failed')),
  issues       jsonb not null default '[]'::jsonb,
  stories      jsonb not null default '[]'::jsonb,
  vars         jsonb,
  model        text,
  error        text,
  created_at   timestamptz not null default now(),
  published_at timestamptz
);

-- one edition per ISO week: at most one row that is being written or published
create unique index if not exists newsletter_editions_week_once
  on public.newsletter_editions (week) where status in ('generating', 'published');
create index if not exists newsletter_editions_published_idx
  on public.newsletter_editions (date desc) where status = 'published';

-- Service role only (the website and the admin use the secret key); no anon access.
alter table public.newsletter_editions enable row level security;
