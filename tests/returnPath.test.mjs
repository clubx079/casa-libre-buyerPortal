import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath } from '../lib/returnPath.js';

test('plain relative paths pass', () => {
  assert.equal(safeReturnPath('/'), '/');
  assert.equal(safeReturnPath('/publicar'), '/publicar');
  assert.equal(safeReturnPath('/propiedades'), '/propiedades');
});

test('the sell-wizard resume marker is allowed, nothing else in the query', () => {
  assert.equal(safeReturnPath('/?sell=resume'), '/?sell=resume');
  assert.equal(safeReturnPath('/propiedades?sell=resume'), '/propiedades?sell=resume');
  assert.equal(safeReturnPath('/?sell=resume&x=1'), null);
  assert.equal(safeReturnPath('/?next=https://evil.com'), null);
});

test('open redirects and junk are rejected', () => {
  for (const bad of ['https://evil.com', '//evil.com', '//evil.com?sell=resume', 'javascript:alert(1)', '/a b', '/a?b?c', '', null, 42]) {
    assert.equal(safeReturnPath(bad), null, String(bad));
  }
});
