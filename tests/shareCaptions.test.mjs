import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listingFacts, fallbackCaptions, parseAiCaptions, captionPrompt, hashtags, headline, BANNED } from '../lib/shareCaptions.js';
import { shareLinks, CAPTION_CHANNELS } from '../lib/shareLinks.js';

const ID = '42fad51e-8a55-4ed0-b864-6a35ce912229';
const links = shareLinks('https://casa-libre.com.py', ID);
const sale = listingFacts({ mode: 'venta', beds: 3, area: 180.4, neighborhood: 'Villa Morra', city: 'Asunción' }, { typeName: 'Casa', price: 'US$ 180.000', country: 'Paraguay' });
const rent = listingFacts({ mode: 'alquiler', beds: 1, city: 'Montevideo' }, { typeName: 'Departamento', price: 'US$ 700', country: 'Uruguay' });

test('facts + headline', () => {
  assert.equal(sale.area, 180);
  assert.equal(headline(sale), 'Vendo Casa de 3 dormitorios en Villa Morra, Asunción');
  assert.equal(headline(rent), 'Alquilo Departamento de 1 dormitorio en Montevideo');
  assert.equal(headline(sale, 'en'), 'For sale: Casa with 3 bedrooms in Villa Morra, Asunción');
  assert.equal(headline(listingFacts({}, { country: 'Bolivia' })), 'Vendo propiedad en Bolivia');
});

test('fallback captions: every network, its own link, the brand, no commission words', () => {
  for (const lang of ['es', 'en', 'pt']) {
    const c = fallbackCaptions(sale, links, lang);
    assert.deepEqual(Object.keys(c).sort(), [...CAPTION_CHANNELS].sort());
    for (const ch of CAPTION_CHANNELS) {
      assert.ok(c[ch].includes(links[ch]), `${lang}/${ch} has its link`);
      assert.ok(c[ch].includes('Casa-Libre'), `${lang}/${ch} names Casa-Libre`);
      assert.ok(!BANNED.test(c[ch]), `${lang}/${ch} no banned words`);
      assert.ok(!/\n{3,}/.test(c[ch]));
    }
    assert.ok(c.x.replace(links.x, '').length + 23 <= 280);
  }
  const es = fallbackCaptions(sale, links, 'es');
  assert.match(es.wa, /^🏡 \*Vendo Casa/);
  assert.match(es.ig, /US\$ 180\.000/);
  assert.match(es.ig, /#CasaLibre/);
  assert.match(fallbackCaptions(rent, links).wa, /US\$ 700\/mes/);
  // no price → no empty line where it was
  const noPrice = fallbackCaptions({ ...sale, price: '' }, links);
  assert.ok(!noPrice.ig.includes('💰'));
});

test('hashtags: no accents, no spaces, brand first', () => {
  assert.equal(hashtags(sale), '#CasaLibre #Asuncion #VillaMorra #VentaDePropiedades #Inmuebles #Casa');
});

test('AI captions: link placed, rules checked, gaps from the fallback', () => {
  const fallback = fallbackCaptions(sale, links);
  const ai = JSON.stringify({
    ig: 'Mi casa en Villa Morra 🏡\nMirala en Casa Libre: {{link}}\n\n#CasaLibre #Asuncion',
    fb: 'Vendo sin comisión {{link}}',              // banned word → fallback
    wa: '*Vendo casa* {{link}} {{link}}',          // link twice → fallback
    x: 'Vendo casa en Asunción, en Casa-Libre',    // no link → appended
    tt: 'x'.repeat(2100),                          // too long → fallback
  });
  const out = parseAiCaptions(`\`\`\`json\n${ai}\n\`\`\``, { links, fallback });
  assert.equal(out.ig, `Mi casa en Villa Morra 🏡\nMirala en Casa-Libre: ${links.ig}\n\n#CasaLibre #Asuncion`);
  assert.equal(out.fb, fallback.fb);
  assert.equal(out.wa, fallback.wa);
  assert.equal(out.x, `Vendo casa en Asunción, en Casa-Libre\n${links.x}`);
  // no brand → fallback; accents dropped from hashtags
  const b = parseAiCaptions(JSON.stringify({ wa: 'Vendo casa {{link}}', ig: 'Mirala en Casa-Libre {{link}} #Asunción' }), { links, fallback });
  assert.equal(b.wa, fallback.wa);
  assert.ok(b.ig.endsWith('#Asuncion'));
  assert.equal(out.tt, fallback.tt);
  assert.equal(out.li, fallback.li);                // missing → fallback
  assert.equal(parseAiCaptions('not json', { links, fallback }), null);
  assert.equal(parseAiCaptions('{"ig": "sin comisión {{link}}"}', { links, fallback }), null);
});

test('prompt carries only the given facts', () => {
  const p = captionPrompt(rent, 'pt');
  assert.match(p.system, /Brazilian Portuguese/);
  assert.match(p.system, /\{\{link\}\}/);
  assert.match(p.user, /price: US\$ 700 per month/);
  assert.ok(!/area:/.test(p.user));
});
