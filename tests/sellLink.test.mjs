import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSellLinkClick } from '../lib/sellLink.js';

const O = 'https://casa-libre.com.py';
const click = (over = {}) => ({ href: `${O}/publicar`, origin: O, button: 0, ...over });

test('a plain click on a /publicar link opens the wizard in place', () => {
  assert.equal(isSellLinkClick(click()), true);
  assert.equal(isSellLinkClick(click({ href: '/publicar' })), true);
  assert.equal(isSellLinkClick(click({ href: `${O}/publicar/` })), true);
  assert.equal(isSellLinkClick(click({ href: `${O}/publicar?utm=x#top` })), true);
});

test('other pages are left alone', () => {
  for (const href of [`${O}/propiedades`, `${O}/publicaciones`, `${O}/publicar-algo`, `${O}/cuenta/publicar`, `${O}/`]) {
    assert.equal(isSellLinkClick(click({ href })), false, href);
  }
});

test('another site with the same path is left alone', () => {
  assert.equal(isSellLinkClick(click({ href: 'https://example.com/publicar' })), false);
});

test('new-tab / new-window / download clicks keep the normal link', () => {
  for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) assert.equal(isSellLinkClick(click({ [k]: true })), false, k);
  assert.equal(isSellLinkClick(click({ button: 1 })), false);
  assert.equal(isSellLinkClick(click({ target: '_blank' })), false);
  assert.equal(isSellLinkClick(click({ target: '_self' })), true);
  assert.equal(isSellLinkClick(click({ download: true })), false);
});

test('a click something else already handled is left alone', () => {
  assert.equal(isSellLinkClick(click({ defaultPrevented: true })), false);
});

test('a broken href never throws', () => {
  assert.equal(isSellLinkClick(click({ href: 'http://[' })), false);
  assert.equal(isSellLinkClick(click({ href: '' })), false);
  assert.equal(isSellLinkClick({}), false);
});
