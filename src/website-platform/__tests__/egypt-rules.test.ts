import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EG_GOVERNORATES, EG_ZONES, EG_LAUNCH_SUMMARY,
  egDeliveryFee, egEta, egZone, EG_DELIVERY_RULES,
} from '../../config/egypt';

// Business-rule validation for the Egypt launch market (delivery fees, zones, ETA).
// Guards the pricing engine so a config change that breaks the money math fails CI.

test('geography: 27 governorates and at least one active launch zone', () => {
  assert.equal(EG_GOVERNORATES.length, 27);
  assert.ok(EG_ZONES.some(z => z.active));
  assert.ok(EG_LAUNCH_SUMMARY.launchZones >= 1);
});

test('base delivery fee applies when basket ≥ zone minimum', () => {
  const z = egZone('z_newcairo'); // fee 20, min 60
  assert.equal(egDeliveryFee('z_newcairo', z.minOrder), z.deliveryFee);
  assert.equal(egDeliveryFee('z_newcairo', 80), 20);
});

test('small-order fee is added below the zone minimum', () => {
  // basket 40 < min 60 → base 20 + smallOrderFee 5
  assert.equal(egDeliveryFee('z_newcairo', 40), 20 + EG_DELIVERY_RULES.smallOrderFee);
});

test('free delivery at/above the threshold', () => {
  assert.equal(egDeliveryFee('z_newcairo', EG_DELIVERY_RULES.freeDeliveryThreshold), 0);
  assert.equal(egDeliveryFee('z_newcairo', EG_DELIVERY_RULES.freeDeliveryThreshold + 50), 0);
});

test('peak surcharge is added on peak orders', () => {
  assert.equal(egDeliveryFee('z_newcairo', 80, { peak: true }), 20 + EG_DELIVERY_RULES.peakSurcharge);
});

test('per-km surcharge beyond the included radius', () => {
  // 6km with includedRadius 4 → 2 extra km × perKmSurcharge 3 = +6
  assert.equal(egDeliveryFee('z_newcairo', 80, { distanceKm: 6 }), 20 + 2 * EG_DELIVERY_RULES.perKmSurcharge);
  // within radius → no surcharge
  assert.equal(egDeliveryFee('z_newcairo', 80, { distanceKm: 3 }), 20);
});

test('unknown zone falls back to an active zone (never throws)', () => {
  const z = egZone('does-not-exist');
  assert.ok(z && z.active);
});

test('ETA is localized and well-formed', () => {
  const z = egZone('z_newcairo');
  assert.equal(egEta('z_newcairo', 'en'), `${z.etaMin}–${z.etaMax} min`);
  assert.ok(egEta('z_newcairo', 'ar').includes('دقيقة'));
});
