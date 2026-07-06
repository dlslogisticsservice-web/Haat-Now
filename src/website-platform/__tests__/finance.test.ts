// Launch Sprint 3 · Financial engine tests (Part 5) — pricing, tax, tip, service fee,
// delivery, min-order, and receipt rendering. Everything config-driven (no hardcoded fees).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computePricing, computeTax, resolveDeliveryFee, resolveServiceFee, resolveTip, tipOptions,
  type FeeConfig,
} from '../finance/pricing';
import { buildReceipt, renderReceiptHtml } from '../finance/receipt';

const cfg = (over: Partial<FeeConfig> = {}): FeeConfig => ({
  currency: 'SAR', deliveryFee: 10, taxRate: 0.15, taxMode: 'exclusive', ...over,
});
const items = [{ name: 'Pizza', unitPrice: 25, quantity: 2 }, { name: 'Cola', unitPrice: 5, quantity: 1 }];

test('pricing: subtotal + exclusive tax + delivery, no hardcoded fees', () => {
  const b = computePricing({ items }, cfg());
  assert.equal(b.subtotal, 55);
  assert.equal(b.deliveryFee, 10);
  assert.equal(b.tax, 8.25);            // 55 * 0.15
  assert.equal(b.total, 73.25);         // 55 + 10 + 8.25
  assert.equal(b.currency, 'SAR');
});

test('pricing: coupon percent + flat discount clamps at subtotal', () => {
  const b = computePricing({ items, couponPercent: 20 }, cfg({ taxMode: 'none', taxRate: 0 }));
  assert.equal(b.discount, 11);         // 20% of 55
  assert.equal(b.total, 44 + 10);       // discounted 44 + delivery 10
  const over = computePricing({ items, couponFlat: 999 }, cfg({ taxMode: 'none', taxRate: 0, deliveryFee: 0 }));
  assert.equal(over.discount, 55);      // clamped
  assert.equal(over.total, 0);
});

test('pricing: free delivery above threshold, else base fee', () => {
  assert.equal(resolveDeliveryFee(100, cfg({ freeDeliveryThreshold: 80 })), 0);
  assert.equal(resolveDeliveryFee(50, cfg({ freeDeliveryThreshold: 80 })), 10);
  assert.equal(resolveDeliveryFee(50, cfg(), 7), 7); // explicit branch-quoted override wins
});

test('pricing: service fee rate + flat, capped', () => {
  assert.equal(resolveServiceFee(100, cfg({ serviceFeeRate: 0.05, serviceFeeFlat: 2 })), 7);
  assert.equal(resolveServiceFee(100, cfg({ serviceFeeRate: 0.05, serviceFeeFlat: 2, serviceFeeCap: 5 })), 5);
});

test('tax engine: exclusive vs inclusive vs none', () => {
  assert.equal(computeTax(100, cfg({ taxRate: 0.15, taxMode: 'exclusive' })), 15);
  assert.equal(Math.round(computeTax(115, cfg({ taxRate: 0.15, taxMode: 'inclusive' })) * 100) / 100, 15);
  assert.equal(computeTax(100, cfg({ taxRate: 0.15, taxMode: 'none' })), 0);
});

test('pricing: inclusive tax is not re-added to the total', () => {
  const b = computePricing({ items }, cfg({ taxMode: 'inclusive', deliveryFee: 0 }));
  assert.equal(b.total, 55);            // tax embedded, total unchanged
  assert.ok(b.tax > 0);                 // still reported
});

test('tip engine: percent + fixed + presets', () => {
  assert.equal(resolveTip(100, { mode: 'percent', value: 15 }), 15);
  assert.equal(resolveTip(100, { mode: 'fixed', value: 7 }), 7);
  assert.equal(resolveTip(100, null), 0);
  assert.deepEqual(tipOptions(100, [0, 10, 15]), [{ percent: 0, amount: 0 }, { percent: 10, amount: 10 }, { percent: 15, amount: 15 }]);
  const withTip = computePricing({ items, tip: { mode: 'percent', value: 10 } }, cfg({ taxMode: 'none', taxRate: 0, deliveryFee: 0 }));
  assert.equal(withTip.tip, 5.5);
  assert.equal(withTip.total, 60.5);
});

test('pricing: min-order gate + taxable base can include fees', () => {
  const b = computePricing({ items }, cfg({ minOrder: 100, taxMode: 'none', taxRate: 0 }));
  assert.equal(b.meetsMinOrder, false);
  assert.equal(b.minOrderShortfall, 45);
  const taxed = computePricing({ items }, cfg({ taxableIncludesDelivery: true }));
  assert.equal(taxed.tax, (55 + 10) * 0.15);
});

test('receipt: renders every line, fee, tax and tip', () => {
  const b = computePricing({ items, couponPercent: 10, tip: { mode: 'fixed', value: 4 } }, cfg({ serviceFeeFlat: 3 }));
  const r = buildReceipt(b, { name: 'HaaT Now', supportEmail: 'help@haatnow.app' }, { orderId: 'order-abcdef12', merchantName: 'Napoli Pizza' });
  assert.match(r.number, /^RCP-/);
  const html = renderReceiptHtml(r, { name: 'HaaT Now', supportEmail: 'help@haatnow.app' });
  assert.match(html, /Receipt RCP-/);
  assert.match(html, /Napoli Pizza/);
  assert.match(html, /Discount/);
  assert.match(html, /Service fee/);
  assert.match(html, /Tax/);
  assert.match(html, /Tip/);
  assert.match(html, /SAR /);
});
