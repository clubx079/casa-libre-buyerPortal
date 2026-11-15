// Seller "Perfil profesional" — the pure part (no I/O, unit-tested in tests/sellerProfile.test.mjs).
//
// Mi cuenta → Ajustes → "Perfil profesional": first name, last name, title (cargo), company
// (empresa / inmobiliaria) and company website, on the users row (migration 022). Shown to
// buyers on the seller card of the seller's listings, next to the approved profile photo
// (components/PropertyContactCard.js). full_name stays the single "display name" the rest of
// the site uses: saving first + last name also rewrites full_name.
//
// Until migration 022 runs the columns don't exist: the API saves full_name only and answers
// { pending_migration: true }; the listing pages simply show no title / company / website.

export const PROFILE_COLUMNS = ['first_name', 'last_name', 'job_title', 'company_name', 'company_website'];

export const LIMITS = { first_name: 60, last_name: 60, job_title: 80, company_name: 100, company_website: 200 };

// Field error codes → Spanish (voseo) / English messages for the Settings form.
export const ERRORS = {
  es: {
    first_required: 'Ingresá tu nombre.',
    first_long: `El nombre es muy largo (máximo ${LIMITS.first_name} caracteres).`,
    last_long: `El apellido es muy largo (máximo ${LIMITS.last_name} caracteres).`,
    title_long: `El cargo es muy largo (máximo ${LIMITS.job_title} caracteres).`,
    company_long: `El nombre de la empresa es muy largo (máximo ${LIMITS.company_name} caracteres).`,
    website_invalid: 'El sitio web no es válido. Ejemplo: www.tuinmobiliaria.com.py',
    website_long: `El sitio web es muy largo (máximo ${LIMITS.company_website} caracteres).`,
  },
  en: {
    first_required: 'Enter your first name.',
    first_long: `The first name is too long (max ${LIMITS.first_name} characters).`,
    last_long: `The last name is too long (max ${LIMITS.last_name} characters).`,
    title_long: `The title is too long (max ${LIMITS.job_title} characters).`,
    company_long: `The company name is too long (max ${LIMITS.company_name} characters).`,
    website_invalid: 'The website is not valid. Example: www.youragency.com',
    website_long: `The website is too long (max ${LIMITS.company_website} characters).`,
  },
  pt: {
    first_required: 'Informe seu nome.',
    first_long: `O nome é longo demais (máx. ${LIMITS.first_name} caracteres).`,
    last_long: `O sobrenome é longo demais (máx. ${LIMITS.last_name} caracteres).`,
    title_long: `O cargo é longo demais (máx. ${LIMITS.job_title} caracteres).`,
    company_long: `O nome da empresa é longo demais (máx. ${LIMITS.company_name} caracteres).`,
    website_invalid: 'O site não é válido. Exemplo: www.suaimobiliaria.com',
    website_long: `O site é longo demais (máx. ${LIMITS.company_website} caracteres).`,
  },
};

// One line of text: control characters out, whitespace collapsed, trimmed.
export const cleanText = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();

// "Juan Pérez" → Juan / Pérez; "María José López Benítez" → María José / López Benítez;
// "Ana López Benítez" → Ana / López Benítez (two surnames are the common case in PY).
export function splitFullName(full) {
  const parts = cleanText(full).split(' ').filter(Boolean);
  if (!parts.length) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  const nFirst = parts.length >= 4 ? 2 : 1;
  return { first_name: parts.slice(0, nFirst).join(' '), last_name: parts.slice(nFirst).join(' ') };
}

export const joinName = (first, last) => [cleanText(first), cleanText(last)].filter(Boolean).join(' ');

// A website as typed → { ok, value } with value the normalised https?:// URL (null when empty).
// "www.inmo.com.py" → "https://www.inmo.com.py"; only http(s), a real-looking host, no spaces.
export function normalizeWebsite(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > LIMITS.company_website) return { ok: false, error: 'website_long' };
  if (/\s/.test(raw)) return { ok: false, error: 'website_invalid' };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
  let u;
  try { u = new URL(withScheme); } catch { return { ok: false, error: 'website_invalid' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'website_invalid' };
  if (u.username || u.password) return { ok: false, error: 'website_invalid' };
  const host = u.hostname.toLowerCase();
  // a dotted host name with a 2+ letter top-level domain (no bare IPs, no "localhost")
  const tld = host.split('.').pop();
  if (!host.includes('.') || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || !(/^[a-z]{2,}$/.test(tld) || /^xn--[a-z0-9-]+$/.test(tld))) return { ok: false, error: 'website_invalid' };
  let value = u.toString();
  if (u.pathname === '/' && !u.search && !u.hash) value = value.replace(/\/$/, '');
  return { ok: true, value };
}

// "https://www.inmo.com.py/contacto" → "inmo.com.py" (what the seller card shows).
export function websiteLabel(url) {
  try { return new URL(url).hostname.replace(/^www\./i, ''); } catch { return null; }
}

// The Settings form body → { patch, errors }. errors = { field: code } (see ERRORS).
// patch holds the 5 columns + full_name (always rebuilt from first + last name).
export function validateProfile(body = {}) {
  const errors = {};
  const first = cleanText(body.first_name);
  const last = cleanText(body.last_name);
  const title = cleanText(body.job_title);
  const company = cleanText(body.company_name);
  if (!first) errors.first_name = 'first_required';
  else if (first.length > LIMITS.first_name) errors.first_name = 'first_long';
  if (last.length > LIMITS.last_name) errors.last_name = 'last_long';
  if (title.length > LIMITS.job_title) errors.job_title = 'title_long';
  if (company.length > LIMITS.company_name) errors.company_name = 'company_long';
  const web = normalizeWebsite(body.company_website);
  if (!web.ok) errors.company_website = web.error;
  const patch = {
    first_name: first || null,
    last_name: last || null,
    job_title: title || null,
    company_name: company || null,
    company_website: web.ok ? web.value : null,
    full_name: joinName(first, last) || null,
  };
  return { patch, errors };
}

// What the Settings form starts with: the saved columns, else full_name split sensibly.
export function formValues(row = {}) {
  const hasCols = Object.prototype.hasOwnProperty.call(row, 'first_name');
  // saved first / last name win; otherwise (never saved, or before the migration) split full_name
  const saved = hasCols && (row.first_name || row.last_name);
  const name = saved ? { first_name: row.first_name || '', last_name: row.last_name || '' } : splitFullName(row.full_name);
  return {
    first_name: name.first_name,
    last_name: name.last_name,
    job_title: row.job_title || '',
    company_name: row.company_name || '',
    company_website: row.company_website || '',
    profile_ready: hasCols,          // false = migration 022 not applied yet
  };
}

// What buyers see on the seller card (null = nothing beyond the listing's contact name).
export function publicProfile(row = {}) {
  if (!row) return null;
  const name = joinName(row.first_name, row.last_name) || null;
  const title = cleanText(row.job_title) || null;
  const company = cleanText(row.company_name) || null;
  const web = row.company_website ? normalizeWebsite(row.company_website) : { ok: true, value: null };
  const website = web.ok ? web.value : null;
  if (!name && !title && !company && !website) return null;
  return { name, title, company, website, website_label: website ? websiteLabel(website) : null };
}

// Is this PostgREST error "the column isn't there" (migration not applied)?
export const isMissingColumnError = (e) => /^(PGRST204|42703)$/.test(String(e?.code || ''))
  || /PGRST204|42703|unknown column|column .* does not exist|Could not find the '.*' column/i.test(String(e?.message || e || ''));

// Everything the "Sobre el vendedor" (i) popover may show for a user-published listing —
// never the phone number (the WhatsApp button stays the way to reach the seller).
// row = the users row (+ profile columns when migration 022 ran); activeListings = count.
export function sellerInfo(row, activeListings = null) {
  if (!row) return null;
  const pro = publicProfile(row) || {};
  const n = Number(activeListings);
  return {
    name: pro.name || null,
    title: pro.title || null,
    company: pro.company || null,
    website: pro.website || null,
    website_label: pro.website_label || null,
    member_since: row.created_at || null,
    wa_verified: !!row.phone_verified_at,
    active_listings: Number.isFinite(n) && n > 0 ? n : null,
  };
}
