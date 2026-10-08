// Every scheduled job of a country site. ONE hourly call to /api/cron/tick runs the
// ones that are due, on every country site (see app/api/cron/tick/route.js).
// To add an automation: add a line here — no new cron job anywhere, for any country.
export const CRON_JOBS = [
  { name: 'automations', path: '/api/cron/automations', everyHours: 1 },
  { name: 'expire-highlights', path: '/api/cron/expire-highlights', everyHours: 1 },
  { name: 'zoning', path: '/api/cron/zoning', everyHours: 1 },              // does nothing unless ZONING_ENABLED=1
  { name: 'renewal-reminders', path: '/api/cron/renewal-reminders', everyHours: 6 },
  { name: 'recompute-complete', path: '/api/cron/recompute-complete', everyHours: 6 },
  { name: 'draft-photos', path: '/api/cron/draft-photos', everyHours: 24 },   // photos of drafts untouched for 30 days
  { name: 'image-scan', path: '/api/cron/image-scan', everyHours: 1 },        // listings whose AI photo check didn't finish
];

// The jobs due at this hour (UTC): hourly ones always, 6-hourly at 00, 06, 12, 18.
export function dueJobs(date = new Date(), jobs = CRON_JOBS) {
  const h = date.getUTCHours();
  return jobs.filter((j) => h % j.everyHours === 0);
}

// The other country sites a tick passes the call on to: every country profile in
// lib/country.js except this one, so a new country is included as soon as it has a
// profile. countries = [{ code, url }].
export function otherSites(countries, selfCode) {
  return (countries || []).filter((c) => c && c.url && c.code !== selfCode);
}
