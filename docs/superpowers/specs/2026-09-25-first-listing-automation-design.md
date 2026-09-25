# First-listing automation + Email templates — design

Date: 2026-09-25 · Status: approved in chat, building locally (not pushed)

## Goal

Reward a seller's **first** listing with **30 days of free home-page display**, and
near the end of those days email them a **"extend for US$20"** button. Give admins two
new pages to run it: **Email templates** (create/edit custom templates) and
**Automations** (switch the flow on/off, edit its day numbers, see results).

## Decisions (from the brainstorm)

| Topic | Decision |
|---|---|
| Home slots (6) | **Paid first; free listings only fill empty slots**, rotated. |
| Emails | **Option A**: gift email when free display starts + ending-soon email with pay button. |
| Editor | **Simple fields + branded frame** (subject, heading, body, optional button). Live preview. |
| Existing users | **Only first listings published after the automation is switched on.** |
| Where it runs | Admin portal edits (per-country DB); **buyer portal hourly cron** runs the flow and sends. |
| Pay button | Signed link → signs the owner in → `/cuenta/publicaciones?pay=<id>&plan=home` (existing Stripe flow: one-click on a saved card, else card modal). Days stack onto the free period (`extendFrom`). No new pay page. |

## Timeline (defaults, all editable)

First listing published (day 0) → wait **2** days → gift: home display for **30** days +
gift email → **3** days before the end: ending-soon email with pay button → free days end,
the existing `expire-highlights` cron removes the home display.

## Data (new tables, one set per country DB) — `migrations/005_automations.sql`

- `email_templates` — `id uuid pk`, `key text unique null` (system key, e.g.
  `first-listing-gift`; null for custom), `name`, `subject`, `heading`, `body`,
  `button_label null`, `button_url null`, `is_active bool`, `created_at`, `updated_at`.
- `automations` — `id text pk` (`first_listing_free_home`), `enabled bool`,
  `enabled_at timestamptz null` (set when switched on; only first listings created
  after it count), `wait_days int` (2), `free_days int` (30), `remind_days_before int` (3),
  `gift_template_id uuid`, `reminder_template_id uuid`, `updated_at`.
- `automation_runs` — one row per user per automation (`unique(automation_id,user_id)`):
  `property_id`, `status` (`gifted|reminded|converted|done|skipped`), `skip_reason`,
  `first_listed_at`, `gifted_at`, `free_until`, `reminded_at`, `converted_at`, `last_error`.
- `email_log` — every automated/test email: `automation_id`, `run_id`, `template_id`,
  `template_key`, `to_email`, `subject`, `resend_id`, `status` (`sending|sent|failed|test`),
  `error`, `dedupe_key text unique` (e.g. `gift:<run>`), `created_at`.
- Seeds: the two Spanish system templates and the automation row (**disabled**).
- RLS on, no policies (service role only), like migrations 003/004.

**No change to `properties`.** "Free" is known from `automation_runs` (status
`gifted|reminded`), so the paid code paths are untouched and nothing breaks before the
migration is applied.

## Components

**Shared renderer** `lib/emailTemplateRender.js` (identical file in both repos, pure):
`interpolate(str, vars)` (`{{var}}`, HTML-escaped; keys ending in `url` inserted raw but
must be http(s)), `bodyToHtml(body)` (blank line → paragraph, `**bold**`, `[text](url)`),
`renderTemplate(tpl, vars, frame)` → `{ subject, html, text }` inside the Casa Libre frame
(logo + tld, card, heading, body, ink pill button, app-badge footer). `frame.badges` is
`cid` in real sends and data URIs in the admin preview.

**Variables:** `{{name}}`, `{{property_title}}`, `{{property_url}}`, `{{free_until}}`,
`{{days_left}}`, `{{free_days}}`, `{{extend_url}}`, `{{price}}`.

**Engine (buyer portal)** `lib/automations/firstListing.js` — `runFirstListing(deps)`,
pure with injected `db`, `now`, `send`, `grant`, `signExtendUrl`. Steps per run:
1. *Convert*: runs `gifted|reminded` whose property has a succeeded payment after
   `gifted_at` → `converted`.
2. *Finish*: runs `gifted|reminded` with `free_until < now` → `done`.
3. *Remind*: runs `gifted` with `free_until - remind_days <= now` → send reminder (dedupe
   `remind:<run>`) → `reminded`.
4. *Gift*: user listings (`origin=user`) with `enabled_at <= created_at <= now - wait_days`;
   users without a run; the user's earliest user listing must be ≥ `enabled_at` (else
   `skipped:not_first`); listing must be active, complete and have a photo (else
   `skipped:no_photo|inactive`); already promoted → `skipped:already_promoted`. Otherwise
   grant `home` for `free_days` (days stack on nothing — it has no promotion), insert run
   `gifted`, send gift (dedupe `gift:<run>`).
Max 200 users per tick. Email dedupe: insert the `email_log` row first; a duplicate key
means "already sent" → skip. A failed send deletes its log row (retried next tick) and
stores `last_error` on the run.

**Cron** `app/api/cron/automations/route.js` — `Bearer CRON_SECRET` (same helper as the
other crons), loads the automation + templates, runs the engine, `revalidateTag('listings')`.
`AUTOMATION_EMAIL_OVERRIDE` (local/testing) redirects every automated email.

**Pay link** `app/api/promo/extend/route.js` — verifies the signed token (`promoToken`,
14 days), checks the listing still belongs to the user, sets the session cookie for that
user if they are not signed in as them, redirects to `/cuenta/publicaciones?pay=<id>&plan=home`.

**Home page** — paid `home` listings first, then free ones (ids from active runs) filling
the remaining of the 6 slots, rotated by hour. `renewal-reminders` cron skips free runs
(the automation sends its own reminder).

**Admin portal**
- Nav: **Email templates** (`/email-templates`) and **Automations** (`/automations`).
- `GET/POST /api/email-templates`, `GET/PUT/DELETE /api/email-templates/[id]` (delete
  blocked while an automation uses it), `POST /api/email-templates/[id]/test` (sends to
  `ADMIN_TEST_EMAIL`, default `omar@airosofts.com`, logged as `test`).
- `GET/PUT /api/automations` (settings + stats + recent runs). Turning it on stamps
  `enabled_at`.
- Pages: templates list; editor (fields left, live preview right, variable chips insert at
  the cursor, Save / Send test / Duplicate / Delete); automations card with on/off, the
  timeline with editable numbers + template pickers, stats (in flow, gifted, reminded,
  converted, revenue) and the 20 latest runs.
- Every route uses `dbFor(activeCountry())`; a missing table returns `pending:true` and
  the page explains the migration isn't applied yet.

## Testing

- Unit (node:test in buyer portal, vitest in admin): renderer (escaping, url keys, body
  formatting), engine state machine (gift once, not_first, no_photo, remind window,
  convert, done, dedupe, 200 cap).
- End-to-end locally against a **local PostgREST stand-in** (in-memory, same query API)
  seeded with fake users/listings: admin pages create/edit/preview templates and toggle
  the automation; buyer-portal cron gifts + reminds; emails go only to omar@airosofts.com
  via `AUTOMATION_EMAIL_OVERRIDE`; pay link redirects correctly. Both apps `next build`.
- No live database is written; nothing is pushed.

## Build order

1. Migration SQL + shared renderer (+ tests).
2. Engine (+ tests), cron route, pay link, home ordering, renewal-reminder skip.
3. Admin APIs + pages (+ tests).
4. Local stand-in DB + end-to-end run + builds.

## Out of scope

Visual flow builder, other triggers, open/click tracking per template (the Email
analytics tab already covers Resend totals), English template variants.
