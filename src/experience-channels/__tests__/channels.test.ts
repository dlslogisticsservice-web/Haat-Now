// Experience Channels · registry.
//
// The registry is the spine of the Experience Studio — the navigator, the preview,
// the inspector and the cross-channel Marketing OS all read from it. These tests
// encode the invariants those consumers rely on, so a mistaken edit fails here and
// not in a shipped Studio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANNELS, ACTIVE_CHANNELS, FUTURE_CHANNELS, getChannel, getScreen,
  allChannelExperiences, channelsForExperience, type ChannelId,
} from '../channels';

test('the four live channels are exactly website, customer, merchant, driver', () => {
  assert.deepEqual(ACTIVE_CHANNELS.map(c => c.id), ['website', 'customer', 'merchant', 'driver']);
});

test('the seven future channels are placeholders only — no surface, no screens', () => {
  const ids = FUTURE_CHANNELS.map(c => c.id);
  assert.deepEqual(ids, ['email', 'push', 'sms', 'whatsapp', 'kiosk', 'voice', 'tv']);
  for (const c of FUTURE_CHANNELS) {
    assert.equal(c.surface, undefined, `${c.id} must not claim a surface`);
    assert.equal(c.screens.length, 0, `${c.id} must not preview screens`);
    assert.ok(c.en_note && c.en_note.length > 0, `${c.id} must explain why it is planned`);
  }
});

test('every active channel decides against an engine surface and has an inspector', () => {
  for (const c of ACTIVE_CHANNELS) {
    assert.ok(c.surface, `${c.id} needs a surface`);
    assert.ok(c.inspector, `${c.id} needs an inspector kind`);
    assert.ok(c.screens.length > 0, `${c.id} needs screens`);
  }
});

test('active channel surfaces map 1:1 to the engine Surface union', () => {
  // The engine Surface union is website|customer|merchant|driver|admin. Every active
  // channel surface must be one the engine can already decide against.
  const engineSurfaces = new Set(['website', 'customer', 'merchant', 'driver']);
  for (const c of ACTIVE_CHANNELS) assert.ok(engineSurfaces.has(c.surface!), `${c.surface} is not an engine surface`);
});

test('channel ids are unique', () => {
  const ids = CHANNELS.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('screen ids are unique within each channel', () => {
  for (const c of CHANNELS) {
    const ids = c.screens.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, `${c.id} has duplicate screen ids`);
  }
});

test('the customer channel previews the real product screens named in the brief', () => {
  const screens = new Set(getChannel('customer')!.screens.map(s => s.id));
  for (const required of ['home', 'restaurant', 'store', 'offers', 'categories', 'search', 'checkout', 'orders', 'wallet', 'notifications', 'profile', 'coupons', 'landing', 'splash', 'onboarding']) {
    assert.ok(screens.has(required), `customer channel missing screen: ${required}`);
  }
});

test('the merchant channel previews dashboard/orders/products/analytics/finance/campaigns/announcements/settings', () => {
  const screens = new Set(getChannel('merchant')!.screens.map(s => s.id));
  for (const required of ['dashboard', 'orders', 'products', 'analytics', 'finance', 'campaigns', 'announcements', 'settings']) {
    assert.ok(screens.has(required), `merchant channel missing screen: ${required}`);
  }
});

test('the driver channel previews home/orders/map/navigation/wallet/training/safety/announcements', () => {
  const screens = new Set(getChannel('driver')!.screens.map(s => s.id));
  for (const required of ['home', 'orders', 'map', 'navigation', 'wallet', 'training', 'safety', 'announcements']) {
    assert.ok(screens.has(required), `driver channel missing screen: ${required}`);
  }
});

test('every experience id referenced is a real platform flag id (flag.*)', () => {
  // The preview shows the REAL engine decision, so a screen must never reference an
  // experience the platform does not define. flag.* is the platform flag namespace.
  for (const e of allChannelExperiences()) {
    assert.ok(e.startsWith('flag.'), `${e} is not a platform flag id`);
  }
});

test('channelsForExperience answers where an experience runs', () => {
  // The customer welcome experience runs on the customer channel and nowhere else.
  assert.deepEqual(channelsForExperience('flag.customer_welcome'), ['customer']);
  // Merchant announcements run on the merchant channel.
  assert.deepEqual(channelsForExperience('flag.merchant_announcements'), ['merchant']);
  // An unknown experience runs nowhere.
  assert.deepEqual(channelsForExperience('flag.does_not_exist'), []);
});

test('getChannel / getScreen resolve and miss cleanly', () => {
  assert.equal(getChannel('customer')!.en, 'Customer App');
  assert.equal(getChannel('nope' as ChannelId), undefined);
  assert.equal(getScreen('customer', 'home')!.en, 'Home');
  assert.equal(getScreen('customer', 'nope'), undefined);
  assert.equal(getScreen('email', 'anything'), undefined);
});

test('every screen carries both Arabic and English labels', () => {
  for (const c of CHANNELS) {
    assert.ok(c.ar && c.en, `${c.id} missing a label`);
    for (const s of c.screens) {
      assert.ok(s.ar && s.en, `${c.id}/${s.id} missing a label`);
    }
  }
});
