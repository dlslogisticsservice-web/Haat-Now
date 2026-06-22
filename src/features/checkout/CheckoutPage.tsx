import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { checkoutService } from '../../services/checkout.service';
import { orderService } from '../../services/order.service';
import { adminService } from '../../services/admin.service';
import { authService } from '../../services/auth.service';
import { sandboxStore } from '../../services/sandboxStore';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { getCategoryThumb } from '../../utils/categoryImages';

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';
import {
  ChevronLeft, Loader2, Star, UtensilsCrossed, BadgeCheck,
  CheckCircle2, Circle, MapPin, Wallet, Smartphone, CreditCard,
  Banknote, Plus, Minus, Check, ChevronsRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CartItem {
  product: { id: string; name: string; price: number; branch_id: string };
  variant: { id: string; name: string; price_modifier: number } | null;
  quantity: number;
}
interface Address    { id: string; address_line: string; label: string; zone_id: string; is_default?: boolean; latitude?: number | null; longitude?: number | null }
interface Zone       { id: string; name: string }
interface PaymentMethod { id: string; provider: string; is_default: boolean; provider_payment_method_id?: string | null }

interface CheckoutPageProps {
  cartItems: CartItem[];
  branchId: string;
  customerId: string;
  onOrderPlaced: (orderId: string) => void;
  onBack: () => void;
}

const MAP_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBGElXF80FqXsSBy_lETRDhEMvfpJEnisJCKyNYTwOuL6Dda0IlzC8QuXWiBDjX_A9_fRwumQfK_8pTd1TTvXSRpBSGBYnHbo0pm6BH8ETWhgD9TKiQY1dRNsjgnH0y3kE3PFTpUVt5baqvZSyLRR-3TvqOLD6SjfdTdhislXrwngNvVjTrRBlcidWwnOYPB8yYFWulkaOGFn4BfS-qlWbHMgUbJUz6ne0tbIZW6l33nTpSVDYpOHD-sXf9SKaD-PaX5m3USXE6XOEk';
const PAYMENT_TYPES: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'apple_pay', label: 'Apple Pay', Icon: Smartphone },
  { key: 'mada',      label: 'مدى',       Icon: CreditCard },
  { key: 'visa',      label: 'Visa',       Icon: Banknote },
];

export const CheckoutPage = ({ cartItems, branchId, customerId, onOrderPlaced, onBack }: CheckoutPageProps) => {
  const { country, price: money } = useAppConfig();
  const cur = country.currency.symbolAr;
  const [addresses,       setAddresses]       = useState<Address[]>([]);
  const [zones,           setZones]           = useState<Zone[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [newAddressText,  setNewAddressText]  = useState('');
  const [selectedZoneId,  setSelectedZoneId]  = useState('');
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [branchCoords,    setBranchCoords]    = useState<{ latitude: number | null; longitude: number | null } | null>(null);
  const [productImages,   setProductImages]   = useState<Record<string, string>>({});

  const [paymentMethods,  setPaymentMethods]  = useState<PaymentMethod[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [selectedPayType, setSelectedPayType] = useState<string>('apple_pay');
  const [isAddingCard,    setIsAddingCard]    = useState(false);
  const [cardNumber,      setCardNumber]      = useState('');
  const [cardHolder,      setCardHolder]      = useState('');

  const [couponCode,      setCouponCode]      = useState('');
  const [couponId,        setCouponId]        = useState<string | null>(null);
  const [couponDiscount,  setCouponDiscount]  = useState(0);
  const [couponError,     setCouponError]     = useState('');
  const [couponSuccess,   setCouponSuccess]   = useState('');

  const [loading,         setLoading]         = useState(false);
  const [actionLoading,   setActionLoading]   = useState(false);

  // Swipe-to-order state
  const [handleLeft,       setHandleLeft]       = useState(8);
  const [swipeComplete,    setSwipeComplete]    = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);
  const startData    = useRef({ startX: 0, startPos: 8 });

  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'verifying' | 'failed' | 'cancelled'>('idle');
  const [paymentError,  setPaymentError]  = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [deliveryFee, setDeliveryFee] = useState(10.00);
  const luxuryFee    = 5.00;

  // EF2-14: Poll payment-verify every 5s (max 12 attempts).
  // Called after the payment tab is opened. Reads coupon from sessionStorage to
  // preserve the coupon usage insert after webhook confirms — not during redirect.
  const startVerifyPolling = (attemptId: string, orderId: string | null) => {
    let attempts = 0;
    const MAX    = 12;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const stop = () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };

    const poll = async () => {
      attempts++;
      try {
        const accessToken = await authService.getAccessToken();
        const res = await fetch(`${supabaseUrl}/functions/v1/payment-verify`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey':        anonKey,
          },
          body: JSON.stringify({ paymentAttemptId: attemptId }),
        });

        if (!res.ok) return; // Network or 5xx — keep polling

        const data = await res.json() as Record<string, unknown>;

        if (data['orderPaymentStatus'] === 'paid' || data['status'] === 'captured') {
          stop();
          const pendingCoupon = sessionStorage.getItem('haat_pending_coupon_id');
          sessionStorage.removeItem('haat_payment_attempt_id');
          sessionStorage.removeItem('haat_pending_order_id');
          sessionStorage.removeItem('haat_pending_coupon_id');
          // Record coupon usage now that payment is confirmed (moved from handlePlaceOrder)
          if (pendingCoupon && orderId) {
            await supabase.from('coupon_usages').insert({ coupon_id: pendingCoupon, order_id: orderId });
          }
          setCompletedOrderId(orderId ?? '');
          setPaymentStatus('idle');
          setShowSuccessModal(true);
          return;
        }

        if (data['status'] === 'failed' || data['status'] === 'cancelled') {
          stop();
          sessionStorage.removeItem('haat_payment_attempt_id');
          sessionStorage.removeItem('haat_pending_order_id');
          sessionStorage.removeItem('haat_pending_coupon_id');
          setPaymentError('فشلت عملية الدفع أو تم إلغاؤها. حاول مجدداً.');
          setPaymentStatus('failed');
          setSwipeComplete(false);
          setHandleLeft(8);
          return;
        }

        if (attempts >= MAX) {
          stop();
          sessionStorage.removeItem('haat_payment_attempt_id');
          sessionStorage.removeItem('haat_pending_order_id');
          sessionStorage.removeItem('haat_pending_coupon_id');
          setPaymentStatus('idle');
          setPaymentError('جاري معالجة الدفع. سنُخطرك فور التأكيد.');
          if (orderId) onOrderPlaced(orderId);
        }
      } catch (e) {
        console.error('[payment-verify] poll error:', e);
      }
    };

    void poll(); // Immediate first check
    pollingRef.current = setInterval(() => { void poll(); }, 5_000);
  };

  useEffect(() => { fetchCheckoutPreRequisites(); }, [customerId]);

  // EF2-13: Detect return from Moyasar hosted page via URL query params.
  // This fires when the SPA mounts with ?status= in the URL (e.g. callback_url redirect).
  // Primary payment detection is via polling above; this handles direct-URL-return cases.
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const status    = params.get('status');
    const attemptId = sessionStorage.getItem('haat_payment_attempt_id');
    const pendingOrder = sessionStorage.getItem('haat_pending_order_id');

    if (status && attemptId) {
      window.history.replaceState({}, '', window.location.pathname);
      if (status === 'paid' || status === 'authorized') {
        setPaymentStatus('verifying');
        startVerifyPolling(attemptId, pendingOrder);
      } else if (status === 'failed') {
        sessionStorage.removeItem('haat_payment_attempt_id');
        sessionStorage.removeItem('haat_pending_order_id');
        sessionStorage.removeItem('haat_pending_coupon_id');
        setPaymentError('فشلت عملية الدفع. يمكنك المحاولة مجدداً.');
        setPaymentStatus('failed');
      } else {
        sessionStorage.removeItem('haat_payment_attempt_id');
        sessionStorage.removeItem('haat_pending_order_id');
        sessionStorage.removeItem('haat_pending_coupon_id');
        setPaymentError('تم إلغاء عملية الدفع.');
        setPaymentStatus('cancelled');
      }
    }

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const fetchCheckoutPreRequisites = async () => {
    try {
      setLoading(true);
      const { data: zoneData }    = await supabase.from('zones').select('*');
      if (zoneData) { setZones(zoneData); if (zoneData.length > 0) setSelectedZoneId(zoneData[0].id); }
      const { data: addressData } = await supabase.from('addresses').select('*').eq('customer_id', customerId).order('is_default', { ascending: false });
      if (addressData) {
        setAddresses(addressData);
        if (addressData.length > 0) {
          const def = addressData.find((a: Address) => a.is_default);
          setSelectedAddress(def ? def.id : addressData[0].id);
        }
      }
      const { data: pmData }      = await checkoutService.getPaymentMethods(customerId);
      if (pmData) {
        setPaymentMethods(pmData);
        if (pmData.length > 0) { const def = pmData.find(p => p.is_default); setSelectedPayment(def ? def.id : pmData[0].id); }
      }
      const { data: feeConf } = await adminService.getAppConfig('MIN_DELIVERY_FEE');
      if (feeConf) {
        const parsed = parseFloat(feeConf.value);
        if (!isNaN(parsed) && parsed > 0) setDeliveryFee(parsed);
      }

      const { data: branchData } = await supabase
        .from('merchant_branches')
        .select('latitude,longitude')
        .eq('id', branchId)
        .maybeSingle();
      if (branchData) setBranchCoords({ latitude: branchData.latitude ?? null, longitude: branchData.longitude ?? null });

      const ids = cartItems.map(i => i.product.id);
      if (ids.length > 0) {
        const { data: imgData } = await supabase.from('product_images').select('product_id,url').in('product_id', ids);
        if (imgData) {
          const m: Record<string, string> = {};
          imgData.forEach(img => { m[img.product_id] = img.url; });
          setProductImages(m);
        }
      }
    } catch (e) { console.error('checkout prerequisites:', e); }
    finally { setLoading(false); }
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressText || !selectedZoneId) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.from('addresses')
        .insert({ customer_id: customerId, zone_id: selectedZoneId, address_line: newAddressText, label: 'موقع مخصص' })
        .select().single();
      if (error) alert(`خطأ في إضافة العنوان: ${error.message}`);
      else { setAddresses([data, ...addresses]); setSelectedAddress(data.id); setNewAddressText(''); setIsAddingAddress(false); }
    } catch (err) { console.error(err); }
    finally { setActionLoading(false); }
  };

  const handleAddNewCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardHolder) return;
    setActionLoading(true);
    try {
      const pmPayload = {
        customer_id: customerId,
        provider: `${selectedPayType === 'mada' ? 'Mada' : 'Visa'} ${cardNumber.slice(-4)}`,
        provider_payment_method_id: `tok_${Math.random().toString(36).substr(2, 9)}`,
        is_default: paymentMethods.length === 0,
      };
      const { data, error } = await checkoutService.createPaymentMethod(pmPayload);
      if (error) alert(error.message);
      else if (data) { setPaymentMethods([data, ...paymentMethods]); setSelectedPayment(data.id); setCardNumber(''); setCardHolder(''); setIsAddingCard(false); }
    } catch (err) { console.error(err); }
    finally { setActionLoading(false); }
  };

  const handleVerifyCoupon = async () => {
    setCouponError(''); setCouponSuccess('');
    if (!couponCode) return;
    try {
      const { data, error } = await checkoutService.verifyCoupon(couponCode);
      if (error || !data) { setCouponError(error?.message || 'الكود غير صالح أو انتهت صلاحيته'); setCouponDiscount(0); setCouponId(null); }
      else { setCouponSuccess(`خصم ${data.discount_percent}% مُفعّل!`); setCouponDiscount(data.discount_percent); setCouponId(data.id); }
    } catch (e) { console.error(e); setCouponError('حدث خطأ أثناء التحقق من الكوبون'); }
  };

  const getSubtotal = () => cartItems.reduce((t, i) => t + (i.product.price + (i.variant?.price_modifier ?? 0)) * i.quantity, 0);
  const subtotal    = getSubtotal();
  const discountVal = subtotal * (couponDiscount / 100);
  const grandTotal  = Math.max(0, subtotal - discountVal + deliveryFee + luxuryFee);

  const handlePlaceOrder = async () => {
    if (actionLoading || showSuccessModal) return; // TASK D: block duplicate submissions
    // Sandbox: write to the shared sandbox backend so the full lifecycle works
    // across customer/merchant/driver/admin without a real Supabase session.
    if (SANDBOX) {
      const order = sandboxStore.createOrder({
        customer_id: customerId,
        customer_name: 'عميل تجريبي',
        branch_id: branchId,
        branch_name: '',
        total_amount: grandTotal,
        delivery_fee: deliveryFee,
        items: cartItems.map(it => ({ name: it.product.name, qty: it.quantity, price: it.product.price + (it.variant?.price_modifier ?? 0) })),
      });
      setCompletedOrderId(order.id);
      setShowSuccessModal(true);
      return;
    }
    if (addresses.length === 0) { alert('لا يوجد عنوان توصيل. يُرجى إضافة عنوان من صفحة حسابك الشخصي.'); return; }
    if (!selectedAddress) { alert('الرجاء تحديد عنوان التوصيل'); return; }
    if (!selectedPayment)  { alert('الرجاء تحديد طريقة الدفع');   return; }
    // Open the payment tab synchronously (before any async ops) — required by iOS Safari.
    // Browsers allow window.open only in a direct user-gesture stack; async calls get blocked.
    const paymentTabRef = window.open('about:blank', '_moyasar_payment');
    setActionLoading(true);
    try {
      const resolvedItems = [];
      for (const item of cartItems) {
        let variantId = item.variant?.id;
        if (!variantId) {
          const { data: variants } = await supabase.from('product_variants').select('id').eq('product_id', item.product.id).limit(1);
          if (variants && variants.length > 0) variantId = variants[0].id;
          else {
            const { data: newV } = await supabase.from('product_variants').insert({ product_id: item.product.id, name: 'الافتراضي', price_modifier: 0.00 }).select().single();
            if (newV) variantId = newV.id;
          }
        }
        resolvedItems.push({ variantId: variantId || '', quantity: item.quantity, price: item.product.price + (item.variant?.price_modifier ?? 0) });
      }
      const selectedAddrObj = addresses.find(a => a.id === selectedAddress);
      const { data: orderData, error: orderErr } = await orderService.createOrder(
        customerId, branchId, grandTotal, resolvedItems,
        {
          addressId:         selectedAddress || null,
          deliveryLat:       selectedAddrObj?.latitude  ?? null,
          deliveryLng:       selectedAddrObj?.longitude ?? null,
          branchLatSnapshot: branchCoords?.latitude     ?? null,
          branchLngSnapshot: branchCoords?.longitude    ?? null,
          deliveryFee:       deliveryFee,
        },
      );
      if (orderErr) { paymentTabRef?.close(); alert(`خطأ في إنشاء الطلب: ${orderErr.message}`); setSwipeComplete(false); setHandleLeft(8); return; }
      if (orderData) {
        // EF2-11: Call payment-initiate Edge Function with the customer JWT
        const accessToken = await authService.getAccessToken();
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

        const initiateRes = await fetch(`${supabaseUrl}/functions/v1/payment-initiate`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey':        anonKey,
          },
          body: JSON.stringify({ orderId: orderData.id, customerId, amount: grandTotal, currency: country.currency.code }),
        });

        const initiateData = await initiateRes.json() as Record<string, unknown>;

        if (!initiateRes.ok || !initiateData['success']) {
          paymentTabRef?.close();
          const errMsg = (initiateData['error'] as Record<string, unknown> | undefined)?.['message']
            ?? (initiateData['message'] as string | undefined)
            ?? 'حاول مجدداً';
          alert(`فشل في بدء عملية الدفع: ${errMsg}`);
          setSwipeComplete(false); setHandleLeft(8);
          return;
        }

        // EF2-12: Validate paymentUrl before redirecting
        const gateway    = initiateData['gateway'] as Record<string, unknown> | undefined;
        const paymentUrl = gateway?.['paymentUrl'] as string | null ?? null;

        if (!paymentUrl) {
          paymentTabRef?.close();
          alert('لم يتم الحصول على رابط الدفع. حاول مجدداً.');
          setSwipeComplete(false); setHandleLeft(8);
          return;
        }

        // Save to sessionStorage — persists through the new-tab redirect and polling
        sessionStorage.setItem('haat_payment_attempt_id', initiateData['paymentAttemptId'] as string);
        sessionStorage.setItem('haat_pending_order_id', orderData.id);
        if (couponId) sessionStorage.setItem('haat_pending_coupon_id', couponId);
        // Coupon usage insert now happens inside startVerifyPolling after webhook confirms

        // EF2-12: Navigate the pre-opened tab to Moyasar hosted payment page
        if (paymentTabRef) {
          paymentTabRef.location.href = paymentUrl;
        } else {
          window.open(paymentUrl, '_blank');
        }

        // EF2-14: Start 5s polling (max 12 attempts / 60s timeout)
        setPaymentStatus('verifying');
        startVerifyPolling(initiateData['paymentAttemptId'] as string, orderData.id);
      }
    } catch (err) { paymentTabRef?.close(); console.error(err); alert('حدث خطأ داخلي.'); setSwipeComplete(false); setHandleLeft(8); }
    finally { setActionLoading(false); }
  };

  // Swipe handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeComplete || actionLoading) return;
    isDragging.current = true;
    startData.current  = { startX: e.clientX, startPos: handleLeft };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !containerRef.current) return;
    const max    = containerRef.current.offsetWidth - 56;
    const delta  = e.clientX - startData.current.startX;
    const newPos = Math.max(8, Math.min(max, startData.current.startPos + delta));
    setHandleLeft(newPos);
    if (max > 0 && newPos / max > 0.95) {
      isDragging.current = false;
      setHandleLeft(max);
      setSwipeComplete(true);
      handlePlaceOrder();
    }
  };

  const handlePointerUp = () => {
    if (!isDragging.current || swipeComplete) return;
    isDragging.current = false;
    setHandleLeft(8);
  };

  const selectedAddr = addresses.find(a => a.id === selectedAddress);
  const heroImgUrl   = cartItems[0]
    ? (productImages[cartItems[0].product.id] || (cartItems[0].product as any).product_images?.[0]?.url || getCategoryThumb(cartItems[0].product.name))
    : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 size={36} strokeWidth={2} className="text-[var(--color-primary-fixed)] animate-spin" />
        <p style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>جاري تحضير بيانات الطلب...</p>
      </div>
    );
  }

  return (
    <div id="checkout_page" style={{ marginTop: '-24px', minHeight: '100vh', background: '#111417' }}>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div
        className="sticky z-40 flex items-center justify-between px-4 h-16"
        style={{ top: '36px', background: 'rgba(17,20,23,0.8)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
          style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <ChevronLeft size={20} strokeWidth={2} color="white" />
        </button>

        <span
          className="font-bold"
          style={{ color: 'var(--color-primary-fixed)', textShadow: '0 0 8px rgba(163,249,91,0.3)', textTransform: 'none', letterSpacing: 0 }}
        >
          HAAT NOW
        </span>

        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(163,249,91,0.1)', border: '1px solid rgba(163,249,91,0.2)' }}
        >
          <Star size={14} strokeWidth={0} fill="var(--color-primary-fixed)" color="var(--color-primary-fixed)" />
          <span style={{ color: 'var(--color-primary-fixed)', fontSize: '12px', fontWeight: 700 }}>2,450</span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6" style={{ paddingBottom: 'calc(170px + env(safe-area-inset-bottom, 0px))' }}>

        {/* ── Order context header ──────────────────────────── */}
        <div className="flex items-center gap-4 mb-6" dir="rtl">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(163,249,91,0.1)', border: '1px solid rgba(163,249,91,0.2)' }}
          >
            <UtensilsCrossed size={24} strokeWidth={1.75} color="var(--color-primary-fixed)" />
          </div>
          <div className="flex-1">
            <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
              {cartItems[0]?.product.name || 'طلبك المميز'}
              {cartItems.length > 1 && (
                <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', fontWeight: 400, marginRight: '8px' }}>
                  +{cartItems.length - 1} أصناف
                </span>
              )}
            </h1>
            <p style={{ color: 'var(--color-secondary)', fontSize: '26px', fontWeight: 700, direction: 'ltr', marginTop: '2px' }}>
              {grandTotal.toFixed(2)}{' '}
              <span style={{ fontSize: '14px', fontWeight: 400 }}>{cur}</span>
            </p>
          </div>
        </div>

        {/* ── 12-col grid ──────────────────────────────────── */}
        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr' }}>
          <div className="md:col-span-7 space-y-4" style={{ gridColumn: 'span 1' }}>
            <div className="grid gap-5" id="checkout_grid"
                 style={{ gridTemplateColumns: 'repeat(1, 1fr)' }}>

              {/* Left column + Right column rendered as rows on mobile, grid on md */}
              <style>{`
                @media (min-width: 768px) {
                  #checkout_grid { grid-template-columns: 7fr 5fr !important; }
                }
              `}</style>

              {/* ── LEFT PANEL ─────────────────────────────── */}
              <div className="space-y-4">

                {/* Food hero */}
                <div className="surface-z3 rounded-xl overflow-hidden relative group" style={{ aspectRatio: '16/9' }}>
                  {heroImgUrl ? (
                    <img
                      src={heroImgUrl}
                      alt={cartItems[0]?.product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-surface-container)' }}>
                      <UtensilsCrossed size={64} strokeWidth={1.5} color="var(--color-on-surface-variant)" style={{ opacity: 0.3 }} />
                    </div>
                  )}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,20,23,0.85) 0%, transparent 55%)' }} />
                  <div
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(163,249,91,0.15)', border: '1px solid rgba(163,249,91,0.3)', backdropFilter: 'blur(10px)' }}
                  >
                    <BadgeCheck size={14} strokeWidth={2} color="var(--color-primary-fixed)" />
                    <span style={{ color: 'var(--color-primary-fixed)', fontSize: '11px', fontWeight: 700 }}>Premium Ingredient</span>
                  </div>
                  <div className="absolute bottom-3 right-3 left-3 flex flex-col gap-1" dir="rtl">
                    {cartItems.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: 'var(--color-primary-fixed)' }} />
                        <span style={{ color: 'white', fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>
                          {item.product.name} ×{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preparation progress */}
                <div className="surface-z3 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4" dir="rtl">
                    <h3 style={{ color: 'white', fontSize: '14px', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>مراحل التحضير</h3>
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>قيد التنفيذ</span>
                      <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--color-primary-fixed)' }} />
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full mb-5" style={{ background: 'var(--color-surface-container-highest)' }}>
                    <div
                      className="h-full rounded-full animate-pulse-glow"
                      style={{ width: '75%', background: 'linear-gradient(to right, var(--color-secondary-container), var(--color-secondary))', boxShadow: '0 0 10px rgba(163,249,91,0.5)' }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center" dir="rtl">
                    {['التوريد', 'التحضير', 'الطهي', 'التغليف'].map((step, idx) => (
                      <div key={step} className="flex flex-col items-center gap-1">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{
                            background: idx < 3 ? 'rgba(163,249,91,0.2)' : 'var(--color-surface-container-highest)',
                            border:     idx < 3 ? '1px solid rgba(163,249,91,0.4)' : '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          {idx < 3
                            ? <CheckCircle2 size={14} strokeWidth={2} color="var(--color-primary-fixed)" />
                            : <Circle size={14} strokeWidth={2} color="var(--color-on-surface-variant)" />
                          }
                        </div>
                        <span style={{ color: idx < 3 ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)', fontSize: '10px', textTransform: 'none', letterSpacing: 0 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery address */}
                <div className="surface-z3 rounded-xl overflow-hidden" id="address_card">
                  <div className="flex items-center justify-between px-4 pt-4 pb-2" dir="rtl">
                    <h3 className="flex items-center gap-2 font-bold" style={{ color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}>
                      عنوان التوصيل
                      <MapPin size={18} strokeWidth={2} color="var(--color-primary-fixed)" />
                    </h3>
                    <button
                      onClick={() => setIsAddingAddress(!isAddingAddress)}
                      style={{ color: 'var(--color-secondary)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textTransform: 'none', letterSpacing: 0 }}
                    >
                      {isAddingAddress ? 'إلغاء' : 'تعديل'}
                    </button>
                  </div>
                  <div className="relative h-28 w-full">
                    <img src={MAP_IMG} alt="map" className="w-full h-full object-cover" style={{ filter: 'grayscale(100%)', opacity: 0.4 }} />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(29,32,35,0.9), transparent)' }} />
                  </div>
                  <div className="p-4 text-right">
                    {selectedAddr ? (
                      <>
                        <p style={{ color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}>
                          {selectedAddr.label} — {zones.find(z => z.id === selectedAddr.zone_id)?.name}
                        </p>
                        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', marginTop: '2px', textTransform: 'none', letterSpacing: 0 }}>
                          {selectedAddr.address_line}
                        </p>
                      </>
                    ) : (
                      <div className="py-2 flex flex-col items-end gap-2">
                        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}>
                          لم يتم تحديد عنوان توصيل
                        </p>
                        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px', opacity: 0.65, textTransform: 'none', letterSpacing: 0 }}>
                          أضف عنوانك من صفحة الحساب الشخصي ثم عد للطلب
                        </p>
                      </div>
                    )}
                    {addresses.length > 1 && !isAddingAddress && (
                      <select
                        value={selectedAddress}
                        onChange={e => setSelectedAddress(e.target.value)}
                        className="w-full mt-3 h-10 px-3 rounded-lg"
                        style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}
                        id="addr_select"
                      >
                        {addresses.map(a => <option key={a.id} value={a.id}>{a.label} — {a.address_line}</option>)}
                      </select>
                    )}
                    {isAddingAddress && (
                      <form onSubmit={handleAddNewAddress} className="mt-3 space-y-3" id="add_addr_form">
                        <select
                          value={selectedZoneId}
                          onChange={e => setSelectedZoneId(e.target.value)}
                          className="w-full h-11 px-3 rounded-lg"
                          style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}
                        >
                          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </select>
                        <input
                          type="text"
                          placeholder="العنوان التفصيلي"
                          value={newAddressText}
                          onChange={e => setNewAddressText(e.target.value)}
                          className="w-full h-11 px-3 rounded-lg"
                          style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}
                          required
                        />
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="w-full h-11 rounded-lg font-bold cursor-pointer"
                          style={{ background: 'var(--color-primary-fixed)', color: '#1e3700', fontSize: '14px', textTransform: 'none', letterSpacing: 0, border: 'none' }}
                        >
                          {actionLoading ? '...' : 'حفظ العنوان'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>

              {/* ── RIGHT PANEL ────────────────────────────── */}
              <div className="space-y-4">

                {/* Delivery path SVG */}
                <div className="surface-z3 rounded-xl p-4 relative" style={{ aspectRatio: '1 / 1' }}>
                  <div className="flex items-center justify-between mb-3" dir="rtl">
                    <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px', textTransform: 'none', letterSpacing: 0 }}>التوصيل المتوقع: ~30 دقيقة</span>
                    <h3 style={{ color: 'white', fontSize: '14px', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>مسار التوصيل</h3>
                  </div>
                  <svg viewBox="0 0 400 400" className="w-full" style={{ maxHeight: '240px' }}>
                    <defs>
                      <linearGradient id="pathGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%"   stopColor="#A3F95B" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#A3F95B" stopOpacity="0.2" />
                      </linearGradient>
                    </defs>
                    <path d="M50,350 Q100,200 200,200 T350,50" fill="none" stroke="#323538" strokeLinecap="round" strokeWidth="4" />
                    <path className="order-path-dash" d="M50,350 Q100,200 200,200 T350,50" fill="none" stroke="url(#pathGradient)" strokeLinecap="round" strokeWidth="4" />
                    <circle cx="50"  cy="350" fill="#1D2023" r="6"  stroke="#A8FF60" strokeWidth="2" />
                    <circle cx="350" cy="50"  fill="#A8FF60" r="8"  className="animate-pulse" />
                  </svg>
                  {/* Floating info card */}
                  <div
                    className="absolute top-12 left-4 surface-z3 p-2 rounded-lg"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}>السرعة</span>
                    <span style={{ color: 'var(--color-secondary)', fontSize: '12px', fontWeight: 700 }}>42 km/h</span>
                  </div>
                </div>

                {/* Payment method */}
                <div className="surface-z3 rounded-xl p-4" id="payment_section">
                  <h3 className="flex items-center justify-between mb-4" dir="rtl">
                    <Wallet size={18} strokeWidth={1.75} color="var(--color-primary-fixed)" />
                    <span className="font-bold" style={{ color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}>وسيلة الدفع</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-2 mb-3" id="payment_grid">
                    {PAYMENT_TYPES.map(pt => {
                      const isActive = selectedPayType === pt.key;
                      return (
                        <button
                          key={pt.key}
                          onClick={() => setSelectedPayType(pt.key)}
                          className="glass flex flex-col items-center gap-1.5 p-3 rounded-xl relative overflow-hidden cursor-pointer transition-all"
                          style={{ border: isActive ? '2px solid var(--color-primary-fixed)' : '1px solid rgba(255,255,255,0.1)', boxShadow: isActive ? '0 0 15px rgba(163,249,91,0.15)' : 'none' }}
                          id={`pay_type_${pt.key}`}
                        >
                          {isActive && (
                            <CheckCircle2 size={12} strokeWidth={2} className="absolute top-1 right-1" color="var(--color-primary-fixed)" />
                          )}
                          <pt.Icon size={20} strokeWidth={1.75} color={isActive ? 'var(--color-primary-fixed)' : 'white'} />
                          <span style={{ fontSize: '11px', color: isActive ? 'white' : 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{pt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {paymentMethods.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {paymentMethods
                        .filter(pm => pm.provider.toLowerCase().includes(selectedPayType === 'apple_pay' ? 'apple' : selectedPayType))
                        .map(pm => (
                          <label
                            key={pm.id}
                            onClick={() => setSelectedPayment(pm.id)}
                            className="glass flex items-center justify-between p-3 rounded-xl cursor-pointer"
                            style={{ border: selectedPayment === pm.id ? '1px solid var(--color-primary-fixed)' : '1px solid rgba(255,255,255,0.08)' }}
                          >
                            <input type="radio" name="payment_method" checked={selectedPayment === pm.id} readOnly style={{ accentColor: 'var(--color-primary-fixed)' }} />
                            <span style={{ fontSize: '13px', color: 'white', textTransform: 'none', letterSpacing: 0 }}>{pm.provider}</span>
                          </label>
                        ))}
                    </div>
                  )}
                  <button
                    onClick={() => setIsAddingCard(!isAddingCard)}
                    className="flex items-center gap-1.5 cursor-pointer"
                    style={{ color: 'var(--color-secondary)', fontSize: '13px', background: 'none', border: 'none', textTransform: 'none', letterSpacing: 0 }}
                  >
                    {isAddingCard ? <Minus size={16} strokeWidth={2} /> : <Plus size={16} strokeWidth={2} />}
                    {isAddingCard ? 'إلغاء' : 'إضافة بطاقة'}
                  </button>
                  {isAddingCard && (
                    <form onSubmit={handleAddNewCard} className="glass rounded-xl p-4 mt-2 space-y-3 text-right" id="add_card_form">
                      <input
                        type="text" placeholder="رقم البطاقة" value={cardNumber}
                        onChange={e => setCardNumber(e.target.value.replace(/\s+/g, ''))} maxLength={16}
                        className="w-full h-11 px-3 rounded-lg" required
                        style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}
                      />
                      <input
                        type="text" placeholder="اسم حامل البطاقة" value={cardHolder}
                        onChange={e => setCardHolder(e.target.value)}
                        className="w-full h-11 px-3 rounded-lg" required
                        style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}
                      />
                      <button
                        type="submit" disabled={actionLoading}
                        className="w-full h-11 rounded-lg font-bold cursor-pointer"
                        style={{ background: 'var(--color-primary-fixed)', color: '#1e3700', fontSize: '13px', textTransform: 'none', letterSpacing: 0, border: 'none' }}
                      >
                        {actionLoading ? '...' : 'حفظ البطاقة'}
                      </button>
                    </form>
                  )}
                </div>

                {/* Checkout Summary */}
                <div
                  className="surface-z3 rounded-xl p-5 space-y-3"
                  style={{ borderTop: '2px solid rgba(163,249,91,0.2)' }}
                  id="order_summary_section"
                >
                  <h3 style={{ color: 'var(--color-primary-fixed)', fontWeight: 600, fontSize: '15px', textAlign: 'right', textTransform: 'none', letterSpacing: 0 }}>
                    ملخص الطلب
                  </h3>
                  <div className="space-y-2" style={{ direction: 'rtl' }}>
                    {cartItems.map((item, idx) => {
                      const ip = item.product.price + (item.variant?.price_modifier ?? 0);
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <span style={{ color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}>{money(ip * item.quantity)}</span>
                          <span style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{item.product.name} ×{item.quantity}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between text-sm" style={{ direction: 'rtl' }}>
                      <span style={{ color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}>{money(deliveryFee)}</span>
                      <span style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>رسوم التوصيل</span>
                    </div>
                    <div className="flex justify-between text-sm" style={{ direction: 'rtl' }}>
                      <span style={{ color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}>{money(luxuryFee)}</span>
                      <span className="flex items-center gap-1.5" style={{ color: 'var(--color-secondary)', textTransform: 'none', letterSpacing: 0 }}>
                        رسوم الرفاهية
                        <BadgeCheck size={14} strokeWidth={2} color="var(--color-primary-fixed)" />
                      </span>
                    </div>
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-sm" style={{ direction: 'rtl' }}>
                        <span style={{ color: 'var(--color-error)', textTransform: 'none', letterSpacing: 0 }}>-{money(discountVal)}</span>
                        <span style={{ color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}>خصم {couponDiscount}%</span>
                      </div>
                    )}
                  </div>
                  {/* Coupon */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleVerifyCoupon}
                      className="px-3 h-9 rounded-lg font-bold cursor-pointer flex-shrink-0"
                      style={{ background: 'var(--color-secondary)', color: '#1e3700', fontSize: '13px', textTransform: 'none', letterSpacing: 0, border: 'none' }}
                    >تطبيق</button>
                    <input
                      type="text" placeholder="كوبون خصم"
                      value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      className="flex-1 h-9 px-3 rounded-lg text-center tracking-widest"
                      style={{ background: 'var(--color-surface-container-high)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}
                    />
                  </div>
                  {couponError   && <p style={{ color: 'var(--color-error)', fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>{couponError}</p>}
                  {couponSuccess && <p style={{ color: 'var(--color-primary-fixed)', fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>{couponSuccess}</p>}
                  <div className="h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="flex justify-between items-center font-bold" style={{ direction: 'rtl' }}>
                    <span style={{ color: 'var(--color-secondary)', fontSize: '22px', textTransform: 'none', letterSpacing: 0 }}>{money(grandTotal)}</span>
                    <span style={{ color: 'white', fontSize: '15px', textTransform: 'none', letterSpacing: 0 }}>الإجمالي</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

      </main>

      {/* ── Swipe to Order ───────────────────────────────── */}
      <div className="fixed left-0 right-0 px-4 z-40" style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }} id="checkout-area">
        <div className="max-w-md mx-auto relative group">
          <div
            className="absolute -inset-1 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-1000 pointer-events-none"
            style={{ background: 'linear-gradient(to right, rgba(163,249,91,0.2), rgba(163,249,91,0.1))' }}
          />
          <div
            ref={containerRef}
            className="relative surface-z3 rounded-full p-2 h-16 flex items-center overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <div className="absolute inset-2 rounded-full overflow-hidden pointer-events-none">
              <div className="swipe-shimmer h-full w-full opacity-20" />
            </div>
            <div
              className="flex-1 text-center select-none"
              style={{
                color: 'var(--color-on-surface-variant)',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                paddingRight: swipeComplete ? 0 : '64px',
                opacity: swipeComplete ? 0.5 : 1,
                transition: 'opacity 0.3s',
              }}
            >
              {swipeComplete
                ? (actionLoading
                    ? 'جاري المعالجة...'
                    : paymentStatus === 'verifying'
                      ? 'جاري التحقق من الدفع...'
                      : paymentStatus === 'failed' || paymentStatus === 'cancelled'
                        ? 'فشل الدفع — حاول مجدداً'
                        : 'تم التأكيد!')
                : 'اسحب لتأكيد الطلب'}
            </div>
            <div
              id="checkout_swipe_handle"
              className="absolute w-12 h-12 rounded-full flex items-center justify-center z-10 cursor-grab active:cursor-grabbing"
              style={{
                left: `${handleLeft}px`,
                background: 'var(--color-secondary)',
                boxShadow: '0 0 15px rgba(163,249,91,0.5)',
                transition: isDragging.current ? 'none' : 'left 0.3s ease-out',
                touchAction: 'none',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {swipeComplete
                ? <Check size={22} strokeWidth={2.5} color="#1e3700" />
                : <ChevronsRight size={22} strokeWidth={2.5} color="#1e3700" />
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment error toast ──────────────────────────── */}
      {paymentError && (paymentStatus === 'failed' || paymentStatus === 'cancelled') && (
        <div className="fixed left-4 right-4 z-50" style={{ bottom: '168px' }}>
          <div
            className="max-w-md mx-auto rounded-xl px-4 py-3 text-center"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', backdropFilter: 'blur(12px)' }}
            dir="rtl"
          >
            <p style={{ color: '#fca5a5', fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}>{paymentError}</p>
          </div>
        </div>
      )}

      {/* ── Success Modal ─────────────────────────────────── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(17,20,23,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }} />
          <div
            className="relative surface-z3 rounded-2xl p-8 max-w-sm w-full text-center"
            style={{ border: '2px solid rgba(163,249,91,0.3)' }}
            id="modal-content"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(163,249,91,0.2)' }}
            >
              <CheckCircle2 size={48} strokeWidth={1.5} color="var(--color-primary-fixed)" />
            </div>
            <h2 className="font-bold mb-2" style={{ color: 'var(--color-primary-fixed)', fontSize: '28px', textTransform: 'none', letterSpacing: 0 }}>
              تم تأكيد الطلب
            </h2>
            <p className="mb-6" style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', textTransform: 'none', letterSpacing: 0, lineHeight: 1.6 }}>
              طلبك قيد التحضير. سنُخطرك فور مغادرة الكابتن.
            </p>
            <button
              onClick={() => { setShowSuccessModal(false); if (completedOrderId) onOrderPlaced(completedOrderId); }}
              className="w-full py-4 rounded-xl font-bold cursor-pointer hover:scale-105 active:scale-95 transition-all"
              style={{ background: 'var(--color-secondary)', color: '#1e3700', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.15em', boxShadow: '0 0 20px rgba(163,249,91,0.3)', border: 'none' }}
            >
              تتبع الطلب
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span style={{ fontSize: '16px', color: accent ? 'var(--color-primary-fixed)' : 'white', textTransform: 'none', letterSpacing: 0 }}>{value}</span>
      <span style={{ fontSize: '16px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{label}</span>
    </div>
  );
}
