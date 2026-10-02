import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteWordOk, DELETE_WORD } from '../lib/deleteConfirm.js';

test('the confirm word is ELIMINAR in Spanish and DELETE in English', () => {
  assert.equal(DELETE_WORD.es, 'ELIMINAR');
  assert.equal(DELETE_WORD.en, 'DELETE');
});

test('typing the word (any case, extra spaces) unlocks the button', () => {
  for (const s of ['ELIMINAR', 'eliminar', '  Eliminar ', 'DELETE', 'delete']) assert.equal(deleteWordOk(s), true, s);
});

test('anything else keeps it locked', () => {
  for (const s of ['', 'ELIMIN', 'ELIMINARR', 'borrar', 'del', null, undefined]) assert.equal(deleteWordOk(s), false, String(s));
});
