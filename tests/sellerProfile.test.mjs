import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_COLUMNS, ERRORS, splitFullName, joinName, normalizeWebsite, websiteLabel,
  validateProfile, formValues, publicProfile, isMissingColumnError, cleanText,
} from '../lib/sellerProfile.js';

test('full_name → first / last name, sensibly', () => {
  assert.deepEqual(splitFullName('Juan Pérez'), { first_name: 'Juan', last_name: 'Pérez' });
  assert.deepEqual(splitFullName('Ana López Benítez'), { first_name: 'Ana', last_name: 'López Benítez' });
  assert.deepEqual(splitFullName('María José López Benítez'), { first_name: 'María José', last_name: 'López Benítez' });
  assert.deepEqual(splitFullName('  Roland  '), { first_name: 'Roland', last_name: '' });
  assert.deepEqual(splitFullName(null), { first_name: '', last_name: '' });
  assert.equal(joinName(' Juan ', ''), 'Juan');
  assert.equal(joinName('Juan', 'Pérez'), 'Juan Pérez');
});

test('website: optional, normalised, only real http(s) sites', () => {
  assert.deepEqual(normalizeWebsite(''), { ok: true, value: null });
  assert.deepEqual(normalizeWebsite('   '), { ok: true, value: null });
  assert.deepEqual(normalizeWebsite('www.inmo.com.py'), { ok: true, value: 'https://www.inmo.com.py' });
  assert.deepEqual(normalizeWebsite('http://inmo.com.py/'), { ok: true, value: 'http://inmo.com.py' });
  assert.deepEqual(normalizeWebsite('https://inmo.com/contacto?x=1'), { ok: true, value: 'https://inmo.com/contacto?x=1' });
  assert.equal(normalizeWebsite('HTTPS://Inmo.COM').value, 'https://inmo.com');
  for (const bad of ['inmo', 'javascript:alert(1)', 'ftp://inmo.com', 'mi sitio.com', 'https://localhost', 'https://192.168.0.1', 'https://user:pw@inmo.com', 'https://inmo.c']) {
    assert.equal(normalizeWebsite(bad).ok, false, bad);
  }
  assert.equal(normalizeWebsite('https://' + 'a'.repeat(200) + '.com').error, 'website_long');
  assert.equal(websiteLabel('https://www.inmo.com.py/contacto'), 'inmo.com.py');
  assert.equal(websiteLabel('nonsense'), null);
});

test('validate: first name required, lengths, website; full_name rebuilt', () => {
  const ok = validateProfile({ first_name: ' Ana ', last_name: 'López  Benítez', job_title: 'Agente inmobiliario', company_name: 'Inmo <b>SA</b>', company_website: 'inmo.com.py' });
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.patch, {
    first_name: 'Ana', last_name: 'López Benítez', job_title: 'Agente inmobiliario', company_name: 'Inmo b SA /b',
    company_website: 'https://inmo.com.py', full_name: 'Ana López Benítez',
  });
  assert.deepEqual(Object.keys(ok.patch).filter((k) => k !== 'full_name'), PROFILE_COLUMNS);

  const bad = validateProfile({ first_name: '', company_website: 'no es un sitio', job_title: 'x'.repeat(81) });
  assert.deepEqual(bad.errors, { first_name: 'first_required', job_title: 'title_long', company_website: 'website_invalid' });
  for (const code of Object.values(bad.errors)) { assert.ok(ERRORS.es[code], code); assert.ok(ERRORS.en[code], code); }
  assert.match(ERRORS.es.first_required, /Ingresá/);   // voseo

  const empty = validateProfile({ first_name: 'Juan' });
  assert.deepEqual(empty.patch, { first_name: 'Juan', last_name: null, job_title: null, company_name: null, company_website: null, full_name: 'Juan' });
});

test('form values: saved columns win, else full_name split; flags the migration', () => {
  assert.deepEqual(formValues({ full_name: 'Juan Pérez' }), { first_name: 'Juan', last_name: 'Pérez', job_title: '', company_name: '', company_website: '', profile_ready: false });
  assert.equal(formValues({ full_name: 'Juan Pérez', first_name: null, last_name: null }).first_name, 'Juan');
  assert.equal(formValues({ full_name: 'Juan Pérez', first_name: null, last_name: null }).profile_ready, true);
  const saved = formValues({ full_name: 'Juan Carlos Pérez', first_name: 'Juan Carlos', last_name: 'Pérez', job_title: 'Corredor', company_name: 'Inmo', company_website: 'https://inmo.com' });
  assert.deepEqual(saved, { first_name: 'Juan Carlos', last_name: 'Pérez', job_title: 'Corredor', company_name: 'Inmo', company_website: 'https://inmo.com', profile_ready: true });
});

test('public profile: what buyers see on the seller card', () => {
  assert.equal(publicProfile({}), null);
  assert.equal(publicProfile(null), null);
  assert.deepEqual(publicProfile({ first_name: 'Ana', last_name: 'López', job_title: 'Agente inmobiliaria', company_name: 'Inmo SA', company_website: 'https://www.inmo.com.py' }), {
    name: 'Ana López', title: 'Agente inmobiliaria', company: 'Inmo SA', website: 'https://www.inmo.com.py', website_label: 'inmo.com.py',
  });
  // a stored bad website is never linked
  assert.equal(publicProfile({ company_name: 'Inmo', company_website: 'javascript:alert(1)' }).website, null);
  assert.equal(cleanText('a\u0000b'), 'a b');
});

test('missing-column errors are recognised (migration 022 not applied yet)', () => {
  assert.ok(isMissingColumnError(new Error('db PATCH users -> 400: {"code":"PGRST204","message":"Could not find the \'first_name\' column of \'users\' in the schema cache"}')));
  assert.ok(isMissingColumnError(new Error('column users.job_title does not exist (42703)')));
  const airobase = Object.assign(new Error('unknown column "first_name"'), { code: 'PGRST100' });   // what AiroBase answers
  assert.ok(isMissingColumnError(airobase));
  assert.ok(!isMissingColumnError(new Error('timeout')));
});

test('seller info for the "Sobre el vendedor" popover: never the phone, empty fields null', async () => {
  const { sellerInfo } = await import('../lib/sellerProfile.js');
  assert.equal(sellerInfo(null), null);
  const full = sellerInfo({ first_name: 'Ana', last_name: 'López', job_title: 'Agente', company_name: 'Inmo', company_website: 'https://inmo.com', created_at: '2026-03-02T10:00:00Z', phone_verified_at: '2026-03-03T10:00:00Z', phone: '+595981000000' }, 4);
  assert.deepEqual(full, { name: 'Ana López', title: 'Agente', company: 'Inmo', website: 'https://inmo.com', website_label: 'inmo.com', member_since: '2026-03-02T10:00:00Z', wa_verified: true, active_listings: 4 });
  assert.ok(!JSON.stringify(full).includes('595981'));
  // before migration 022 / nothing filled in: still member since
  assert.deepEqual(sellerInfo({ created_at: '2026-01-01T00:00:00Z' }, 0), { name: null, title: null, company: null, website: null, website_label: null, member_since: '2026-01-01T00:00:00Z', wa_verified: false, active_listings: null });
  assert.equal(sellerInfo({ created_at: null }, null).active_listings, null);
});

test('one name: when first/last no longer match full_name (changed elsewhere), full_name wins', async () => {
  const { currentName, formValues, publicProfile } = await import('../lib/sellerProfile.js');
  // the old app Settings saved only full_name
  const row = { full_name: 'Juan Pérez', first_name: 'Omar', last_name: 'Faiz', job_title: 'Agente' };
  assert.deepEqual(currentName(row), { first_name: 'Juan', last_name: 'Pérez', saved: true });
  assert.equal(formValues(row).first_name, 'Juan');
  assert.equal(formValues(row).last_name, 'Pérez');
  assert.equal(publicProfile(row).name, 'Juan Pérez');
  // in sync: the saved split is kept (e.g. two first names)
  const two = { full_name: 'María José López', first_name: 'María José', last_name: 'López' };
  assert.deepEqual(currentName(two), { first_name: 'María José', last_name: 'López', saved: true });
  // never saved: the card keeps the listing's contact name
  assert.equal(publicProfile({ full_name: 'Ana López', job_title: 'Agente' }).name, null);
});
