// Validation + DTO tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isUuid, isSlug, isHostname, Validator } from '../shared/validation';
import { validateCreateSite, validateCreatePage } from '../domain/dto';
import { makeCreateSiteDto, makeCreatePageDto } from '../testing/factories';

test('primitive guards', () => {
  assert.equal(isUuid('00000000-0000-4000-8000-000000000001'), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isSlug('acme-foods'), true);
  assert.equal(isSlug('Acme Foods'), false);
  assert.equal(isHostname('brand.com'), true);
  assert.equal(isHostname('localhost'), false);
});

test('Validator accumulates issues and reports the first', () => {
  const v = new Validator().require(undefined, 'name').field(1, 'slug', isSlug, 'slug');
  assert.equal(v.valid, false);
  assert.equal(v.list().length, 2);
  const r = v.toResult({});
  assert.equal(r.ok, false);
});

test('validateCreateSite accepts a valid dto and rejects a bad slug', () => {
  assert.equal(validateCreateSite(makeCreateSiteDto()).ok, true);
  const bad = validateCreateSite(makeCreateSiteDto({ slug: 'Bad Slug!' }));
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error.code, 'validation');
});

test('validateCreatePage requires a title', () => {
  const site = '00000000-0000-4000-8000-0000000000bb';
  assert.equal(validateCreatePage(makeCreatePageDto(site)).ok, true);
  const bad = validateCreatePage(makeCreatePageDto(site, { title: '' }));
  assert.equal(bad.ok, false);
});
