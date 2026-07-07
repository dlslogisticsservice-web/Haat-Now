// ─────────────────────────────────────────────────────────────────────────────
// Website commerce controller (Launch Sprint 3, Parts 2–4).
// The website's commerce runs entirely on the SAME engine as the app: it reuses the
// existing services (cart / checkout / order / coupon / wallet / cx / customer) and the
// pure financial engine — never duplicating business logic. Dual-mode exactly like the
// app: the demo backend (sandboxStore, shared with the app) in sandbox, the real services
// in live. The mobile app is just another client; checkout completes here, on the website.
// ─────────────────────────────────────────────────────────────────────────────

import { cartService } from '../../services/cart.service';
import { checkoutService } from '../../services/checkout.service';
import { orderService } from '../../services/order.service';
import { paymentOrchestrator } from '../../services/payment-orchestrator.service';
import { cxService } from '../../services/cx.service';
import { productService } from '../../services/product.service';
import { sandboxStore } from '../../services/sandboxStore';
import { DEFAULT_DELIVERY_FEE } from '../../config/fees';
import { computePricing, type FeeConfig, type PriceBreakdown, type TipInput } from '../../website-platform/finance/pricing';

const SANDBOX = !!(import.meta.env && import.meta.env.VITE_AUTH_MODE === 'sandbox');

export interface MenuItem { id: string; name: string; price: number; category?: string; branchId: string; merchantId?: string }
export interface WebsiteCartLine { id: string; name: string; price: number; quantity: number; branchId: string }

/** Fee/tax configuration for the website. Values are config (not hardcoded in the engine):
 *  delivery falls back to the app's canonical DEFAULT_DELIVERY_FEE; VAT is the regional rate. */
export function websiteFeeConfig(over: Partial<FeeConfig> = {}): FeeConfig {
  return {
    currency: 'SAR',
    deliveryFee: DEFAULT_DELIVERY_FEE,
    freeDeliveryThreshold: 100,
    serviceFeeRate: 0,
    taxRate: 0.15,               // regional VAT — replace via admin app-config when wired
    taxMode: 'exclusive',
    minOrder: 0,
    roundingDp: 2,
    ...over,
  };
}

export const TIP_PRESETS = [0, 10, 15, 20];

/** Load a branch menu — reuses the same catalog the app uses (live productService, or the
 *  shared sandbox store in demo mode). Never invents a private mock. */
export async function loadMenu(branchId: string, merchantId?: string): Promise<MenuItem[]> {
  if (SANDBOX) {
    const mid = merchantId || 'm1';
    const products = sandboxStore.getProducts(mid).filter(p => p.active);
    return products.map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category, branchId, merchantId: mid }));
  }
  const { data } = await productService.getProductsByBranch(branchId);
  return (data || []).map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category_id, branchId, merchantId }));
}

// ── Cart (reuses cartService storage) ─────────────────────────────────────────────
export function getWebsiteCart(): WebsiteCartLine[] {
  const cart = cartService.getCart();
  return (cart.items || []).map(i => ({
    id: i.product.id + (i.variant?.id ? `_${i.variant.id}` : ''),
    name: i.product.name + (i.variant ? ` (${i.variant.name})` : ''),
    price: i.product.price + (i.variant?.price_modifier ?? 0),
    quantity: i.quantity,
    branchId: i.product.branch_id,
  }));
}

export function addToWebsiteCart(item: MenuItem, quantity = 1): WebsiteCartLine[] {
  cartService.addToCart(
    { id: item.id, name: item.name, price: item.price, branch_id: item.branchId } as never,
    null,
    quantity,
  );
  return getWebsiteCart();
}

export function setWebsiteCartQty(lineId: string, quantity: number): WebsiteCartLine[] {
  cartService.updateQuantity(lineId, quantity);
  return getWebsiteCart();
}

export function clearWebsiteCart(): void { cartService.clearCart(); }

// ── Pricing (reuses the pure financial engine) ────────────────────────────────────
export function breakdownFor(lines: ReadonlyArray<WebsiteCartLine>, opts: { couponPercent?: number; tip?: TipInput | null; deliveryOverride?: number | null } = {}): PriceBreakdown {
  return computePricing(
    { items: lines.map(l => ({ name: l.name, unitPrice: l.price, quantity: l.quantity })), couponPercent: opts.couponPercent, tip: opts.tip, deliveryOverride: opts.deliveryOverride },
    websiteFeeConfig(),
  );
}

// ── Coupon (reuses checkout/coupon validation) ────────────────────────────────────
export async function applyCoupon(code: string, country = 'SA'): Promise<{ ok: boolean; discountPercent: number; message?: string }> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, discountPercent: 0, message: 'Enter a code' };
  if (SANDBOX) {
    const r = sandboxStore.validateCoupon(trimmed, country);
    return r.ok && r.coupon ? { ok: true, discountPercent: r.coupon.discount_percent } : { ok: false, discountPercent: 0, message: r.reason || 'Invalid coupon' };
  }
  const { data, error } = await checkoutService.verifyCoupon(trimmed);
  if (error || !data) return { ok: false, discountPercent: 0, message: 'Invalid coupon' };
  return { ok: true, discountPercent: data.discount_percent };
}

// ── Place order (reuses orderService / shared demo backend) ────────────────────────
export interface PlaceOrderInput {
  customerId: string;            // real customer id, or a generated guest id
  customerName: string;
  branchId: string;
  branchName: string;
  lines: ReadonlyArray<WebsiteCartLine>;
  breakdown: PriceBreakdown;
  addressId?: string | null;
}

export interface PlacedOrder { orderId: string }

export async function placeWebsiteOrder(input: PlaceOrderInput): Promise<{ data: PlacedOrder | null; error: string | null }> {
  const items = input.lines.map(l => ({ name: l.name, qty: l.quantity, price: l.price }));
  // COD (cash on delivery) — the production launch method: create the order via the existing
  // order engine, then record a COD attempt on the single payment pipeline. No gateway/secret.
  if (SANDBOX) {
    const order = sandboxStore.createOrder({
      customer_id: input.customerId, customer_name: input.customerName,
      branch_id: input.branchId, branch_name: input.branchName,
      total_amount: input.breakdown.total, delivery_fee: input.breakdown.deliveryFee,
      items,
    });
    await paymentOrchestrator.recordCod({ orderId: order.id, customerId: input.customerId, amount: input.breakdown.total, currency: input.breakdown.currency });
    clearWebsiteCart();
    return { data: { orderId: order.id }, error: null };
  }
  const resolved = await Promise.all(input.lines.map(async l => ({
    variantId: await checkoutService.resolveVariantId(l.id.split('_')[0]),
    quantity: l.quantity, price: l.price,
  })));
  const { data, error } = await orderService.createOrder(
    input.customerId, input.branchId, input.breakdown.total,
    resolved.map(r => ({ variantId: r.variantId || '', quantity: r.quantity, price: r.price })),
    { addressId: input.addressId ?? null, deliveryFee: input.breakdown.deliveryFee },
  );
  if (error || !data) return { data: null, error: 'Order failed' };
  await paymentOrchestrator.recordCod({ orderId: data.id, customerId: input.customerId, amount: input.breakdown.total, currency: input.breakdown.currency });
  clearWebsiteCart();
  return { data: { orderId: data.id }, error: null };
}

// ── Tracking (reuses cxService.tracking / shared demo backend) ─────────────────────
export interface WebsiteTracking {
  orderId: string;
  status: string;
  etaMinutes: number | null;
  driver: { name: string } | null;
  timeline: { status: string; at: string }[];
  total?: number;
  items?: { name: string; qty: number; price: number }[];
}

export async function getTracking(orderId: string): Promise<WebsiteTracking | null> {
  if (SANDBOX) {
    const o = sandboxStore.getById(orderId);
    if (!o) return null;
    const etaMap: Record<string, number> = { pending: 40, accepted: 35, preparing: 25, on_the_way: 12, delivered: 0, cancelled: 0 };
    return {
      orderId: o.id, status: o.status, etaMinutes: etaMap[o.status] ?? null,
      driver: o.driver_id ? { name: 'Captain' } : null,
      timeline: (o.history || []).map(h => ({ status: h.status, at: h.at })),
      total: o.total_amount, items: o.items,
    };
  }
  const t = await cxService.tracking(orderId);
  if (!t) return null;
  return {
    orderId: t.order_id, status: t.status, etaMinutes: t.eta_minutes,
    driver: t.driver ? { name: t.driver.name } : null,
    timeline: (t.timeline || []).map(x => ({ status: x.status, at: x.at })),
  };
}

// ── Post-order actions (all reused) ───────────────────────────────────────────────
export async function cancelWebsiteOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  if (SANDBOX) { const o = sandboxStore.getById(orderId); if (!o || o.status !== 'pending') return { ok: false, error: 'Only pending orders can be cancelled' }; sandboxStore.setStatus(orderId, 'cancelled'); return { ok: true }; }
  const { success, error } = await orderService.cancelOrder(orderId);
  return { ok: success, error: error ? String(error) : undefined };
}

export async function reorderWebsite(orderId: string): Promise<WebsiteCartLine[]> {
  if (SANDBOX) {
    const o = sandboxStore.getById(orderId);
    if (o) for (const it of o.items) cartService.addToCart({ id: `${orderId}_${it.name}`, name: it.name, price: it.price, branch_id: o.branch_id } as never, null, it.qty);
    return getWebsiteCart();
  }
  const { data } = await cxService.reorderItems(orderId);
  return (data || []) as never;
}

export async function requestRefund(orderId: string, reason: string): Promise<{ ok: boolean }> {
  const { error } = await cxService.createTicket(`Refund request for ${orderId}`, 'refund', reason, orderId);
  return { ok: !error };
}

export async function contactSupport(subject: string, message: string, orderId?: string): Promise<{ ok: boolean }> {
  const { error } = await cxService.createTicket(subject, 'inquiry', message, orderId);
  return { ok: !error };
}

/** A stable guest identity for checkout without login (persisted per browser). */
export function guestIdentity(): { id: string; name: string } {
  const KEY = 'haat_web_guest';
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return JSON.parse(existing);
    const id = `guest-${Math.abs(Array.from(KEY + navigator.userAgent).reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}-${(typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] : 0).toString(36)}`;
    const identity = { id, name: 'Guest' };
    localStorage.setItem(KEY, JSON.stringify(identity));
    return identity;
  } catch {
    return { id: 'guest-web', name: 'Guest' };
  }
}
