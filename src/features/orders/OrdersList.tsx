import React, { useEffect, useState, useRef } from 'react';
import { toast, confirmDialog } from '../../components/ui/feedback';
import { supabase } from '../../lib/supabase';
import { orderService } from '../../services/order.service';
import { productService } from '../../services/product.service';
import { OrderTrackingMap } from './OrderTrackingMap';
import { MultiTargetReview } from './MultiTargetReview';
import { cxService } from '../../services/cx.service';
import { cartService } from '../../services/cart.service';
import { sandboxStore } from '../../services/sandboxStore';
import { trackingService } from '../../services/tracking.service';
import { calculateDistanceKm, calculateEtaMinutes } from '../../services/location.service';
import { ORDER_LIFECYCLE } from '../../services/types';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { useTranslation } from 'react-i18next';
import {
  Loader2, ScrollText, ChevronLeft, ChevronRight, Truck, Check, Phone,
  MessageSquare, Headphones, Hourglass, CheckCircle, ChefHat, Bike,
  CheckCheck, XCircle, Star, RotateCcw,
} from 'lucide-react';
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';
import type { LucideIcon } from 'lucide-react';

function parseDriverCoords(coords: unknown): { lat: number; lng: number } | null {
  if (!coords) return null;
  if (typeof coords === 'object' && coords !== null) {
    const c = coords as Record<string, unknown>;
    if (typeof c.x === 'number' && typeof c.y === 'number') {
      return { lat: c.x, lng: c.y };
    }
  }
  if (typeof coords === 'string') {
    const m = coords.match(/\(([^,]+),([^)]+)\)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

interface Order {
  id: string;
  status: 'pending' | 'accepted' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  total_amount: number;
  created_at: string;
  branch_id: string;
  driver_id: string | null;
  merchant_branches: { name: string; merchants: { business_name: string } };
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  branch_lat_snapshot?: number | null;
  branch_lng_snapshot?: number | null;
}
interface OrdersListProps {
  customerId: string;
  onSelectOrderBack: () => void;
  selectedOrderIdInit?: string;
}

type OrderStatus = Order['status'];

const STATUS_CONFIG: Record<OrderStatus, { labelKey: string; color: string; Icon: LucideIcon }> = {
  pending:    { labelKey: 'orders.stPending', color: '#fbbf24', Icon: Hourglass   },
  accepted:   { labelKey: 'orders.stAccepted',          color: '#a3f95b', Icon: CheckCircle  },
  preparing:  { labelKey: 'orders.stPreparing',   color: '#a3f95b', Icon: ChefHat     },
  on_the_way: { labelKey: 'orders.stOnway',      color: '#a3f95b', Icon: Bike        },
  delivered:  { labelKey: 'orders.stDelivered',     color: '#4ade80', Icon: CheckCheck  },
  cancelled:  { labelKey: 'orders.stCancelled',           color: '#f87171', Icon: XCircle     },
};

// ── Category-specific order workflows (TASK C) ──────────────────────────────
// Each display step maps to an underlying order status. `reached` is computed
// from the order's REAL status so future stages can never appear completed.
// Lifecycle ordering is the canonical ORDER_LIFECYCLE (src/services/types.ts).
const CANON = ORDER_LIFECYCLE as readonly OrderStatus[];
type FlowStep = { labelKey: string; key: OrderStatus };
const STEP_FLOWS: Record<'restaurant' | 'pharmacy' | 'flowers' | 'electronics' | 'market', FlowStep[]> = {
  market: [
    { labelKey: 'orders.tlPlaced', key: 'pending' }, { labelKey: 'orders.tlConfirmedShort', key: 'accepted' },
    { labelKey: 'orders.tlPreparingShort', key: 'preparing' }, { labelKey: 'orders.tlPickedShort', key: 'on_the_way' }, { labelKey: 'orders.stDelivered', key: 'delivered' },
  ],
  restaurant: [
    { labelKey: 'orders.tlPlaced', key: 'pending' }, { labelKey: 'orders.tlConfirmedShort', key: 'accepted' },
    { labelKey: 'orders.tlInPrep', key: 'preparing' }, { labelKey: 'orders.tlReady', key: 'preparing' },
    { labelKey: 'orders.tlPickedShort', key: 'on_the_way' }, { labelKey: 'orders.stDelivered', key: 'delivered' },
  ],
  pharmacy: [
    { labelKey: 'orders.tlPlaced', key: 'pending' }, { labelKey: 'orders.tlConfirmedShort', key: 'accepted' },
    { labelKey: 'orders.tlPacking', key: 'preparing' }, { labelKey: 'orders.tlPickedShort', key: 'on_the_way' }, { labelKey: 'orders.stDelivered', key: 'delivered' },
  ],
  flowers: [
    { labelKey: 'orders.tlPlaced', key: 'pending' }, { labelKey: 'orders.tlConfirmedShort', key: 'accepted' },
    { labelKey: 'orders.tlPrepBouquet', key: 'preparing' }, { labelKey: 'orders.tlPickedShort', key: 'on_the_way' }, { labelKey: 'orders.stDelivered', key: 'delivered' },
  ],
  electronics: [
    { labelKey: 'orders.tlPlaced', key: 'pending' }, { labelKey: 'orders.tlConfirmedShort', key: 'accepted' },
    { labelKey: 'orders.tlPacked', key: 'preparing' }, { labelKey: 'orders.tlPickedShort', key: 'on_the_way' }, { labelKey: 'orders.stDelivered', key: 'delivered' },
  ],
};
function resolveFlow(branchName?: string): FlowStep[] {
  const n = (branchName || '').toLowerCase();
  if (/صيدلية|pharmac|دواء/.test(n)) return STEP_FLOWS.pharmacy;
  if (/زهور|ورود|flower|باقة/.test(n)) return STEP_FLOWS.flowers;
  if (/الكترون|إلكترون|electron|جوال|هاتف/.test(n)) return STEP_FLOWS.electronics;
  if (/سوبر|بقالة|سوق|ماركت|market|supermarket|تموين/.test(n)) return STEP_FLOWS.market;
  return STEP_FLOWS.restaurant;
}

const DRIVER_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuC1zBa4W1bsQKFL7K9DnwdSTzFmQqeZCe0dPpllnu1UKIjsvIUBFMajud9PVEzLDjwVaRt1fsUDKqC_ecnOLe2pKDJw7tr_WKPwHFcmmk59UZ6G8windy_z7tEr68RKqkSon3LgNenYQOHwvM6K1Pb6WX7RdMytcQSwGRywB4Tdd0OrZsrvOEk-UG85I1sTAHY4z25zOlm1gF-Uw7T0Chdryvfr9SYF-uVlEjeoI99MiVEMbWMg5cQTMfdAI0QIn2y05gcfkQDZUute';
const MAP_PHOTO  = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhSGJvJ91keV3KcXiIFnKS0YhWuSrKZCW_iybvURGhGZZjmD01O8E66Pe-IZIknLpa1xr6rbN2yXLRNgJxyafvetf_ne8GPITiRjaEB3eMmekg6LFLSIp7fCqL1UW6MdveMsESOAgzLCSewmAvdCa6ZcR2yV-xM3RgvJhMyp7xR8KkkI6rHP2Gwk06kTavSB_EMMkiSUASFeHhISs-kxGA0bnA0FDYSnYjfPRV2wUiXfRUZo6cnRgsN2WzM-VRNUcn1-Tdm0fqmccQ';

export const OrdersList = ({ customerId, onSelectOrderBack, selectedOrderIdInit }: OrdersListProps) => {
  const { price: money, lang } = useAppConfig();
  const { t } = useTranslation();
  const [orders,          setOrders]          = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(selectedOrderIdInit || null);
  const [orderDetails,    setOrderDetails]    = useState<any | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [detailsLoading,  setDetailsLoading]  = useState(false);
  const [courierProgress, setCourierProgress] = useState(0);
  const [reordering, setReordering] = useState(false);

  // One-click reorder: clone a previous order's items into the cart (missing/out-of-stock skipped).
  const handleReorder = async (orderId: string) => {
    setReordering(true);
    try {
      const { data: items } = await cxService.reorderItems(orderId);
      if (!items.length) { toast.error(t('orders.reorderNoItems')); return; }
      cartService.clearCart();
      let added = 0, skipped = 0;
      for (const it of items) {
        const { data: product } = await productService.getProductDetails(it.product_id);
        if (!product || (product as any).is_active === false) { skipped++; continue; }
        if (typeof product.stock === 'number' && product.stock <= 0) { skipped++; continue; } // out of stock
        const variant = ((product as any).product_variants || []).find((v: any) => v.id === it.variant_id) || null;
        try { cartService.addToCart(product, variant, it.quantity); added++; } catch { skipped++; }
      }
      toast.success(added > 0
        ? t('orders.reorderAdded', { added }) + (skipped ? t('orders.reorderSkipped', { skipped }) : '')
        : t('orders.reorderFailed'));
    } finally { setReordering(false); }
  };
  const [riderLoc,        setRiderLoc]        = useState<{ lat: number; lng: number } | null>(null);
  const canvasRef           = useRef<HTMLCanvasElement | null>(null);
  const containerRef        = useRef<HTMLDivElement | null>(null);
  const driverLocChannelRef = useRef<any>(null);
  const [dimensions,      setDimensions]      = useState({ width: 400, height: 220 });
  const [ticketSubject,   setTicketSubject]   = useState('');
  const [showTicketInput, setShowTicketInput] = useState(false);
  const [ticketLoading,   setTicketLoading]   = useState(false);
  // ── Reviews & ratings (delivered orders) ──
  const [ratingValue,     setRatingValue]     = useState(0);
  const [ratingHover,     setRatingHover]     = useState(0);
  const [ratingComment,   setRatingComment]   = useState('');
  const [ratingDone,      setRatingDone]      = useState(false);
  const [ratingLoading,   setRatingLoading]   = useState(false);

  // Load any existing review when a delivered order is opened.
  useEffect(() => {
    setRatingValue(0); setRatingHover(0); setRatingComment(''); setRatingDone(false);
    if (!selectedOrderId || orderDetails?.status !== 'delivered') return;
    if (SANDBOX) {
      const r = sandboxStore.getReview(selectedOrderId);
      if (r) { setRatingValue(r.rating); setRatingComment(r.comment); setRatingDone(true); }
    } else {
      productService.getReviews(selectedOrderId).then(({ data }) => {
        const r = data?.[0];
        if (r) { setRatingValue(r.rating); setRatingComment(r.comment || ''); setRatingDone(true); }
      }).catch(() => { /* ignore */ });
    }
  }, [selectedOrderId, orderDetails?.status]);

  const submitRating = async () => {
    if (!selectedOrderId || ratingValue < 1 || ratingLoading) return;
    setRatingLoading(true);
    try {
      if (SANDBOX) {
        sandboxStore.setReview(selectedOrderId, ratingValue, ratingComment.trim());
      } else {
        await productService.submitReview({ order_id: selectedOrderId, customer_id: customerId, rating: ratingValue, comment: ratingComment.trim() || null });
      }
      setRatingDone(true);
    } catch { /* surfaced by the unchanged state */ }
    finally { setRatingLoading(false); }
  };

  useEffect(() => {
    fetchOrders();
    if (SANDBOX) return;   // demo is client-side — no realtime socket (avoids 403/ws errors)
    const channel = supabase.channel('orders-realtime-customer')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` }, () => {
        fetchOrders();
        if (selectedOrderId) fetchOrderDetails(selectedOrderId);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [customerId, selectedOrderId]);

  useEffect(() => {
    if (selectedOrderIdInit) { setSelectedOrderId(selectedOrderIdInit); fetchOrderDetails(selectedOrderIdInit); }
  }, [selectedOrderIdInit]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setDimensions({ width: Math.max(280, width), height: Math.max(160, height || 200) });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [selectedOrderId, orderDetails]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
    const primaryColor = '#a3f95b';
    ctx.strokeStyle = '#1c2117'; ctx.lineWidth = 1.5;
    const roadSpacing = 50;
    for (let i = 0; i < dimensions.width; i += roadSpacing) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, dimensions.height); ctx.stroke(); }
    for (let j = 0; j < dimensions.height; j += roadSpacing) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(dimensions.width, j); ctx.stroke(); }
    const storeX = dimensions.width * 0.2; const storeY = dimensions.height * 0.7;
    const destX  = dimensions.width * 0.8; const destY  = dimensions.height * 0.3;
    ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 4;
    ctx.moveTo(storeX, storeY); ctx.bezierCurveTo(dimensions.width * 0.4, dimensions.height * 0.8, dimensions.width * 0.6, dimensions.height * 0.2, destX, destY); ctx.stroke();
    const getBP = (p0: number, p1: number, p2: number, p3: number, t: number) => { const mt = 1 - t; return mt*mt*mt*p0 + 3*mt*mt*t*p1 + 3*mt*t*t*p2 + t*t*t*p3; };
    ctx.beginPath(); ctx.strokeStyle = primaryColor; ctx.lineWidth = 4;
    for (let i = 0; i <= courierProgress * 20; i++) {
      const s = i / 20;
      const cx = getBP(storeX, dimensions.width*0.4, dimensions.width*0.6, destX, s);
      const cy = getBP(storeY, dimensions.height*0.8, dimensions.height*0.2, destY, s);
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = '#ffffff'; ctx.arc(storeX, storeY, 7, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = '#e11d48'; ctx.arc(destX, destY, 7, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    const dryX = getBP(storeX, dimensions.width*0.4, dimensions.width*0.6, destX, courierProgress);
    const dryY = getBP(storeY, dimensions.height*0.8, dimensions.height*0.2, destY, courierProgress);
    ctx.beginPath(); ctx.fillStyle = primaryColor; ctx.arc(dryX, dryY, 11, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#10150b'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.strokeStyle = 'rgba(163,249,91,0.35)'; ctx.lineWidth = 2; ctx.arc(dryX, dryY, 11 + Math.abs(Math.sin(Date.now()/200)*5), 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '9px Arial';
    ctx.fillText(t('orders.store'), storeX-14, storeY+20);
    ctx.fillText(t('orders.home'),  destX-10,  destY-14);
  }, [dimensions, courierProgress, t]);

  useEffect(() => {
    if (!riderLoc || !orderDetails) return;
    const mLat = orderDetails.branch_lat_snapshot;
    const mLng = orderDetails.branch_lng_snapshot;
    const cLat = orderDetails.delivery_lat;
    const cLng = orderDetails.delivery_lng;
    if (mLat == null || mLng == null || cLat == null || cLng == null) return;
    const total = calculateDistanceKm(mLat, mLng, cLat, cLng);
    if (total < 0.01) return;
    const traveled = calculateDistanceKm(mLat, mLng, riderLoc.lat, riderLoc.lng);
    setCourierProgress(Math.min(1, traveled / total));
  }, [riderLoc, orderDetails]);

  useEffect(() => {
    const driverId    = orderDetails?.driver_id;
    const activeStatus = orderDetails?.status;
    if (SANDBOX) return;   // demo is client-side — no realtime driver-location socket
    if (!driverId || !['preparing', 'on_the_way'].includes(activeStatus)) {
      if (driverLocChannelRef.current) { supabase.removeChannel(driverLocChannelRef.current); driverLocChannelRef.current = null; }
      return;
    }
    if (driverLocChannelRef.current) supabase.removeChannel(driverLocChannelRef.current);
    trackingService.getDriverLocation(driverId).then(({ data }) => {
      if (data) { const parsed = parseDriverCoords(data.coords); if (parsed) setRiderLoc(parsed); }
    });
    const handler = (payload: any) => {
      const parsed = parseDriverCoords(payload.new?.coords);
      if (parsed) setRiderLoc(parsed);
    };
    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` }, handler)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` }, handler)
      .subscribe();
    driverLocChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); driverLocChannelRef.current = null; };
  }, [orderDetails?.driver_id, orderDetails?.status]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      if (import.meta.env.VITE_AUTH_MODE === 'sandbox') {
        const sb = sandboxStore.getCustomerOrders(customerId);
        setOrders(sb.map(o => ({ id: o.id, status: o.status, total_amount: o.total_amount, created_at: o.created_at, branch_id: o.branch_id, merchant_branches: { name: o.branch_name } })) as unknown as Order[]);
        return;
      }
      const { data, error } = await orderService.getCustomerOrders(customerId);
      if (!error && data) setOrders(data as unknown as Order[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchOrderDetails = async (orderId: string) => {
    setRiderLoc(null);
    if (SANDBOX) {
      const o = sandboxStore.getById(orderId);
      if (o) {
        setOrderDetails({
          id: o.id, status: o.status, total_amount: o.total_amount, driver_id: o.driver_id,
          drivers: o.driver_id ? { full_name: t('orders.captainHaat'), phone_number: '' } : null,
          merchant_branches: { name: o.branch_name },
          branch_lat_snapshot: null, branch_lng_snapshot: null, delivery_lat: null, delivery_lng: null,
        });
        setCourierProgress(o.status === 'delivered' ? 1.0 : o.status === 'on_the_way' ? 0.5 : o.status === 'preparing' ? 0.25 : o.status === 'accepted' ? 0.1 : 0);
      }
      setDetailsLoading(false);
      return;
    }
    try {
      setDetailsLoading(true);
      const { data, error } = await orderService.getOrderDetails(orderId);
      if (!error && data) {
        setOrderDetails(data);
        if      (data.status === 'pending')    setCourierProgress(0);
        else if (data.status === 'accepted')   setCourierProgress(0.1);
        else if (data.status === 'preparing')  setCourierProgress(0.25);
        else if (data.status === 'on_the_way') setCourierProgress(0.5);
        else if (data.status === 'delivered')  setCourierProgress(1.0);
        else setCourierProgress(0);
      }
    } catch (e) { console.error(e); }
    finally { setDetailsLoading(false); }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!(await confirmDialog({ message: t('orders.cancelConfirm'), danger: true }))) return;
    try {
      const { success, error } = await orderService.cancelOrder(orderId, 'إلغاء سريع من المستخدم');
      if (success) { toast.success(t('orders.cancelSuccess')); fetchOrders(); fetchOrderDetails(orderId); }
      else toast.error(`${t('orders.cancelFail')}: ${(error as any)?.message || error}`);
    } catch (e) { console.error(e); }
  };

  const handleOpenTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ticketSubject || !selectedOrderId) return;
    setTicketLoading(true);
    try {
      const { data: ticket, error: err } = await supabase.from('support_tickets')
        .insert({ customer_id: customerId, subject: `${ticketSubject} (طلب: ${selectedOrderId.slice(-6).toUpperCase()})`, status: 'open', priority: 'medium' })
        .select().single();
      if (ticket) {
        await supabase.from('support_messages').insert({ ticket_id: ticket.id, sender_type: 'customer', sender_id: customerId, message_text: `أرغب في شكوى بخصوص: ${ticketSubject}.` });
        toast.error(t('orders.ticketOpened'));
        setTicketSubject(''); setShowTicketInput(false);
      } else console.error(err);
    } catch (ex) { console.error(ex); }
    finally { setTicketLoading(false); }
  };

  const currentStatusIndex = (status: OrderStatus) =>
    ['pending','accepted','preparing','on_the_way','delivered'].indexOf(status);

  // ══════════════════════════════════════════════════════════════
  //  ORDERS LIST VIEW
  // ══════════════════════════════════════════════════════════════
  if (!selectedOrderId) {
    return (
      <div className="space-y-4" id="orders_list_view">
        <h2 className="text-right font-bold" style={{ fontSize: '20px', color: 'white', textTransform: 'none', letterSpacing: 0 }}>
          {t('orders.recentOrders')}
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={36} className="text-[var(--color-primary-fixed)] animate-spin" />
            <p style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{t('orders.loadingOrders')}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-6 text-center animate-fade-in-up">
            <div
              className="w-28 h-28 rounded-3xl flex items-center justify-center glass-shine"
              style={{ background: 'rgba(163,249,91,0.04)', border: '1px solid rgba(163,249,91,0.12)', boxShadow: '0 0 48px rgba(163,249,91,0.06)' }}
            >
              <ScrollText size={48} strokeWidth={1.25} style={{ color: 'rgba(163,249,91,0.28)' }} />
            </div>
            <div>
              <p style={{ fontSize: '20px', color: 'white', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>{t('orders.empty')}</p>
              <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', lineHeight: 1.6 }}>{t('orders.emptyHint')}<br />{t('orders.emptyHint2')}</p>
            </div>
            <button
              onClick={onSelectOrderBack}
              className="px-8 h-13 rounded-2xl font-bold cursor-pointer neon-glow transition-all active:scale-95"
              style={{ background: 'var(--color-primary-fixed)', color: '#0c2000', fontSize: '15px', fontWeight: 700, paddingTop: '12px', paddingBottom: '12px' }}
            >{t('restaurant.orderNow')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((ord) => {
              const cfg = STATUS_CONFIG[ord.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.Icon;
              return (
                <div
                  key={ord.id}
                  onClick={() => { setSelectedOrderId(ord.id); fetchOrderDetails(ord.id); }}
                  className="glass glass-hover flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all"
                  id={`order_card_${ord.id}`}
                  style={{
                    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                    borderLeft: '1px solid rgba(255,255,255,0.12)',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <ChevronLeft size={18} color="var(--color-primary-fixed)" strokeWidth={2} />

                  <div className="flex-1 min-w-0 text-right space-y-1">
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', textTransform: 'none', letterSpacing: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ord.merchant_branches?.merchants?.business_name || t('orders.store')}
                    </h4>
                    <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
                      {ord.created_at ? new Date(ord.created_at).toLocaleString('ar-SA') : ''}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
                      <span style={{ fontSize: '12px', color: cfg.color, textTransform: 'none', letterSpacing: 0 }}>{t(cfg.labelKey)}</span>
                      <StatusIcon size={12} color={cfg.color} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}>
                      {money(ord.total_amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  ORDER TRACKING VIEW
  // ══════════════════════════════════════════════════════════════
  if (detailsLoading || !orderDetails) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 size={36} className="text-[var(--color-primary-fixed)] animate-spin" />
        <p style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{t('orders.updatingOrder')}</p>
      </div>
    );
  }

  // Category-aware workflow (TASK C): pick the flow, compute the reached step from
  // the REAL status so no future stage is ever shown as completed.
  const orderFlow = resolveFlow(orderDetails.merchant_branches?.name);
  const statusCanonIdx = CANON.indexOf(orderDetails.status as OrderStatus);
  let reachedIdx = 0;
  orderFlow.forEach((s, i) => { if (CANON.indexOf(s.key) <= statusCanonIdx) reachedIdx = i; });
  if (statusCanonIdx < 0) reachedIdx = -1; // cancelled / unknown → nothing completed

  const merchantLoc = (orderDetails.branch_lat_snapshot != null && orderDetails.branch_lng_snapshot != null)
    ? { lat: Number(orderDetails.branch_lat_snapshot), lng: Number(orderDetails.branch_lng_snapshot) }
    : null;
  const customerLoc = (orderDetails.delivery_lat != null && orderDetails.delivery_lng != null)
    ? { lat: Number(orderDetails.delivery_lat), lng: Number(orderDetails.delivery_lng) }
    : null;

  const eta = riderLoc && customerLoc
    ? Math.max(0, calculateEtaMinutes(calculateDistanceKm(riderLoc.lat, riderLoc.lng, customerLoc.lat, customerLoc.lng)))
    : Math.max(0, Math.round((1 - courierProgress) * 25));

  return (
    <div id="order_tracking_view" style={{ marginTop: '-24px' }}>

      {/* ════════════════════════════════════════════
          FULL-BLEED MAP SECTION
      ════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{ height: '55vh', marginLeft: '-16px', marginRight: '-16px', background: '#1a1c1e' }}
        id="map_section"
      >
        <img src={MAP_PHOTO} alt="map" className="w-full h-full object-cover" style={{ opacity: 0.4, filter: 'grayscale(100%) contrast(1.25)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, #111417 5%, transparent 40%, transparent 60%, #111417 95%)' }} />

        <div ref={containerRef} className="absolute inset-8" id="canvas_container">
          {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
              <div className="w-full h-full">
                <Map defaultCenter={merchantLoc ?? { lat: 24.7136, lng: 46.6753 }} defaultZoom={13} gestureHandling={'greedy'} disableDefaultUI>
                  {merchantLoc && <Marker position={merchantLoc} title={t('orders.store')} />}
                  {customerLoc && <Marker position={customerLoc} title={t('orders.homeLabel')} />}
                  {riderLoc    && <Marker position={riderLoc}    title={t('orders.driver')} />}
                </Map>
              </div>
            </APIProvider>
          ) : (
            <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="block w-full h-full" id="courier_canvas" />
          )}
        </div>

        {/* Back button */}
        <button
          onClick={() => setSelectedOrderId(null)}
          className="absolute top-4 end-4 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 z-10"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', color: 'var(--color-primary-fixed)' }}
        >
          <ChevronRight size={20} strokeWidth={2} />
        </button>

        {/* Driver live marker */}
        <div
          className="absolute top-1/3 left-1/4 flex flex-col items-center pointer-events-none z-10"
          style={{ transform: `translateX(${courierProgress * 120}px) translateY(${-courierProgress * 60}px)` }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse-glow"
            style={{ background: 'var(--color-primary-fixed)', border: '4px solid #111417', boxShadow: '0 0 20px rgba(163,249,91,0.8)' }}
          >
            <Truck size={20} color="var(--color-on-primary-fixed)" strokeWidth={2} />
          </div>
          <div className="mt-2 px-3 py-1 rounded-full" style={{ background: 'rgba(29,32,35,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}>
              {orderDetails.drivers?.full_name || t('orders.captain')}
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          FLOATING STATUS CARD
      ════════════════════════════════════════════ */}
      <div className="glass glass-shine rounded-2xl p-5 -mt-4 mx-0 relative z-10" style={{ borderInlineStart: '4px solid var(--color-primary-fixed)' }} id="status_card">
        <div className="flex justify-between items-start">
          <div className="text-left">
            <p className="font-bold text-[var(--color-primary-fixed)]" style={{ fontSize: '36px', lineHeight: 1, textTransform: 'none', letterSpacing: 0 }}>{eta}</p>
            <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0, marginTop: '-2px' }}>{t('common.minutes')}</p>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-[var(--color-primary-fixed)]" style={{ fontSize: '18px', textTransform: 'none', letterSpacing: 0 }}>
              {orderDetails.status === 'on_the_way' ? t('orders.driverOnWay') :
               orderDetails.status === 'preparing'  ? t('orders.preparingYourOrder') :
               orderDetails.status === 'delivered'  ? t('orders.deliveredSuccess') :
               t('orders.orderConfirmed')}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px', textTransform: 'none', letterSpacing: 0 }}>
              {t('orders.orderHash')} #{selectedOrderId.slice(-6).toUpperCase()} · {money(orderDetails.total_amount)}
            </p>
          </div>
        </div>
        <div className="mt-4 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${courierProgress * 100}%`, background: 'var(--color-primary-fixed)', boxShadow: '0 0 8px rgba(163,249,91,0.5)' }} />
        </div>
      </div>

      {/* Live tracking map (in-progress orders) */}
      {['accepted', 'preparing', 'on_the_way'].includes(orderDetails.status) && (
        <OrderTrackingMap orderId={selectedOrderId} />
      )}

      {/* Reorder (delivered) */}
      {orderDetails.status === 'delivered' && (
        <button onClick={() => handleReorder(selectedOrderId)} disabled={reordering}
          className="w-full mt-4 h-12 rounded-2xl font-bold cursor-pointer flex items-center justify-center gap-2"
          style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', opacity: reordering ? 0.6 : 1 }} id="reorder_btn">
          {reordering ? <><Loader2 size={16} className="animate-spin" /> {t('orders.reorderLoading')}</> : <><RotateCcw size={16} /> {t('orders.reorder')}</>}
        </button>
      )}

      {/* Multi-target reviews (delivered): rate merchant, driver, products separately */}
      {orderDetails.status === 'delivered' && (
        <MultiTargetReview orderId={selectedOrderId} customerId={customerId} branchId={orderDetails.branch_id} driverId={orderDetails.driver_id} />
      )}

      {/* (legacy single rating card — superseded by MultiTargetReview) */}
      {false && orderDetails.status === 'delivered' && (
        <div className="glass rounded-2xl p-5 mt-4" id="rating_card">
          <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
            {ratingDone ? t('orders.thanksRating') : t('orders.howWasExperience')}
          </h3>
          <div className="flex gap-2" style={{ justifyContent: 'center' }} onMouseLeave={() => setRatingHover(0)}>
            {[1, 2, 3, 4, 5].map(n => {
              const filled = (ratingHover || ratingValue) >= n;
              return (
                <button key={n} id={`rating_star_${n}`} disabled={ratingDone}
                  onMouseEnter={() => !ratingDone && setRatingHover(n)}
                  onClick={() => !ratingDone && setRatingValue(n)}
                  style={{ background: 'none', border: 'none', cursor: ratingDone ? 'default' : 'pointer', padding: '2px' }}>
                  <Star size={32} strokeWidth={1.6}
                    color={filled ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
                    fill={filled ? '#fbbf24' : 'none'} />
                </button>
              );
            })}
          </div>
          {!ratingDone && (
            <>
              <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                placeholder={t('orders.addComment')} rows={2}
                className="w-full mt-4 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '13px', resize: 'none' }} />
              <button id="submit_rating_btn" onClick={submitRating} disabled={ratingValue < 1 || ratingLoading}
                className="w-full mt-3 h-11 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: ratingValue < 1 ? 'rgba(163,249,91,0.25)' : 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '14px', fontWeight: 700, opacity: ratingValue < 1 ? 0.6 : 1 }}>
                {ratingLoading ? <Loader2 size={18} className="animate-spin" /> : t('orders.sendReview')}
              </button>
            </>
          )}
          {ratingDone && ratingComment && (
            <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px', marginTop: '10px', textAlign: 'center' }}>"{ratingComment}"</p>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          BOTTOM SHEET
      ════════════════════════════════════════════ */}
      <div className="glass glass-shine rounded-2xl p-6 mt-4 space-y-6" id="bottom_sheet">

        {/* Driver card */}
        <div className="flex items-center justify-between pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex gap-3">
            <button
              className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-90"
              style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}
              id="call_driver_btn"
            >
              <Phone size={20} strokeWidth={2} />
            </button>
            <button
              className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 glass glass-hover"
              style={{ color: 'var(--color-primary-fixed)' }}
              id="chat_driver_btn"
            >
              <MessageSquare size={20} strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center gap-3 flex-row-reverse">
            <div className="relative">
              <img src={DRIVER_IMG} alt="driver" className="w-16 h-16 object-cover" style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)' }} />
            </div>
            <div className="text-right">
              <p style={{ fontSize: '18px', fontWeight: 700, color: 'white', textTransform: 'none', letterSpacing: 0 }}>
                {orderDetails.drivers?.full_name || t('orders.captain')}
              </p>
              {orderDetails.drivers?.phone_number && (
                <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0, marginTop: '2px' }}>
                  {orderDetails.drivers.phone_number}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Vertical stepper */}
        <div className="space-y-5" id="order_stepper">
          {orderFlow.map((step, idx) => {
            const delivered = orderDetails.status === 'delivered';
            const done    = delivered || idx < reachedIdx;   // completed (or all done when delivered)
            const current = !delivered && idx === reachedIdx; // exactly one current; future never "done"
            return (
              <div key={`${step.labelKey}-${idx}`} className="flex gap-4 relative" id={`step_${idx}`}>
                <div className="flex flex-col items-center">
                  {done && !current ? (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center z-10" style={{ background: 'var(--color-primary-fixed)' }}>
                      <Check size={14} color="var(--color-on-primary-fixed)" strokeWidth={3} />
                    </div>
                  ) : current ? (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center z-10 animate-pulse" style={{ border: '2px solid var(--color-primary-fixed)', background: '#111417' }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary-fixed)' }} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full z-10" style={{ border: '2px solid rgba(65,74,55,0.3)', background: '#111417' }} />
                  )}
                  {idx < orderFlow.length - 1 && (
                    <div className="w-[2px] mt-1" style={{ height: '40px', background: done ? 'var(--color-primary-fixed)' : 'rgba(65,74,55,0.3)' }} />
                  )}
                </div>
                <div className="pt-0.5">
                  <p style={{ fontSize: '14px', fontWeight: done || current ? 600 : 400, color: done ? 'var(--color-primary-fixed)' : current ? 'white' : 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
                    {t(step.labelKey)}
                  </p>
                  {step.key === 'on_the_way' && current && (
                    <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{t('orders.onWayToYou')}</p>
                  )}
                  {step.key === 'delivered' && !done && (
                    <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
                      {t('orders.expectedTime')}{new Date(Date.now() + eta * 60000).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3" id="order_actions">
          {orderDetails.status === 'pending' && (
            <button
              onClick={() => handleCancelOrder(orderDetails.id)}
              className="w-full py-3 rounded-full font-bold cursor-pointer text-center transition-colors"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
              id="cancel_btn"
            >{t('orders.cancelOrderRefund')}</button>
          )}

          <button
            onClick={() => setShowTicketInput(!showTicketInput)}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
            style={{ background: 'rgba(29,32,35,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
            id="support_btn"
          >
            <Headphones size={18} strokeWidth={2} />
            {t('orders.supportCenter')}
          </button>

          {showTicketInput && (
            <form onSubmit={handleOpenTicket} className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(29,32,35,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <textarea
                required
                placeholder={t('orders.complaintPlaceholder')}
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="w-full p-3 rounded-lg resize-none focus:outline-none"
                style={{ background: 'rgba(17,20,23,0.7)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '14px', direction: 'rtl', textTransform: 'none', letterSpacing: 0 }}
                rows={2}
              />
              <button
                type="submit"
                disabled={ticketLoading}
                className="w-full h-11 rounded-lg font-bold cursor-pointer"
                style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
              >
                {ticketLoading ? '...' : t('orders.reportNow')}
              </button>
            </form>
          )}

          {/* Telemetry strip */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl text-center" style={{ background: 'rgba(29,32,35,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: t('orders.storeLocation'),      val: merchantLoc ? `${merchantLoc.lat.toFixed(4)}, ${merchantLoc.lng.toFixed(4)}` : t('orders.notSet') },
              { label: t('orders.homeLocation'),       val: customerLoc ? `${customerLoc.lat.toFixed(4)}, ${customerLoc.lng.toFixed(4)}` : t('orders.notSet') },
              { label: t('orders.driverLocation'),     val: riderLoc ? `${riderLoc.lat.toFixed(4)}, ${riderLoc.lng.toFixed(4)}` : t('orders.waiting'), accent: true },
              { label: t('orders.remainingDistance'), val: riderLoc && customerLoc ? `${calculateDistanceKm(riderLoc.lat, riderLoc.lng, customerLoc.lat, customerLoc.lng).toFixed(2)} ${t('orders.km')}` : '—' },
            ].map(({ label, val, accent }) => (
              <div key={label}>
                <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', display: 'block', textTransform: 'none', letterSpacing: 0 }}>{label}</span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', display: 'block', color: accent ? 'var(--color-primary-fixed)' : 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
