import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// lib/marketplace.js is server-only; the pattern rule is copied here and checked against the source.
const src = readFileSync(new URL('../lib/marketplace.js', import.meta.url), 'utf8');
const accentFree = (v) => { const t = String(v || '').trim(); return t.length < 4 ? t : t.replace(/[aeiounáéíóúüñAEIOUNÁÉÍÓÚÜÑ]/g, '_'); };
const likeToRe = (pat) => new RegExp(pat.replace(/[.*+?^${}()|[\]\]/g, '\$&').replace(/_/g, '.'), 'i');

test('search pattern ignores accents (phones type "asuncion")', () => {
  assert.ok(src.includes("replace(/[aeiounáéíóúüñAEIOUNÁÉÍÓÚÜÑ]/g, '_')"), 'rule in lib/marketplace.js changed');
  for (const [typed, stored] of [['asuncion', 'Asunción'], ['Asunción', 'Asunción'], ['Encarnacion', 'Encarnación'], ['Lambare', 'Lambaré'], ['nemby', 'Ñemby'], ['Capiata', 'Capiatá'], ['luque', 'Luque']]) {
    assert.ok(likeToRe(accentFree(typed)).test(stored), `${typed} → ${stored}`);
  }
  assert.ok(!likeToRe(accentFree('Luque')).test('Limpio'), 'different cities do not match');
  assert.equal(accentFree('sol'), 'sol', 'short searches stay exact');
});
