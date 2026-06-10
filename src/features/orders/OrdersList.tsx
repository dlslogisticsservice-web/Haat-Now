import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { orderService } from '../../services/order.service';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

interface Order {
  id: string;
  status: 'pending' | 'accepted' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  total_amount: number;
  created_at: string;
  branch_id: string;
  driver_id: string | null;
  merchant_branches: { name: string; merchants: { business_name: string } };
}
interface OrdersListProps {
  customerId: string;
  onSelectOrderBack: () => void;
  selectedOrderIdInit?: string;
}

type OrderStatus = Order['status'];

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: string }> = {
  pending:    { label: 'انتظار الموافقة', color: '#fbbf24', icon: 'hourglass_empty' },
  accepted:   { label: 'مقبول',          color: '#a3f95b', icon: 'check_circle' },
  preparing:  { label: 'يُحضَّر الآن',   color: '#a3f95b', icon: 'restaurant' },
  on_the_way: { label: 'في الطريق',      color: '#a3f95b', icon: 'delivery_dining' },
  delivered:  { label: 'تم التوصيل',     color: '#4ade80', icon: 'task_alt' },
  cancelled:  { label: 'ملغي',           color: '#f87171', icon: 'cancel' },
};

const STATUS_STEPS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: 'pending',    label: 'تم تأكيد الطلب',      icon: 'check_circle' },
  { key: 'accepted',   label: 'يتم تحضير الطلب',     icon: 'restaurant' },
  { key: 'on_the_way', label: 'السائق استلم الطلب',  icon: 'delivery_dining' },
  { key: 'delivered',  label: 'تم التوصيل',           icon: 'home' },
];

const DRIVER_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuC1zBa4W1bsQKFL7K9DnwdSTzFmQqeZCe0dPpllnu1UKIjsvIUBFMajud9PVEzLDjwVaRt1fsUDKqC_ecnOLe2pKDJw7tr_WKPwHFcmmk59UZ6G8windy_z7tEr68RKqkSon3LgNenYQOHwvM6K1Pb6WX7RdMytcQSwGRywB4Tdd0OrZsrvOEk-UG85I1sTAHY4z25zOlm1gF-Uw7T0Chdryvfr9SYF-uVlEjeoI99MiVEMbWMg5cQTMfdAI0QIn2y05gcfkQDZUute';
const MAP_PHOTO  = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhSGJvJ91keV3KcXiIFnKS0YhWuSrKZCW_iybvURGhGZZjmD01O8E66Pe-IZIknLpa1xr6rbN2yXLRNgJxyafvetf_ne8GPITiRjaEB3eMmekg6LFLSIp7fCqL1UW6MdveMsESOAgzLCSewmAvdCa6ZcR2yV-xM3RgvJhMyp7xR8KkkI6rHP2Gwk06kTavSB_EMMkiSUASFeHhISs-kxGA0bnA0FDYSnYjfPRV2wUiXfRUZo6cnRgsN2WzM-VRNUcn1-Tdm0fqmccQ';

export const OrdersList = ({ customerId, onSelectOrderBack, selectedOrderIdInit }: OrdersListProps) => {
  const [orders,          setOrders]          = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(selectedOrderIdInit || null);
  const [orderDetails,    setOrderDetails]    = useState<any | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [detailsLoading,  setDetailsLoading]  = useState(false);
  const [courierProgress, setCourierProgress] = useState(0.4);
  const [simSpeed,        setSimSpeed]        = useState(1);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions,      setDimensions]      = useState({ width: 400, height: 220 });
  const [ticketSubject,   setTicketSubject]   = useState('');
  const [showTicketInput, setShowTicketInput] = useState(false);
  const [ticketLoading,   setTicketLoading]   = useState(false);

  const merchantLoc = { lat: 24.7136, lng: 46.6753 };
  const customerLoc = { lat: 24.7584, lng: 46.7020 };
  const riderLoc = {
    lat: merchantLoc.lat + (customerLoc.lat - merchantLoc.lat) * courierProgress,
    lng: merchantLoc.lng + (customerLoc.lng - merchantLoc.lng) * courierProgress,
  };

  useEffect(() => {
    fetchOrders();
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
    ctx.fillText('المتجر', storeX-14, storeY+20);
    ctx.fillText('البيت',  destX-10,  destY-14);
  }, [dimensions, courierProgress]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (orderDetails?.status === 'on_the_way') {
      interval = setInterval(() => setCourierProgress((prev) => prev >= 1.0 ? 1.0 : prev + 0.02 * simSpeed), 2000);
    }
    return () => clearInterval(interval);
  }, [orderDetails, simSpeed]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await orderService.getCustomerOrders(customerId);
      if (!error && data) setOrders(data as unknown as Order[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchOrderDetails = async (orderId: string) => {
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
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟')) return;
    const { success, error } = await orderService.cancelOrder(orderId, 'إلغاء سريع من المستخدم');
    if (success) { alert('تم إلغاء الطلب وتحويل المبلغ للمحفظة'); fetchOrders(); fetchOrderDetails(orderId); }
    else alert(`لا يمكن إلغاء الطلب: ${(error as any)?.message || error}`);
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
        alert('تم فتح تذكرة دعم! سنرد عليك خلال دقائق.');
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
          طلباتي الأخيرة
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span className="material-symbols-outlined text-[var(--color-primary-fixed)] animate-spin-slow" style={{ fontSize: '36px' }}>refresh</span>
            <p style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>جاري جلب الطلبات...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <span className="material-symbols-outlined" style={{ fontSize: '64px', color: 'var(--color-on-surface-variant)', opacity: 0.2 }}>receipt_long</span>
            <p style={{ fontSize: '18px', color: 'white', textTransform: 'none', letterSpacing: 0 }}>لا توجد طلبات</p>
            <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>لم تقم بإجراء أي طلبات بعد!</p>
            <button
              onClick={onSelectOrderBack}
              className="mt-2 px-6 h-12 rounded-full font-bold cursor-pointer neon-glow"
              style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '16px', textTransform: 'none', letterSpacing: 0 }}
            >اطلب الآن</button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((ord) => {
              const cfg = STATUS_CONFIG[ord.status] || STATUS_CONFIG.pending;
              return (
                <div
                  key={ord.id}
                  onClick={() => { setSelectedOrderId(ord.id); fetchOrderDetails(ord.id); }}
                  className="glass glass-hover flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all"
                  id={`order_card_${ord.id}`}
                >
                  {/* Arrow */}
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary-fixed)' }}>chevron_left</span>

                  {/* Meta */}
                  <div className="flex-1 min-w-0 text-right space-y-1">
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', textTransform: 'none', letterSpacing: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ord.merchant_branches?.merchants?.business_name || 'المتجر'}
                    </h4>
                    <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
                      {ord.created_at ? new Date(ord.created_at).toLocaleString('ar-SA') : ''}
                    </p>
                  </div>

                  {/* Status + amount */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
                      <span style={{ fontSize: '12px', color: cfg.color, textTransform: 'none', letterSpacing: 0 }}>{cfg.label}</span>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '12px', color: cfg.color, fontVariationSettings: "'FILL' 1" }}
                      >{cfg.icon}</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}>
                      {ord.total_amount.toFixed(2)} ر.س
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
        <span className="material-symbols-outlined text-[var(--color-primary-fixed)] animate-spin-slow" style={{ fontSize: '36px' }}>refresh</span>
        <p style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>جاري تحديث بيانات الطلب...</p>
      </div>
    );
  }

  const stepIndex = currentStatusIndex(orderDetails.status as OrderStatus);
  const eta = Math.max(0, Math.round((1 - courierProgress) * 25));

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
        {/* Map background photo */}
        <img
          src={MAP_PHOTO}
          alt="map"
          className="w-full h-full object-cover"
          style={{ opacity: 0.4, filter: 'grayscale(100%) contrast(1.25)' }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #111417 5%, transparent 40%, transparent 60%, #111417 95%)' }}
        />

        {/* Canvas map (overlaid) */}
        <div
          ref={containerRef}
          className="absolute inset-8"
          id="canvas_container"
        >
          {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
              <div className="w-full h-full">
                <Map defaultCenter={merchantLoc} defaultZoom={13} gestureHandling={'greedy'} disableDefaultUI>
                  <Marker position={merchantLoc} title="المتجر" />
                  <Marker position={customerLoc} title="المنزل" />
                  <Marker position={riderLoc}    title="السائق" />
                </Map>
              </div>
            </APIProvider>
          ) : (
            <canvas
              ref={canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              className="block w-full h-full"
              id="courier_canvas"
            />
          )}
        </div>

        {/* Back button (top-right in RTL) */}
        <button
          onClick={() => setSelectedOrderId(null)}
          className="absolute top-4 end-4 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 z-10"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', color: 'var(--color-primary-fixed)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
        </button>

        {/* Driver live marker */}
        <div
          className="absolute top-1/3 left-1/4 flex flex-col items-center pointer-events-none z-10"
          style={{ transform: `translateX(${courierProgress * 120}px) translateY(${-courierProgress * 60}px)` }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center animate-bounce"
            style={{
              background: 'var(--color-primary-fixed)',
              border: '4px solid #111417',
              boxShadow: '0 0 20px rgba(163,249,91,0.8)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '20px', color: 'var(--color-on-primary-fixed)', fontVariationSettings: "'FILL' 1" }}
            >local_shipping</span>
          </div>
          <div
            className="mt-2 px-3 py-1 rounded-full"
            style={{ background: 'rgba(29,32,35,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}>
              {orderDetails.drivers?.full_name || 'الكابتن'}
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          FLOATING STATUS CARD (just below map)
      ════════════════════════════════════════════ */}
      <div
        className="glass-panel rounded-xl p-5 -mt-4 mx-0 relative z-10"
        style={{ borderInlineStart: '4px solid var(--color-primary-fixed)' }}
        id="status_card"
      >
        <div className="flex justify-between items-start">
          <div className="text-left">
            <p
              className="font-bold text-[var(--color-primary-fixed)]"
              style={{ fontSize: '36px', lineHeight: 1, textTransform: 'none', letterSpacing: 0 }}
            >{eta}</p>
            <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0, marginTop: '-2px' }}>دقيقة</p>
          </div>
          <div className="text-right">
            <h2
              className="font-bold text-[var(--color-primary-fixed)]"
              style={{ fontSize: '18px', textTransform: 'none', letterSpacing: 0 }}
            >
              {orderDetails.status === 'on_the_way' ? 'السائق في الطريق إليك' :
               orderDetails.status === 'preparing'  ? 'يتم تحضير طلبك' :
               orderDetails.status === 'delivered'  ? 'تم التوصيل بنجاح 🎉' :
               'تم تأكيد طلبك'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: '4px', textTransform: 'none', letterSpacing: 0 }}>
              طلب #{selectedOrderId.slice(-6).toUpperCase()} · {orderDetails.total_amount.toFixed(2)} ر.س
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${courierProgress * 100}%`,
              background: 'var(--color-primary-fixed)',
              boxShadow: '0 0 8px rgba(163,249,91,0.5)',
            }}
          />
        </div>
        {/* Speed sim when on the way */}
        {orderDetails.status === 'on_the_way' && (
          <select
            value={simSpeed}
            onChange={(e) => setSimSpeed(Number(e.target.value))}
            className="mt-3 h-8 px-2 rounded-lg text-xs"
            style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-primary-fixed)', border: '1px solid rgba(255,255,255,0.08)', textTransform: 'none', letterSpacing: 0 }}
          >
            <option value="1">1x</option>
            <option value="3">3x</option>
            <option value="5">5x ⚡</option>
          </select>
        )}
      </div>

      {/* ════════════════════════════════════════════
          BOTTOM SHEET — Driver + Stepper + Actions
      ════════════════════════════════════════════ */}
      <div
        className="glass-panel rounded-2xl p-6 mt-4 space-y-6"
        id="bottom_sheet"
      >
        {/* Driver card */}
        <div className="flex items-center justify-between pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex gap-3">
            {/* Call + Chat buttons */}
            <button
              className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-90"
              style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}
              id="call_driver_btn"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>call</span>
            </button>
            <button
              className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 glass-panel"
              style={{ color: 'var(--color-primary-fixed)' }}
              id="chat_driver_btn"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chat</span>
            </button>
          </div>

          <div className="flex items-center gap-3 flex-row-reverse">
            {/* Driver photo */}
            <div className="relative">
              <img
                src={DRIVER_IMG}
                alt="driver"
                className="w-16 h-16 object-cover"
                style={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)' }}
              />
              <div
                className="absolute -bottom-2 -start-2 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold"
                style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '10px', textTransform: 'none', letterSpacing: 0 }}
              >
                4.9
                <span className="material-symbols-outlined" style={{ fontSize: '10px', fontVariationSettings: "'FILL' 1" }}>star</span>
              </div>
            </div>
            {/* Driver info */}
            <div className="text-right">
              <p style={{ fontSize: '18px', fontWeight: 700, color: 'white', textTransform: 'none', letterSpacing: 0 }}>
                {orderDetails.drivers?.full_name || 'كابتن محمد'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0, marginTop: '2px' }}>
                تويوتا كامري • بيضاء
              </p>
            </div>
          </div>
        </div>

        {/* Vertical stepper */}
        <div className="space-y-5" id="order_stepper">
          {STATUS_STEPS.map((step, idx) => {
            const done    = stepIndex >= idx;
            const current = stepIndex === idx;
            return (
              <div key={step.key} className="flex gap-4 relative" id={`step_${step.key}`}>
                <div className="flex flex-col items-center">
                  {done && !current ? (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center z-10"
                      style={{ background: 'var(--color-primary-fixed)' }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '14px', color: 'var(--color-on-primary-fixed)', fontVariationSettings: "'FILL' 1" }}
                      >check</span>
                    </div>
                  ) : current ? (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center z-10 animate-pulse"
                      style={{ border: '2px solid var(--color-primary-fixed)', background: '#111417' }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary-fixed)' }} />
                    </div>
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full z-10"
                      style={{ border: '2px solid rgba(65,74,55,0.3)', background: '#111417' }}
                    />
                  )}
                  {idx < STATUS_STEPS.length - 1 && (
                    <div
                      className="w-[2px] mt-1"
                      style={{ height: '40px', background: done ? 'var(--color-primary-fixed)' : 'rgba(65,74,55,0.3)' }}
                    />
                  )}
                </div>
                <div className="pt-0.5">
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: done || current ? 600 : 400,
                      color: done ? 'var(--color-primary-fixed)' : current ? 'white' : 'var(--color-on-surface-variant)',
                      textTransform: 'none',
                      letterSpacing: 0,
                    }}
                  >{step.label}</p>
                  {step.key === 'on_the_way' && done && (
                    <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
                      في الطريق إليك
                    </p>
                  )}
                  {step.key === 'delivered' && !done && (
                    <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
                      الوقت المتوقع: {new Date(Date.now() + eta * 60000).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
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
            >
              إلغاء الطلب (استرجاع المحفظة)
            </button>
          )}

          <button
            onClick={() => setShowTicketInput(!showTicketInput)}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
            style={{ background: 'var(--color-surface-container-high)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
            id="support_btn"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>support_agent</span>
            مركز الدعم
          </button>

          {showTicketInput && (
            <form onSubmit={handleOpenTicket} className="space-y-3 p-4 rounded-xl" style={{ background: 'var(--color-surface-container-high)' }}>
              <textarea
                required
                placeholder="مثال: تأخر التسليم، أو الطلب غير مكتمل..."
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="w-full p-3 rounded-lg resize-none focus:outline-none"
                style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '14px', direction: 'rtl', textTransform: 'none', letterSpacing: 0 }}
                rows={2}
              />
              <button
                type="submit"
                disabled={ticketLoading}
                className="w-full h-11 rounded-lg font-bold cursor-pointer"
                style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
              >
                {ticketLoading ? '...' : 'سجل بلاغ فوري'}
              </button>
            </form>
          )}

          {/* Telemetry strip */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl text-center" style={{ background: 'var(--color-surface-container-high)' }}>
            {[
              { label: 'موقع المتجر',      val: `${merchantLoc.lat.toFixed(4)}, ${merchantLoc.lng.toFixed(4)}` },
              { label: 'موقع المنزل',       val: `${customerLoc.lat.toFixed(4)}, ${customerLoc.lng.toFixed(4)}` },
              { label: 'موقع المندوب',     val: `${riderLoc.lat.toFixed(4)}, ${riderLoc.lng.toFixed(4)}`, accent: true },
              { label: 'المسافة المتبقية', val: `${((1 - courierProgress) * 4.2).toFixed(2)} كم` },
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
