// How complete a seller's Profile Personalization is (Settings' progress bar).
// Pure, so tests load it directly. Seven items, each worth the same:
//   photo or logo (approved), first name, last name, job title, company, company website,
//   confirmed WhatsApp.
// Colour: red under 3 items, yellow 3–5, green 6–7.

export const ITEMS = ['photo', 'first_name', 'last_name', 'job_title', 'company_name', 'company_website', 'whatsapp'];

const filled = (v) => String(v ?? '').trim() !== '';

// prof: the Settings form values; photoStatus: 'approved' | 'checking' | 'rejected' | 'none' | …
export function profileCompletion(prof = {}, { photoStatus = null, hasPhoto = false } = {}) {
  const done = {
    photo: hasPhoto || photoStatus === 'approved',
    first_name: filled(prof.first_name),
    last_name: filled(prof.last_name),
    job_title: filled(prof.job_title),
    company_name: filled(prof.company_name),
    company_website: filled(prof.company_website),
    whatsapp: !!prof.phone_verified,
  };
  const count = ITEMS.filter((k) => done[k]).length;
  const pct = Math.round((count / ITEMS.length) * 100);
  const tone = count >= 6 ? 'green' : count >= 3 ? 'yellow' : 'red';
  return { count, total: ITEMS.length, pct, tone, done, missing: ITEMS.filter((k) => !done[k]) };
}
