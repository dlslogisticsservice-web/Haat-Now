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
}
export interface SbNotif { id: string; target_user_id: string; message: string; created_at: string }

const ORDERS_KEY = 'haat_sb_orders';
const WALLET_KEY = 'haat_sb_wallets';
const NOTIF_KEY  = 'haat_sb_notifs';
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
    o.history.push({ status, at: nowISO() });
    write(ORDERS_KEY, orders);
    const msg: Record<SbStatus, string> = {
      pending: 'طلبك قيد المراجعة', accepted: 'قَبِل المتجر طلبك ✅', preparing: 'المتجر يحضّر طلبك الآن 👨‍🍳',
      on_the_way: 'الكابتن في الطريق إليك 🚴', delivered: 'تم تسليم طلبك ✅', cancelled: 'تم إلغاء طلبك',
    };
    pushNotif(o.customer_id, `طلب #${o.id.toUpperCase()}: ${msg[status]}`);
    return o;
  },

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
    return { order: o, newBalance };
  },

  // ── Wallet ──────────────────────────────────────────────────────────────────
  getWallet(ownerType: 'customer' | 'driver', ownerId: string): number {
    const w = getWallets();
    const key = `${ownerType}:${ownerId}`;
    if (w[key] === undefined) { w[key] = ownerType === 'customer' ? 250 : 0; write(WALLET_KEY, w); }
    return w[key];
  },
  getDriverEarnings(driverId: string): { count: number; total: number } {
    const delivered = this.getDriverDelivered(driverId);
    return { count: delivered.length, total: delivered.reduce((s, o) => s + o.delivery_fee, 0) };
  },

  // ── Notifications ────────────────────────────────────────────────────────────
  getNotifications(userId: string): SbNotif[] {
    return read<SbNotif[]>(NOTIF_KEY, []).filter(n => n.target_user_id === userId);
  },
};
