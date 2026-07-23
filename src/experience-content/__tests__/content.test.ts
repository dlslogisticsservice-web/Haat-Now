// Experience Content · the single source of truth for experience copy.
//
// These tests encode the guarantees the live screens and the Studio both depend on:
// defaults are complete, overrides merge without erasing untouched fields, and a
// missing id yields no content (never a fabricated one).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPERIENCE_CONTENT_DEFAULTS, CONTENT_IDS, resolveContent, contentTitle, contentBody,
} from '../content';

test('every default carries a bilingual title and an id that matches its key', () => {
  for (const [key, c] of Object.entries(EXPERIENCE_CONTENT_DEFAULTS)) {
    assert.equal(c.id, key, `id mismatch for ${key}`);
    assert.ok(c.title.ar && c.title.en, `${key} missing a title`);
    assert.ok(c.icon, `${key} missing an icon`);
  }
});

test('content ids cover the customer, merchant and driver experiences', () => {
  for (const id of [
    'flag.customer_welcome', 'flag.customer_offers', 'flag.customer_feature_tour',
    'flag.merchant_announcements', 'flag.merchant_beta_dashboard', 'flag.merchant_education',
    'flag.driver_beta_tools', 'flag.driver_safety', 'flag.driver_training',
  ]) {
    assert.ok(CONTENT_IDS.includes(id), `missing content for ${id}`);
  }
});

test('resolveContent returns the default verbatim when there is no override', () => {
  const c = resolveContent('flag.customer_welcome');
  assert.equal(c!.title.en, 'Welcome back');
  assert.equal(c!.body!.en, 'Fast delivery from restaurants and stores near you.');
});

test('an override changes only the fields it names', () => {
  const c = resolveContent('flag.customer_offers', { title: { en: 'Deals live now' } });
  assert.equal(c!.title.en, 'Deals live now');       // changed
  assert.equal(c!.title.ar, 'عروض متاحة الآن');       // untouched
  assert.equal(c!.body!.en, 'Discover active discounts in your area.'); // untouched
});

test('an override never mutates the shipped default (isolation)', () => {
  resolveContent('flag.driver_safety', { title: { en: 'CHANGED' } });
  assert.equal(EXPERIENCE_CONTENT_DEFAULTS['flag.driver_safety'].title.en, 'Safety reminder');
});

test('a missing id yields no content — never a fabricated one', () => {
  assert.equal(resolveContent('flag.does_not_exist'), null);
  assert.equal(resolveContent('flag.does_not_exist', { title: { en: 'x' } }), null);
});

test('the welcome experiment arm switches the title', () => {
  const c = resolveContent('flag.customer_welcome')!;
  assert.equal(contentTitle(c, 'en'), 'Welcome back');
  assert.equal(contentTitle(c, 'en', 'warm'), 'Welcome to HaaT Now 👋');
  assert.equal(contentTitle(c, 'ar', 'warm'), 'أهلاً بك في هات ناو 👋');
  // An unknown arm falls back to the base title.
  assert.equal(contentTitle(c, 'en', 'nonexistent'), 'Welcome back');
});

test('contentBody returns undefined for a hint that has no body', () => {
  const hint = resolveContent('flag.customer_feature_tour')!;
  assert.equal(hint.kind, 'hint');
  assert.equal(contentBody(hint, 'en'), undefined);
});

test('body override on a hint (no default body) still applies cleanly', () => {
  const c = resolveContent('flag.customer_feature_tour', { body: { en: 'Extra tip' } });
  assert.equal(c!.body!.en, 'Extra tip');
  assert.equal(c!.body!.ar, '');
});
