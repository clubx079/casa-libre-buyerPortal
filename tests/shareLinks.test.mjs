import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shareCode, isShareCode, codeRange, shareUrl, shareLinks, shareTarget, networkUrls, channelOf, CHANNELS, CHANNEL_NAMES, sharePageUrl,
} from '../lib/shareLinks.js';
import { shareChannelFromQuery } from '../lib/shareVisit.js';

const ID = '42fad51e-8a55-4ed0-b864-6a35ce912229';

test('shareCode: base36 of the first 40 bits, 8 chars, stable', () => {
  const c = shareCode(ID);
  assert.equal(c, parseInt('42fad51e8a', 16).toString(36).padStart(8, '0'));
  assert.equal(c.length, 8);
  assert.equal(shareCode(ID.toUpperCase()), c);
  assert.equal(shareCode(ID), c);
  assert.equal(shareCode('00000000-0000-4000-8000-000000000000'), '00000000');
  assert.equal(shareCode('ffffffff-ff00-4000-8000-000000000000'), (2 ** 40 - 1).toString(36));
  assert.equal(shareCode('not-a-uuid'), null);
  assert.equal(shareCode(null), null);
});

test('codeRange: the listing id lies inside its code range', () => {
  const r = codeRange(shareCode(ID));
  assert.ok(r.lo <= ID && ID <= r.hi);
  assert.equal(r.lo, '42fad51e-8a00-0000-0000-000000000000');
  assert.equal(r.hi, '42fad51e-8aff-ffff-ffff-ffffffffffff');
  assert.equal(codeRange('zzzzzzzz'), null);   // beyond 40 bits
  assert.equal(codeRange('ABC'), null);
  assert.equal(isShareCode('0abc12xy'), true);
  assert.equal(isShareCode('0abc12x'), false);
});

test('share links: one per channel, unknown channel → copy', () => {
  const links = shareLinks('https://uy.casa-libre.com/', ID);
  assert.deepEqual(Object.keys(links), CHANNELS);
  assert.equal(links.ig, `https://uy.casa-libre.com/l/${shareCode(ID)}?c=ig`);
  assert.equal(shareUrl('https://x.test', ID, 'nope'), `https://x.test/l/${shareCode(ID)}?c=copy`);
  assert.equal(channelOf('WA'), 'wa');
  assert.equal(sharePageUrl('https://x.test/', ID), `https://x.test/compartir/${ID}`);
});

test('shareTarget: the listing with the share UTMs and the referral code', () => {
  const code = shareCode(ID);
  const u = new URL(shareTarget('https://casa-libre.com.py', ID, { code, channel: 'wa', refCode: 'abcdefgh' }));
  assert.equal(u.pathname, `/propiedad/${ID}`);
  assert.equal(u.searchParams.get('utm_source'), 'whatsapp');
  assert.equal(u.searchParams.get('utm_medium'), 'share');
  assert.equal(u.searchParams.get('utm_campaign'), 'listing_share');
  assert.equal(u.searchParams.get('utm_content'), code);
  assert.equal(u.searchParams.get('ref'), 'abcdefgh');
  const noRef = new URL(shareTarget('https://casa-libre.com.py', ID, { channel: 'tt' }));
  assert.equal(noRef.searchParams.get('utm_source'), 'tiktok');
  assert.equal(noRef.searchParams.get('ref'), null);
  assert.deepEqual(CHANNEL_NAMES, { ig: 'instagram', fb: 'facebook', wa: 'whatsapp', x: 'x', tt: 'tiktok', li: 'linkedin', em: 'gmail', copy: 'copy', qr: 'qr' });
});

test('networkUrls: WhatsApp with the caption, Facebook/LinkedIn link only, X text + url', () => {
  const links = shareLinks('https://s.test', ID);
  const u = networkUrls({ links, captions: { wa: `Hola ${links.wa}`, x: `Vendo casa ${links.x}` } });
  assert.equal(u.wa, `https://wa.me/?text=${encodeURIComponent(`Hola ${links.wa}`)}`);
  assert.equal(u.fb, `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(links.fb)}`);
  assert.ok(u.li.startsWith('https://www.linkedin.com/feed/?shareActive=true&text='));
  assert.ok(decodeURIComponent(u.li).includes(links.li));
  assert.equal(u.x, `https://x.com/intent/tweet?text=${encodeURIComponent('Vendo casa')}&url=${encodeURIComponent(links.x)}`);
  assert.equal(u.ig, undefined);
});

test('shareVisit: the channel back from the landing query', () => {
  assert.equal(shareChannelFromQuery('?utm_source=instagram&utm_medium=share&utm_content=x'), 'ig');
  assert.equal(shareChannelFromQuery('?utm_source=whatsapp&utm_medium=mensaje'), null);
  assert.equal(shareChannelFromQuery('?utm_medium=share'), 'copy');
});

test('who shared: links and captions carry &s=<sharer>, the redirect passes it on as utm_term', async () => {
  const { withSharer, sharerCode, shareUrl, shareTarget, networkUrls } = await import('../lib/shareLinks.js');
  const lid = '1cee193f-f2d3-4cc6-83ad-3e8442f8fcf7';
  const sh = sharerCode('d9654e2f-25c5-4562-b9cb-ed74bbc4a1c8');
  assert.match(sh, /^[0-9a-z]{8}$/);
  const link = shareUrl('https://casa-libre.com.py', lid, 'wa');
  assert.equal(withSharer(link, sh), `${link}&s=${sh}`);
  assert.equal(withSharer(withSharer(link, sh), sh), `${link}&s=${sh}`);            // never twice
  assert.deepEqual(withSharer({ wa: `Mirá ${link}` }, sh), { wa: `Mirá ${link}&s=${sh}` });
  assert.equal(withSharer(link, 'nope'), link);
  assert.equal(shareUrl('https://x.com', lid, 'em', sh), `https://x.com/l/${link.split('/l/')[1].split('?')[0]}?c=em&s=${sh}`);
  const t = new URL(shareTarget('https://casa-libre.com.py', lid, { code: 'abc12345', channel: 'em', sharer: sh }));
  assert.equal(t.searchParams.get('utm_source'), 'gmail');
  assert.equal(t.searchParams.get('utm_term'), sh);
  const em = networkUrls({ links: { em: 'E', wa: 'W' }, captions: { wa: 'hola W' }, subject: 'Casa' }).em;
  assert.equal(em, 'https://mail.google.com/mail/?view=cm&fs=1&su=Casa&body=hola%20E');
});
