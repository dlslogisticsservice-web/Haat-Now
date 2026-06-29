// ─────────────────────────────────────────────────────────────────────────────
// Sandbox shared backend (localStorage). Active ONLY in VITE_AUTH_MODE=sandbox.
// Gives the demo accounts a SHARED order/wallet/notification state so the full
// cross-actor lifecycle (customer → merchant → driver → delivered → wallet →
// notifications → history → admin) works without a real backend.
// ─────────────────────────────────────────────────────────────────────────────

export type SbStatus = 'pending' | 'accepted' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';

export interface SbOrderItem { name: string; qty: number; price: number }
export interface SbOrder {
  id: string;
  customer_id: string;
  customer_name: string;
  branch_id: string;
  branch_name: string;
  driver_id: string | null;
  status: SbStatus;
  total_amount: number;
  delivery_fee: number;
  items: SbOrderItem[];
  created_at: string;
  history: { status: SbStatus; at: string }[];
  failureReason?: string;   // set when cancelled via a failure workflow
  failedBy?: string;        // merchant | driver | customer | system
}
export interface SbNotif { id: string; target_user_id: string; message: string; created_at: string; read?: boolean }
export interface SbReview { id: string; order_id: string; rating: number; comment: string; created_at: string }
export interface SbProduct { id: string; merchant_id: string; name: string; price: number; stock: number; low_threshold: number; category: string; active: boolean }
export interface SbStockMove { id: string; product_id: string; delta: number; reason: string; at: string }
export interface SbCoupon { id: string; code: string; discount_percent: number; max_uses: number; used: number; expires_at: string; country: string | null; active: boolean; created_at: string }
export interface SbLoyaltyTxn { id: string; customer_id: string; points: number; reason: string; at: string }
export interface SbPushToken { id: string; user_id: string; token: string; platform: string; created_at: string }

const ORDERS_KEY = 'haat_sb_orders';
const WALLET_KEY = 'haat_sb_wallets';
const NOTIF_KEY  = 'haat_sb_notifs';
const REVIEW_KEY = 'haat_sb_reviews';
const PROD_KEY   = 'haat_sb_products';
const STOCK_KEY  = 'haat_sb_stock_moves';
const COUPON_KEY = 'haat_sb_coupons';
const LOYAL_KEY  = 'haat_sb_loyalty';
const PUSH_KEY   = 'haat_sb_push_tokens';
const ADDR_KEY   = 'haat_sb_addresses';
const SEQ_KEY    = 'haat_sb_seq';

function read<T>(k: string, def: T): T {
  if (typeof localStorage === 'undefined') return def;
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; }
}
function write(k: string, v: unknown) { if (typeof localStorage !== 'undefined') localStorage.setItem(k, JSON.stringify(v)); }
function nowISO() { return new Date().toISOString(); }
function nextId(prefix: string) {
  const n = read<number>(SEQ_KEY, 1000) + 1; write(SEQ_KEY, n);
  return `${prefix}-${n}`;
}

function getWallets(): Record<string, number> { return read<Record<string, number>>(WALLET_KEY, {}); }
function setWallet(key: string, bal: number) { const w = getWallets(); w[key] = bal; write(WALLET_KEY, w); }

function pushNotif(target: string, message: string) {
  const list = read<SbNotif[]>(NOTIF_KEY, []);
  list.unshift({ id: nextId('n'), target_user_id: target, message, created_at: nowISO() });
  write(NOTIF_KEY, list);
}

export const sandboxStore = {
  // ── Orders ────────────────────────────────────────────────────────────────
  getOrders(): SbOrder[] { return read<SbOrder[]>(ORDERS_KEY, []); },
  getById(id: string): SbOrder | undefined { return this.getOrders().find(o => o.id === id); },
  getCustomerOrders(customerId: string): SbOrder[] { return this.getOrders().filter(o => o.customer_id === customerId); },
  getMerchantOrders(): SbOrder[] { return this.getOrders(); },                 // single demo merchant
  getDriverAvailable(): SbOrder[] { return this.getOrders().filter(o => (o.status === 'accepted' || o.status === 'preparing') && !o.driver_id); },
  getDriverActive(driverId: string): SbOrder[] { return this.getOrders().filter(o => o.driver_id === driverId && o.status !== 'delivered' && o.status !== 'cancelled'); },
  getDriverDelivered(driverId: string): SbOrder[] { return this.getOrders().filter(o => o.driver_id === driverId && o.status === 'delivered'); },

  createOrder(input: { customer_id: string; customer_name: string; branch_id: string; branch_name: string; total_amount: number; delivery_fee?: number; items: SbOrderItem[] }): SbOrder {
    const orders = this.getOrders();
    const order: SbOrder = {
      id: nextId('o'),
      customer_id: input.customer_id,
      customer_name: input.customer_name,
      branch_id: input.branch_id || 'demo-branch-1',
      branch_name: input.branch_name || 'الفرع التجريبي',
      driver_id: null,
      status: 'pending',
      total_amount: input.total_amount,
      delivery_fee: input.delivery_fee ?? 10,
      items: input.items,
      created_at: nowISO(),
      history: [{ status: 'pending', at: nowISO() }],
    };
    orders.unshift(order);
    write(ORDERS_KEY, orders);
    pushNotif(input.customer_id, `تم استلام طلبك #${order.id.toUpperCase()} وهو قيد المراجعة.`);
    pushNotif('merchant', `طلب جديد #${order.id.toUpperCase()} بقيمة ${input.total_amount}.`);
    return order;
  },

  setStatus(id: string, status: SbStatus): SbOrder | undefined {
    const orders = this.getOrders();
    const o = orders.find(x => x.id === id);
    if (!o) return undefined;
    o.status = status;
    (o.history ||= []).push({ status, at: nowISO() });   // guard: orders from any source may lack history
    write(ORDERS_KEY, orders);
    const msg: Record<SbStatus, string> = {
      pending: 'طلبك قيد المراجعة', accepted: 'قَبِل المتجر طلبك ✅', preparing: 'المتجر يحضّر طلبك الآن 👨‍🍳',
      on_the_way: 'الكابتن في الطريق إليك 🚴', delivered: 'تم تسليم طلبك ✅', cancelled: 'تم إلغاء طلبك',
    };
    pushNotif(o.customer_id, `طلب #${o.id.toUpperCase()}: ${msg[status]}`);
    return o;
  },

  // Order-failure workflows — merchant reject/cancel, driver failed pickup/delivery,
  // customer refused / no-show. A failure is a cancellation carrying a typed reason.
  failOrder(id: string, reason: string, by: string): SbOrder | undefined {
    const orders = this.getOrders();
    const o = orders.find(x => x.id === id);
    if (!o || o.status === 'delivered' || o.status === 'cancelled') return undefined;
    o.status = 'cancelled'; o.failureReason = reason; o.failedBy = by;
    (o.history ||= []).push({ status: 'cancelled', at: nowISO() });
    write(ORDERS_KEY, orders);
    const labels: Record<string, string> = {
      merchant_rejected: 'اعتذر المتجر عن تنفيذ طلبك', merchant_cancelled: 'ألغى المتجر طلبك',
      driver_rejected: 'تعذّر إسناد كابتن، نعيد المحاولة', failed_pickup: 'تعذّر استلام الطلب من المتجر',
      failed_delivery: 'تعذّر تسليم الطلب', customer_refused: 'تم تسجيل رفض الاستلام', customer_no_show: 'العميل غير متواجد',
    };
    pushNotif(o.customer_id, `طلب #${o.id.toUpperCase()}: ${labels[reason] || 'تم إلغاء الطلب'}`);
    return o;
  },

  // Failed / incident orders for the Operations incident dashboard.
  getFailedOrders(): SbOrder[] { return this.getOrders().filter(o => o.status === 'cancelled' && !!o.failureReason); },

  assignDriver(id: string, driverId: string): SbOrder | undefined {
    const orders = this.getOrders();
    const o = orders.find(x => x.id === id);
    if (!o) return undefined;
    o.driver_id = driverId;
    write(ORDERS_KEY, orders);
    return o;
  },

  // Driver completes delivery → status delivered + credit driver wallet + notify.
  completeDelivery(id: string, driverId: string): { order?: SbOrder; newBalance: number } {
    const o = this.setStatus(id, 'delivered');
    const key = `driver:${driverId}`;
    const newBalance = this.getWallet('driver', driverId) + (o?.delivery_fee ?? 10);
    setWallet(key, newBalance);
    pushNotif(driverId, `تمت إضافة ${o?.delivery_fee ?? 10} لمحفظتك من توصيل #${o?.id.toUpperCase()} 💰`);
    // Loyalty: customer earns 1 point per currency unit of order value on delivery.
    if (o) {
      const pts = Math.round(o.total_amount);
      this.addPoints(o.customer_id, pts, `طلب #${o.id.toUpperCase()}`);
      pushNotif(o.customer_id, `ربحت ${pts} نقطة من طلبك #${o.id.toUpperCase()} 🎁`);
    }
    return { order: o, newBalance };
  },

  // ── Wallet ──────────────────────────────────────────────────────────────────
  getWallet(ownerType: 'customer' | 'driver', ownerId: string): number {
    const w = getWallets();
    const key = `${ownerType}:${ownerId}`;
    if (w[key] === undefined) { w[key] = ownerType === 'customer' ? 250 : 0; write(WALLET_KEY, w); }
    return w[key];
  },
  creditWallet(ownerType: 'customer' | 'driver', ownerId: string, amount: number): number {
    const bal = this.getWallet(ownerType, ownerId) + amount;
    setWallet(`${ownerType}:${ownerId}`, bal);
    return bal;
  },
  getDriverEarnings(driverId: string): { count: number; total: number } {
    const delivered = this.getDriverDelivered(driverId);
    return { count: delivered.length, total: delivered.reduce((s, o) => s + o.delivery_fee, 0) };
  },

  // ── Notifications ────────────────────────────────────────────────────────────
  getNotifications(userId: string): SbNotif[] {
    return read<SbNotif[]>(NOTIF_KEY, []).filter(n => n.target_user_id === userId);
  },

  // ── Analytics (platform / merchant / driver) ─────────────────────────────────
  getPlatformAnalytics(): { totalOrders: number; delivered: number; cancelled: number; revenue: number; avgOrder: number; activeOrders: number } {
    const all = this.getOrders();
    const delivered = all.filter(o => o.status === 'delivered');
    const revenue = delivered.reduce((s, o) => s + o.total_amount, 0);
    return {
      totalOrders: all.length,
      delivered: delivered.length,
      cancelled: all.filter(o => o.status === 'cancelled').length,
      revenue,
      avgOrder: delivered.length ? Math.round(revenue / delivered.length) : 0,
      activeOrders: all.filter(o => ['pending', 'accepted', 'preparing', 'on_the_way'].includes(o.status)).length,
    };
  },
  getMerchantAnalytics(): { orders: number; delivered: number; revenue: number; avgOrder: number } {
    const all = this.getMerchantOrders();
    const delivered = all.filter(o => o.status === 'delivered');
    // Guard each term: a single row missing total_amount/delivery_fee must not poison the whole sum into NaN.
    const revenue = delivered.reduce((s, o) => s + ((o.total_amount || 0) - (o.delivery_fee || 0)), 0);
    return { orders: all.length, delivered: delivered.length, revenue, avgOrder: delivered.length ? Math.round(revenue / delivered.length) : 0 };
  },

  // ── Reviews & ratings ────────────────────────────────────────────────────────
  getReview(orderId: string): SbReview | undefined {
    return read<SbReview[]>(REVIEW_KEY, []).find(r => r.order_id === orderId);
  },
  setReview(orderId: string, rating: number, comment: string): SbReview {
    const list = read<SbReview[]>(REVIEW_KEY, []).filter(r => r.order_id !== orderId);
    const review: SbReview = { id: nextId('rv'), order_id: orderId, rating, comment, created_at: nowISO() };
    list.unshift(review);
    write(REVIEW_KEY, list);
    return review;
  },
  markNotifRead(notifId: string) {
    const list = read<SbNotif[]>(NOTIF_KEY, []).map(n => n.id === notifId ? { ...n, read: true } : n);
    write(NOTIF_KEY, list);
  },
  markAllNotifsRead(userId: string) {
    const list = read<SbNotif[]>(NOTIF_KEY, []).map(n => n.target_user_id === userId ? { ...n, read: true } : n);
    write(NOTIF_KEY, list);
  },

  // ── Inventory / products ─────────────────────────────────────────────────────
  getProducts(merchantId: string): SbProduct[] {
    let list = read<SbProduct[]>(PROD_KEY, []).filter(p => p.merchant_id === merchantId);
    if (list.length === 0) {
      list = [
        { id: 'p1', merchant_id: merchantId, name: 'كبسة لحم فاخرة', price: 45, stock: 24, low_threshold: 8, category: 'مطاعم', active: true },
        { id: 'p2', merchant_id: merchantId, name: 'مندي دجاج',       price: 38, stock: 6,  low_threshold: 8, category: 'مطاعم', active: true },
        { id: 'p3', merchant_id: merchantId, name: 'عصير برتقال طازج',  price: 12, stock: 0,  low_threshold: 5, category: 'مشروبات', active: true },
      ];
      write(PROD_KEY, [...read<SbProduct[]>(PROD_KEY, []), ...list]);
    }
    return list;
  },
  addProduct(merchantId: string, name: string, price: number, stock: number, category: string): SbProduct {
    const all = read<SbProduct[]>(PROD_KEY, []);
    const prod: SbProduct = { id: nextId('p'), merchant_id: merchantId, name, price, stock, low_threshold: 5, category, active: true };
    all.push(prod); write(PROD_KEY, all);
    this.recordStockMove(prod.id, stock, 'إنشاء المنتج');
    return prod;
  },
  adjustStock(productId: string, delta: number, reason: string): SbProduct | undefined {
    const all = read<SbProduct[]>(PROD_KEY, []);
    const p = all.find(x => x.id === productId);
    if (!p) return undefined;
    p.stock = Math.max(0, p.stock + delta);
    write(PROD_KEY, all);
    this.recordStockMove(productId, delta, reason);
    return p;
  },
  setProductActive(productId: string, active: boolean) {
    const all = read<SbProduct[]>(PROD_KEY, []);
    const p = all.find(x => x.id === productId); if (p) { p.active = active; write(PROD_KEY, all); }
  },
  recordStockMove(productId: string, delta: number, reason: string) {
    const list = read<SbStockMove[]>(STOCK_KEY, []);
    list.unshift({ id: nextId('sm'), product_id: productId, delta, reason, at: nowISO() });
    write(STOCK_KEY, list.slice(0, 200));
  },
  getStockHistory(productId: string): SbStockMove[] {
    return read<SbStockMove[]>(STOCK_KEY, []).filter(m => m.product_id === productId);
  },
  getInventoryStats(merchantId: string): { total: number; low: number; out: number; units: number } {
    const ps = this.getProducts(merchantId);
    return {
      total: ps.length,
      low: ps.filter(p => p.stock > 0 && p.stock <= p.low_threshold).length,
      out: ps.filter(p => p.stock === 0).length,
      units: ps.reduce((s, p) => s + p.stock, 0),
    };
  },

  // ── Coupons ──────────────────────────────────────────────────────────────────
  getCoupons(): SbCoupon[] {
    let list = read<SbCoupon[]>(COUPON_KEY, []);
    if (list.length === 0) {
      list = [{ id: 'cp1', code: 'HAAT20', discount_percent: 20, max_uses: 100, used: 12, expires_at: '2026-12-31', country: null, active: true, created_at: nowISO() }];
      write(COUPON_KEY, list);
    }
    return list;
  },
  createCoupon(c: Omit<SbCoupon, 'id' | 'used' | 'created_at'>): SbCoupon {
    const list = read<SbCoupon[]>(COUPON_KEY, []);
    const coupon: SbCoupon = { ...c, id: nextId('cp'), used: 0, created_at: nowISO() };
    list.unshift(coupon); write(COUPON_KEY, list);
    return coupon;
  },
  updateCoupon(id: string, patch: Partial<SbCoupon>) {
    const list = read<SbCoupon[]>(COUPON_KEY, []).map(c => c.id === id ? { ...c, ...patch } : c);
    write(COUPON_KEY, list);
  },
  validateCoupon(code: string, country: string): { ok: boolean; coupon?: SbCoupon; reason?: string } {
    const c = this.getCoupons().find(x => x.code.toUpperCase() === code.toUpperCase());
    if (!c) return { ok: false, reason: 'كوبون غير موجود' };
    if (!c.active) return { ok: false, reason: 'الكوبون غير مفعّل' };
    if (c.expires_at && new Date(c.expires_at) < new Date(nowISO())) return { ok: false, reason: 'انتهت صلاحية الكوبون' };
    if (c.max_uses > 0 && c.used >= c.max_uses) return { ok: false, reason: 'تم استنفاد الكوبون' };
    if (c.country && c.country !== country) return { ok: false, reason: 'الكوبون غير متاح في بلدك' };
    return { ok: true, coupon: c };
  },

  // ── Saved addresses (demo) ───────────────────────────────────────────────────
  getAddresses(customerId: string): any[] {
    const all = read<any[]>(ADDR_KEY, []);
    let mine = all.filter(a => a.customer_id === customerId);
    if (mine.length === 0) {
      // Seed a couple of realistic default addresses so checkout/address-book are never empty.
      const seed = [
        { id: nextId('addr'), customer_id: customerId, zone_id: 'z1', address_line: 'شارع الملك فهد، حي العليا، الرياض', label: 'المنزل', is_default: true },
        { id: nextId('addr'), customer_id: customerId, zone_id: 'z2', address_line: 'طريق الملك عبدالله، حي الملقا، الرياض', label: 'العمل', is_default: false },
      ];
      write(ADDR_KEY, [...all, ...seed]);
      mine = seed;
    }
    return mine.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
  },
  addAddress(input: { customer_id: string; zone_id: string; address_line: string; label: string }): any {
    const all = read<any[]>(ADDR_KEY, []);
    const a = { id: nextId('addr'), customer_id: input.customer_id, zone_id: input.zone_id, address_line: input.address_line, label: input.label, is_default: all.filter(x => x.customer_id === input.customer_id).length === 0 };
    write(ADDR_KEY, [a, ...all]);
    return a;
  },

  // ── Loyalty / rewards ────────────────────────────────────────────────────────
  getPoints(customerId: string): number {
    return read<SbLoyaltyTxn[]>(LOYAL_KEY, []).filter(t => t.customer_id === customerId).reduce((s, t) => s + t.points, 0);
  },
  getLoyaltyHistory(customerId: string): SbLoyaltyTxn[] {
    return read<SbLoyaltyTxn[]>(LOYAL_KEY, []).filter(t => t.customer_id === customerId);
  },
  addPoints(customerId: string, points: number, reason: string): SbLoyaltyTxn {
    const list = read<SbLoyaltyTxn[]>(LOYAL_KEY, []);
    const txn: SbLoyaltyTxn = { id: nextId('lp'), customer_id: customerId, points, reason, at: nowISO() };
    list.unshift(txn); write(LOYAL_KEY, list);
    return txn;
  },
  redeemPoints(customerId: string, points: number, reason: string): { ok: boolean; reason?: string } {
    if (this.getPoints(customerId) < points) return { ok: false, reason: 'نقاط غير كافية' };
    this.addPoints(customerId, -points, reason);
    return { ok: true };
  },

  // ── Push tokens ──────────────────────────────────────────────────────────────
  registerPushToken(userId: string, token: string, platform: string): SbPushToken {
    const list = read<SbPushToken[]>(PUSH_KEY, []).filter(t => t.token !== token);
    const rec: SbPushToken = { id: nextId('pt'), user_id: userId, token, platform, created_at: nowISO() };
    list.unshift(rec); write(PUSH_KEY, list);
    return rec;
  },
  getPushTokens(userId: string): SbPushToken[] {
    return read<SbPushToken[]>(PUSH_KEY, []).filter(t => t.user_id === userId);
  },
};
