// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Financial engine (Launch Sprint 3, Part 5).
// A single, pure, node-testable pricing engine: subtotal → coupon discount → delivery
// fee → service fee → tax → tip → total. NOTHING is hardcoded here — every fee/rate comes
// from a FeeConfig the caller supplies (the app's canonical DEFAULT_DELIVERY_FEE + admin
// app-config feed it). Reused by the website checkout, invoices and receipts. Isomorphic.
// ─────────────────────────────────────────────────────────────────────────────

export type TaxMode = 'exclusive' | 'inclusive' | 'none';

/** All fees/rates are injected — the engine hardcodes none. */
export interface FeeConfig {
  currency: string;
  deliveryFee: number;                // base delivery fee (fallback lives in src/config/fees.ts)
  freeDeliveryThreshold?: number;     // discounted subtotal ≥ threshold → free delivery
  serviceFeeRate?: number;            // fraction of discounted subtotal (0..1)
  serviceFeeFlat?: number;            // flat service fee
  serviceFeeCap?: number;             // cap on the computed service fee
  taxRate: number;                    // fraction (0..1); 0 disables tax
  taxMode: TaxMode;                   // exclusive (added), inclusive (embedded), or none
  taxableIncludesDelivery?: boolean;
  taxableIncludesService?: boolean;
  minOrder?: number;                  // minimum subtotal to check out
  roundingDp?: number;                // decimal places (default 2)
}

export interface TipInput { mode: 'percent' | 'fixed'; value: number }

export interface PriceItemInput { name: string; unitPrice: number; quantity: number }

export interface PriceInput {
  items: ReadonlyArray<PriceItemInput>;
  couponPercent?: number;             // 0..100
  couponFlat?: number;                // absolute discount
  deliveryOverride?: number | null;   // e.g. a per-branch quoted fee; null → use config
  tip?: TipInput | null;
}

export interface PriceLine { name: string; unitPrice: number; quantity: number; lineTotal: number }

export interface PriceBreakdown {
  currency: string;
  lines: PriceLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  serviceFee: number;
  taxMode: TaxMode;
  tax: number;
  tip: number;
  total: number;
  meetsMinOrder: boolean;
  minOrderShortfall: number;
}

function roundTo(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Delivery fee: explicit override wins; else free above threshold; else the configured base. */
export function resolveDeliveryFee(discountedSubtotal: number, config: FeeConfig, override?: number | null): number {
  if (override !== undefined && override !== null) return Math.max(0, override);
  if (config.freeDeliveryThreshold !== undefined && discountedSubtotal >= config.freeDeliveryThreshold) return 0;
  return Math.max(0, config.deliveryFee);
}

/** Service fee: rate·subtotal + flat, capped. */
export function resolveServiceFee(discountedSubtotal: number, config: FeeConfig): number {
  const raw = (config.serviceFeeRate ?? 0) * discountedSubtotal + (config.serviceFeeFlat ?? 0);
  const capped = config.serviceFeeCap !== undefined ? Math.min(raw, config.serviceFeeCap) : raw;
  return Math.max(0, capped);
}

/** Tax engine: exclusive → base·rate (added to total); inclusive → embedded portion; none → 0. */
export function computeTax(taxableBase: number, config: FeeConfig): number {
  if (config.taxMode === 'none' || !config.taxRate) return 0;
  if (config.taxMode === 'inclusive') return taxableBase - taxableBase / (1 + config.taxRate);
  return taxableBase * config.taxRate; // exclusive
}

/** Tip engine: percent of discounted subtotal, or a fixed amount. Never negative. */
export function resolveTip(discountedSubtotal: number, tip?: TipInput | null): number {
  if (!tip) return 0;
  const v = tip.mode === 'percent' ? (discountedSubtotal * tip.value) / 100 : tip.value;
  return Math.max(0, v);
}

/** Suggested tip options (labels + amounts) from percent presets. Pure — for the UI. */
export function tipOptions(discountedSubtotal: number, presets: ReadonlyArray<number>, dp = 2): Array<{ percent: number; amount: number }> {
  return presets.map(p => ({ percent: p, amount: roundTo((discountedSubtotal * p) / 100, dp) }));
}

/** The one production pricing computation. Every downstream surface uses this. */
export function computePricing(input: PriceInput, config: FeeConfig): PriceBreakdown {
  const dp = config.roundingDp ?? 2;
  const lines: PriceLine[] = input.items.map(it => ({
    name: it.name, unitPrice: it.unitPrice, quantity: it.quantity,
    lineTotal: roundTo(it.unitPrice * it.quantity, dp),
  }));
  const subtotal = roundTo(lines.reduce((s, l) => s + l.lineTotal, 0), dp);

  const flat = input.couponFlat ?? 0;
  const pct = input.couponPercent ? (subtotal * input.couponPercent) / 100 : 0;
  const discount = roundTo(Math.min(subtotal, Math.max(0, flat + pct)), dp);
  const discounted = roundTo(subtotal - discount, dp);

  const deliveryFee = roundTo(resolveDeliveryFee(discounted, config, input.deliveryOverride), dp);
  const serviceFee = roundTo(resolveServiceFee(discounted, config), dp);
  const tip = roundTo(resolveTip(discounted, input.tip), dp);

  const taxableBase = discounted
    + (config.taxableIncludesDelivery ? deliveryFee : 0)
    + (config.taxableIncludesService ? serviceFee : 0);
  const tax = roundTo(computeTax(taxableBase, config), dp);

  // Inclusive tax is already inside the prices, so it is not re-added to the total.
  const total = roundTo(
    discounted + deliveryFee + serviceFee + tip + (config.taxMode === 'exclusive' ? tax : 0),
    dp,
  );

  const minOrder = config.minOrder ?? 0;
  return {
    currency: config.currency,
    lines, subtotal, discount, deliveryFee, serviceFee,
    taxMode: config.taxMode, tax, tip, total,
    meetsMinOrder: subtotal >= minOrder,
    minOrderShortfall: roundTo(Math.max(0, minOrder - subtotal), dp),
  };
}
