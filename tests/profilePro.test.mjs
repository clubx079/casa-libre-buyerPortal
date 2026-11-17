import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, profileProConfig, profileStatus, nextPeriod, periodUntil, showsProDetails, gateProfile, usd } from '../lib/profilePro.js';

const NOW = new Date('2026-11-17T12:00:00Z');
const D = 86400000;

test('defaults: OFF (free for everyone), US$10, 30 days, renewal US$10, first 100 free', () => {
  assert.deepEqual({ ...DEFAULTS }, { enabled: false, priceCents: 1000, renewCents: 1000, days: 30, firstFree: 100 });
  const c = profileProConfig(null);
  assert.equal(c.enabled, false);
  assert.equal(showsProDetails(c, null), true);   // no row → nothing changes
});

test('profileProConfig: row → settings; out-of-range falls back', () => {
  const c = profileProConfig({ enabled: true, enabled_at: 'x', free_days: 60, milestones: [1500, 800, 0] });
  assert.deepEqual({ enabled: c.enabled, priceCents: c.priceCents, renewCents: c.renewCents, firstFree: c.firstFree, days: c.days }, { enabled: true, priceCents: 1500, renewCents: 800, firstFree: 0, days: 60 });
  const bad = profileProConfig({ enabled: 'yes', free_days: 0, milestones: [-1, 'x', 1.5] });
  assert.equal(bad.enabled, false);
  assert.equal(bad.days, 30);
  assert.equal(bad.priceCents, 1000);
  assert.equal(bad.firstFree, 100);
});

test('profileStatus: latest succeeded profile period; expired once it is over', () => {
  assert.deepEqual(profileStatus([], NOW), { active: false, until: null, expired: false, ever: false });
  const rows = [
    { kind: 'profile', status: 'succeeded', highlight_until: new Date(NOW - 5 * D).toISOString() },
    { kind: 'profile_renew', status: 'failed', highlight_until: new Date(+NOW + 20 * D).toISOString() },
    { kind: 'listing', status: 'succeeded', highlight_until: new Date(+NOW + 20 * D).toISOString() },
  ];
  const s = profileStatus(rows, NOW);
  assert.equal(s.active, false); assert.equal(s.expired, true); assert.equal(s.ever, true);
  const a = profileStatus([...rows, { kind: 'profile_free', status: 'succeeded', highlight_until: new Date(+NOW + D).toISOString() }], NOW);
  assert.equal(a.active, true); assert.equal(a.expired, false);
});

test('nextPeriod: first N free, US$0 price free, then the price; renewals at the renewal price', () => {
  const cfg = profileProConfig({ enabled: true, milestones: [1000, 700, 2], free_days: 30 });
  assert.deepEqual(nextPeriod(cfg, { ever: false }, 0), { kind: 'profile_free', cents: 0 });
  assert.deepEqual(nextPeriod(cfg, { ever: false }, 1), { kind: 'profile_free', cents: 0 });
  assert.deepEqual(nextPeriod(cfg, { ever: false }, 2), { kind: 'profile', cents: 1000 });
  assert.deepEqual(nextPeriod(cfg, { ever: true }, 0), { kind: 'profile_renew', cents: 700 });
  const freePrice = profileProConfig({ enabled: true, milestones: [0, 500, 0] });
  assert.deepEqual(nextPeriod(freePrice, { ever: false }, 999), { kind: 'profile_free', cents: 0 });
});

test('periodUntil: renewing early keeps the days left; otherwise from now', () => {
  const cfg = profileProConfig({ free_days: 30 });
  assert.equal(periodUntil(cfg, { active: false }, NOW), new Date(+NOW + 30 * D).toISOString());
  const until = new Date(+NOW + 10 * D).toISOString();
  assert.equal(periodUntil(cfg, { active: true, until }, NOW), new Date(+NOW + 40 * D).toISOString());
});

test('showsProDetails + gateProfile: ON hides title/company/website without an active period, keeps the name', () => {
  const on = profileProConfig({ enabled: true });
  assert.equal(showsProDetails(on, { active: false }), false);
  assert.equal(showsProDetails(on, { active: true }), true);
  const p = { name: 'Ana López', title: 'Agente', company: 'Inmo', website: 'https://inmo.com.py', website_label: 'inmo.com.py' };
  assert.deepEqual(gateProfile(p, true), p);
  assert.deepEqual(gateProfile(p, false), { name: 'Ana López', title: null, company: null, website: null, website_label: null });
  assert.equal(gateProfile({ ...p, name: null }, false), null);
  assert.equal(gateProfile(null, false), null);
  assert.equal(usd(580), 'US$5.80'); assert.equal(usd(1000), 'US$10');
});
