import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, bodyToHtml, renderTemplate, templateVars } from '../lib/emailTemplateRender.js';

const FRAME = { brand: 'Casa Libre', tld: '.py', countryName: 'Paraguay', appleSrc: 'cid:a', playSrc: 'cid:p', downloadUrl: 'https://casa-libre.com.py/descargar' };

test('interpolate: fills vars, HTML-escapes values, empty for unknown', () => {
  assert.equal(interpolate('Hola {{ name }}!', { name: 'Ana <b>' }), 'Hola Ana &lt;b&gt;!');
  assert.equal(interpolate('{{missing}}x', {}), 'x');
});

test('interpolate: url keys must be http(s)', () => {
  assert.equal(interpolate('{{extend_url}}', { extend_url: 'https://x.com/a?b=1&c=2' }), 'https://x.com/a?b=1&amp;c=2');
  assert.equal(interpolate('{{extend_url}}', { extend_url: 'javascript:alert(1)' }), '');
});

test('interpolate plain mode does not escape (subjects)', () => {
  assert.equal(interpolate('{{name}} & co', { name: 'A&B' }, { plain: true }), 'A&B & co');
});

test('bodyToHtml: paragraphs, bold, links, escaping', () => {
  const html = bodyToHtml('Hola **{{name}}**\n\nMirá [la web](https://casa-libre.com.py) <script>', { name: 'Ana' });
  assert.match(html, /<p[^>]*>Hola <strong>Ana<\/strong><\/p>/);
  assert.match(html, /<a href="https:\/\/casa-libre\.com\.py"[^>]*>la web<\/a>/);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('bodyToHtml: non-http links are left as text', () => {
  const html = bodyToHtml('[x](javascript:alert(1))', {});
  assert.ok(!html.includes('<a '));
});

test('renderTemplate: subject plain, frame, heading, button with url var', () => {
  const r = renderTemplate(
    { subject: '{{name}}, tu propiedad', heading: 'Regalo', body: 'Hola {{name}}', button_label: 'Extender por {{price}}', button_url: '{{extend_url}}' },
    { name: 'Ana', price: 'US$20', extend_url: 'https://casa-libre.com.py/api/promo/extend?token=abc' },
    FRAME,
  );
  assert.equal(r.subject, 'Ana, tu propiedad');
  assert.match(r.html, /casa-libre<span[^>]*>\.py<\/span>/);
  assert.match(r.html, />Regalo</);
  assert.match(r.html, /href="https:\/\/casa-libre\.com\.py\/api\/promo\/extend\?token=abc"[^>]*>Extender por US\$20</);
  assert.match(r.html, /src="cid:a"/);
  assert.match(r.text, /Hola Ana/);
  assert.match(r.text, /Extender por US\$20: https:\/\/casa-libre\.com\.py/);
});

test('renderTemplate: button dropped when its url resolves to nothing', () => {
  const r = renderTemplate({ subject: 's', heading: 'h', body: 'b', button_label: 'Ir', button_url: '{{extend_url}}' }, {}, FRAME);
  assert.ok(!r.html.includes('>Ir<'));
});

test('templateVars lists the supported variables', () => {
  const keys = templateVars.map((v) => v.key);
  for (const k of ['name', 'property_title', 'property_url', 'free_until', 'days_left', 'free_days', 'extend_url', 'price', 'views', 'publish_url']) assert.ok(keys.includes(k), k);
});

test('a variable inside link text and url renders one link', () => {
  const html = bodyToHtml('Mirá [{{property_title}}]({{property_url}})', { property_title: 'Casa 3', property_url: 'https://x.com/p?a=1&b=2' });
  assert.match(html, /<a href="https:\/\/x\.com\/p\?a=1&amp;b=2"[^>]*>Casa 3<\/a>/);
});

test('app badges: Google Play opens the store page, App Store opens /descargar', () => {
  const frame = { appleSrc: 'cid:a', playSrc: 'cid:p', downloadUrl: 'https://casa-libre.com.py/descargar', playUrl: 'https://play.google.com/store/apps/details?id=py.casalibre.mobile' };
  const { html } = renderTemplate({ subject: 'S', heading: 'H', body: 'B' }, {}, frame);
  assert.match(html, /<a href="https:\/\/casa-libre\.com\.py\/descargar"[^>]*><img src="cid:a"/);
  assert.match(html, /<a href="https:\/\/play\.google\.com\/store\/apps\/details\?id=py\.casalibre\.mobile"[^>]*><img src="cid:p"/);
  // an older frame without playUrl still links both badges to /descargar
  const { html: old } = renderTemplate({ subject: 'S', heading: 'H', body: 'B' }, {}, { ...frame, playUrl: undefined });
  assert.match(old, /<a href="https:\/\/casa-libre\.com\.py\/descargar"[^>]*><img src="cid:p"/);
});

test('images: ![alt](url) renders a full-width image (http/https only)', () => {
  const html = bodyToHtml('Mirá:\n\n![{{property_title}}]({{photo_url}})\n\nFin', { property_title: 'Casa "3"', photo_url: 'https://x.com/a.webp?w=1&h=2' });
  assert.match(html, /<p[^>]*><img src="https:\/\/x\.com\/a\.webp\?w=1&amp;h=2" alt="Casa &quot;3&quot;" width="396" style="display:block;width:100%[^"]*"><\/p>/);
  assert.ok(!html.includes('!['));
  assert.ok(!html.includes('<a '), 'an image is not also a link');
  assert.ok(!bodyToHtml('![x](javascript:alert(1))', {}).includes('<img'));
});

test('images: an empty url drops the image and its paragraph (a draft without photos)', () => {
  const html = bodyToHtml('Hola\n\n![{{property_title}}]({{photo_url}})\n\nChau', { property_title: 'Casa' });
  assert.equal((html.match(/<p /g) || []).length, 2);
  assert.ok(!html.includes('<img') && !html.includes('!['));
});

test('images: left out of the plain-text part', () => {
  const tpl = { subject: 's', heading: 'h', body: 'Hola\n\n![x]({{photo_url}})\n\nChau', button_label: 'Ir', button_url: '{{draft_url}}' };
  for (const photo of ['https://x.com/a.webp', '']) {
    const { text } = renderTemplate(tpl, { photo_url: photo, draft_url: 'https://casa-libre.com.py/cuenta/publicaciones?tab=borradores&draft=abc' }, FRAME);
    assert.equal(text, 'h\n\nHola\n\nChau\n\nIr: https://casa-libre.com.py/cuenta/publicaciones?tab=borradores&draft=abc');
  }
});

test('templateVars: the draft reminder variables, with samples the preview can show', () => {
  const byKey = Object.fromEntries(templateVars.map((v) => [v.key, v]));
  for (const k of ['draft_url', 'draft_location', 'photo_url']) assert.ok(byKey[k]?.sample, k);
  assert.match(byKey.draft_url.sample, /^https:\/\/.+\/cuenta\/publicaciones\?tab=borradores&draft=/);
  assert.match(byKey.photo_url.sample, /^https:\/\//);
});
