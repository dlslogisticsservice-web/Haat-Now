// Production Launch · COD payment tests (Part 2/Step 8) — cash-on-delivery is a first-class
// method that needs no gateway and reconciles to paid at delivery.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCodRecord, markCodCollected, codPaymentStatus, codRequiresGateway, COD_PROVIDER } from '../finance/cod';
import { computePricing, type FeeConfig } from '../finance/pricing';

test('COD requires no gateway', () => {
  assert.equal(codRequiresGateway(), false);
});

test('COD record: provider, full amount due, pending, idempotent key', () => {
  const rec = buildCodRecord('order-abc', 'cust-1', 123.456, 'SAR');
  assert.equal(rec.provider, COD_PROVIDER);
  assert.equal(rec.provider, 'cod');
  assert.equal(rec.amount, 123.46);          // rounded to 2dp
  assert.equal(rec.status, 'pending');
  assert.equal(rec.currency, 'SAR');
  assert.equal(rec.idempotencyKey, 'cod:order-abc'); // one COD record per order
});

test('COD reconciles to paid only after cash is collected', () => {
  const rec = buildCodRecord('o1', 'c1', 50, 'SAR');
  assert.equal(codPaymentStatus(rec), 'unpaid');       // created → cash not yet collected
  const collected = markCodCollected(rec);
  assert.equal(collected.status, 'collected');
  assert.equal(codPaymentStatus(collected), 'paid');   // driver collected → paid
});

test('COD amount equals the pricing-engine order total (no separate cash math)', () => {
  const cfg: FeeConfig = { currency: 'SAR', deliveryFee: 10, taxRate: 0.15, taxMode: 'exclusive' };
  const bd = computePricing({ items: [{ name: 'Meal', unitPrice: 40, quantity: 1 }] }, cfg);
  const rec = buildCodRecord('o2', 'c2', bd.total, bd.currency);
  assert.equal(rec.amount, bd.total);   // 40 + 10 + 6 VAT = 56
  assert.equal(rec.amount, 56);
});

test('COD never carries a negative amount', () => {
  assert.equal(buildCodRecord('o3', 'c3', -5, 'SAR').amount, 0);
});
