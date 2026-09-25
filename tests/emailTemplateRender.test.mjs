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
  for (const k of ['name', 'property_title', 'property_url', 'free_until', 'days_left', 'free_days', 'extend_url', 'price']) assert.ok(keys.includes(k), k);
});
