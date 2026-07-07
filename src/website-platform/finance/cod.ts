// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Cash-on-Delivery model (Production Launch Sprint).
// COD as a FIRST-CLASS payment method: pure, isomorphic rules for a cash payment that
// needs NO gateway and NO secret. The payment orchestrator (single payment pipeline)
// shapes its COD record from this — no duplicated logic. Node-testable ("payment tests").
// ─────────────────────────────────────────────────────────────────────────────

export const COD_PROVIDER = 'cod' as const;

/** A COD payment attempt as it flows through the ONE payment pipeline (payment_attempts). */
export interface CodPaymentRecord {
  orderId: string;
  customerId: string;
  provider: typeof COD_PROVIDER;
  amount: number;
  currency: string;
  status: 'pending' | 'collected';   // pending until the driver collects cash at delivery
  idempotencyKey: string;            // `cod:<orderId>` — one COD record per order
}

/** COD never touches an external gateway — that is the whole point of the launch path. */
export function codRequiresGateway(): boolean { return false; }

/** Build the COD attempt for an order. Amount is the full order total (cash due at door). */
export function buildCodRecord(orderId: string, customerId: string, amount: number, currency = 'SAR'): CodPaymentRecord {
  return {
    orderId, customerId, provider: COD_PROVIDER,
    amount: Math.max(0, Math.round(amount * 100) / 100),
    currency, status: 'pending',
    idempotencyKey: `cod:${orderId}`,
  };
}

/** Mark cash collected at delivery (driver hand-off). Reporting flips the order to paid here. */
export function markCodCollected(rec: CodPaymentRecord): CodPaymentRecord {
  return { ...rec, status: 'collected' };
}

/** The order's `payment_status` implied by a COD record — for reporting parity. */
export function codPaymentStatus(rec: CodPaymentRecord): 'unpaid' | 'paid' {
  return rec.status === 'collected' ? 'paid' : 'unpaid';
}
