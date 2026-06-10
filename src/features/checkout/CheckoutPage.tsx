import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { checkoutService } from '../../services/checkout.service';
import { orderService } from '../../services/order.service';
import { paymentService } from '../../services/payment.service';

interface CartItem {
  product: { id: string; name: string; price: number; branch_id: string };
  variant: { id: string; name: string; price_modifier: number } | null;
  quantity: number;
}
interface Address    { id: string; address_line: string; label: string; zone_id: string }
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
const PAYMENT_TYPES = [
  { key: 'apple_pay', label: 'Apple Pay', icon: 'apps' },
  { key: 'mada',      label: 'مدى',       icon: 'credit_card' },
  { key: 'visa',      label: 'Visa',       icon: 'payments' },
];

export const CheckoutPage = ({ cartItems, branchId, customerId, onOrderPlaced, onBack }: CheckoutPageProps) => {
  const [addresses,       setAddresses]       = useState<Address[]>([]);
  const [zones,           setZones]           = useState<Zone[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [newAddressText,  setNewAddressText]  = useState('');
  const [selectedZoneId,  setSelectedZoneId]  = useState('');
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [productImages,   setProductImages]   = useState<Record<string, string>>({});

  const [paymentMethods,  setPaymentMethods]  = useState<PaymentMethod[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [selectedPayType, setSelectedPayType] = useState<string>('apple_pay');
  const [isAddingCard,    setIsAddingCard]    = useState(false);
  const [cardNumber,      setCardNumber]      = useState('');
  const [cardHolder,      setCardHolder]      = useState('');

  const [couponCode,      setCouponCode]      = useState('');
  const [couponDiscount,  setCouponDiscount]  = useState(0);
  const [couponError,     setCouponError]     = useState('');
  const [couponSuccess,   setCouponSuccess]   = useState('');

  const [loading,         setLoading]         = useState(false);
  const [actionLoading,   setActionLoading]   = useState(false);

  const deliveryFee  = 10.00;
  const luxuryFee    = 5.00;

  useEffect(() => { fetchCheckoutPreRequisites(); }, [customerId]);

  const fetchCheckoutPreRequisites = async () => {
    try {
      setLoading(true);
      // Zones + Addresses
      const { data: zoneData }    = await supabase.from('zones').select('*');
      if (zoneData) { setZones(zoneData); if (zoneData.length > 0) setSelectedZoneId(zoneData[0].id); }
      const { data: addressData } = await supabase.from('addresses').select('*').eq('customer_id', customerId);
      if (addressData) { setAddresses(addressData); if (addressData.length > 0) setSelectedAddress(addressData[0].id); }
      // Payment methods
      const { data: pmData }      = await checkoutService.getPaymentMethods(customerId);
      if (pmData) {
        setPaymentMethods(pmData);
        if (pmData.length > 0) { const def = pmData.find(p => p.is_default); setSelectedPayment(def ? def.id : pmData[0].id); }
      }
      // Product images for cart items
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
    const { data, error } = await checkoutService.verifyCoupon(couponCode);
    if (error || !data) { setCouponError('الكود غير صالح أو انتهت صلاحيته'); setCouponDiscount(0); }
    else { setCouponSuccess(`خصم ${data.discount_percent}% مُفعّل!`); setCouponDiscount(data.discount_percent); }
  };

  const getSubtotal    = () => cartItems.reduce((t, i) => t + (i.product.price + (i.variant?.price_modifier ?? 0)) * i.quantity, 0);
  const subtotal        = getSubtotal();
  const discountVal     = subtotal * (couponDiscount / 100);
  const grandTotal      = Math.max(0, subtotal - discountVal + deliveryFee + luxuryFee);

  const handlePlaceOrder = async () => {
    if (!selectedAddress) { alert('الرجاء تحديد عنوان التوصيل'); return; }
    if (!selectedPayment)  { alert('الرجاء تحديد طريقة الدفع');   return; }
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
      const { data: orderData, error: orderErr } = await orderService.createOrder(customerId, branchId, grandTotal, resolvedItems);
      if (orderErr) { alert(`خطأ في إنشاء الطلب: ${orderErr.message}`); return; }
      if (orderData) {
        const activePM  = paymentMethods.find(pm => pm.id === selectedPayment);
        const providerName = activePM?.provider?.toLowerCase().includes('mada') ? 'mada'
          : activePM?.provider?.toLowerCase().includes('stripe') ? 'stripe'
          : activePM?.provider?.toLowerCase().includes('apple')  ? 'apple_pay'
          : 'stripe';
        const payRes = await paymentService.processPayment({
          amount: grandTotal, currency: 'SAR', customerId, orderId: orderData.id,
          provider: providerName as any, paymentMethodToken: activePM?.provider_payment_method_id ?? undefined,
        });
        if (!payRes.success) { alert(`فشل الدفع: ${payRes.errorMessage || 'تحقق من بيانات البطاقة'}`); return; }
        onOrderPlaced(orderData.id);
      }
    } catch (err) { console.error(err); alert('حدث خطأ داخلي.'); }
    finally { setActionLoading(false); }
  };

  const selectedAddr = addresses.find(a => a.id === selectedAddress);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <span className="material-symbols-outlined text-[var(--color-primary-fixed)] animate-spin-slow" style={{ fontSize: '36px' }}>refresh</span>
        <p style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>جاري تحضير بيانات الطلب...</p>
      </div>
    );
  }

  return (
    <div id="checkout_page" style={{ marginTop: '-24px' }}>

      {/* ════════════════════════════════════════════
          PROGRESS STEPPER
      ════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2" id="checkout_stepper">
        {/* Close / back button */}
        <button
          onClick={onBack}
          className="flex flex-col items-center gap-2 cursor-pointer"
          style={{ color: 'white', background: 'none', border: 'none' }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>رجوع</span>
        </button>

        {/* Step 1: Cart (active) */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)', border: '1px solid var(--color-primary-fixed)', boxShadow: '0 0 15px rgba(168,255,96,0.2)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>shopping_cart</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}>السلة</span>
        </div>

        {/* Line 1 */}
        <div className="flex-1 h-[2px] mx-2" style={{ background: 'linear-gradient(to left, var(--color-primary-fixed), #323538)' }} />

        {/* Step 2: Payment */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-surface-container-highest)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>payments</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>الدفع</span>
        </div>

        {/* Line 2 */}
        <div className="flex-1 h-[2px] mx-2" style={{ background: 'var(--color-surface-container-highest)' }} />

        {/* Step 3: Confirm */}
        <div className="flex flex-col items-center gap-2 opacity-40">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-surface-container-highest)', color: 'var(--color-on-surface-variant)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>check_circle</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>التأكيد</span>
        </div>
      </div>

      <div className="space-y-6 pb-32 mt-4" id="checkout_content">

        {/* ════════════════════════════════════════════
            CART ITEMS
        ════════════════════════════════════════════ */}
        <section id="cart_items_section">
          <h2 className="flex items-center gap-2 mb-3 text-right" style={{ fontSize: '20px', fontWeight: 600, color: 'white', textTransform: 'none', letterSpacing: 0 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)', fontSize: '20px' }}>restaurant_menu</span>
            محتويات السلة
          </h2>
          <div className="space-y-2" id="cart_item_list">
            {cartItems.map((item, idx) => {
              const itemPrice = item.product.price + (item.variant?.price_modifier ?? 0);
              const imgUrl    = productImages[item.product.id] || (item.product as any).product_images?.[0]?.url;
              return (
                <div key={idx} className="glass flex gap-4 items-center p-4 rounded-xl" id={`checkout_item_${idx}`}>
                  {/* Photo */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    {imgUrl ? (
                      <img src={imgUrl} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-surface-container-highest)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--color-on-surface-variant)', opacity: 0.4 }}>restaurant</span>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 text-right">
                    <div className="flex justify-between items-start">
                      <span style={{ fontSize: '14px', color: 'var(--color-secondary)', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{itemPrice.toFixed(2)} ر.س</span>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'white', textTransform: 'none', letterSpacing: 0 }}>{item.product.name}</h3>
                    </div>
                    {item.variant && (
                      <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0, marginTop: '4px' }}>{item.variant.name}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <span style={{ fontSize: '16px', color: 'white', textTransform: 'none', letterSpacing: 0 }}>{item.quantity}</span>
                      <button
                        className="w-8 h-8 rounded-full flex items-center justify-center cursor-default"
                        style={{ border: '1px solid rgba(163,249,91,0.2)', background: 'rgba(163,249,91,0.1)', color: 'var(--color-secondary)' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                      </button>
                      <button
                        className="w-8 h-8 rounded-full flex items-center justify-center cursor-default"
                        style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-on-surface-variant)' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ════════════════════════════════════════════
            DELIVERY ADDRESS
        ════════════════════════════════════════════ */}
        <section id="delivery_address_section">
          <div className="flex justify-between items-center mb-3">
            <button
              onClick={() => setIsAddingAddress(!isAddingAddress)}
              style={{ color: 'var(--color-secondary)', fontSize: '14px', textTransform: 'none', letterSpacing: 0, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {isAddingAddress ? 'إلغاء' : 'تعديل'}
            </button>
            <h2 className="flex items-center gap-2" style={{ fontSize: '20px', fontWeight: 600, color: 'white', textTransform: 'none', letterSpacing: 0 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)', fontSize: '20px' }}>location_on</span>
              عنوان التوصيل
            </h2>
          </div>

          <div className="glass rounded-xl overflow-hidden" id="address_card">
            {/* Map thumbnail */}
            <div className="relative h-32 w-full">
              <img src={MAP_IMG} alt="map" className="w-full h-full object-cover" style={{ filter: 'grayscale(100%)', opacity: 0.5 }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--color-surface-container), transparent)' }} />
              {selectedAddr && (
                <div className="absolute bottom-3 end-3">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}
                  >{selectedAddr.label}</span>
                </div>
              )}
            </div>

            {/* Address info */}
            <div className="p-4 text-right">
              {selectedAddr ? (
                <>
                  <p style={{ fontSize: '16px', color: 'white', textTransform: 'none', letterSpacing: 0 }}>{selectedAddr.label} - {zones.find(z => z.id === selectedAddr.zone_id)?.name || ''}</p>
                  <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0, marginTop: '4px' }}>{selectedAddr.address_line}</p>
                </>
              ) : (
                <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>لم يتم تحديد عنوان</p>
              )}

              {/* Address selector */}
              {addresses.length > 1 && !isAddingAddress && (
                <select
                  value={selectedAddress}
                  onChange={(e) => setSelectedAddress(e.target.value)}
                  className="w-full mt-3 h-10 px-3 rounded-lg"
                  style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}
                  id="addr_select"
                >
                  {addresses.map(a => <option key={a.id} value={a.id}>{a.label} - {a.address_line}</option>)}
                </select>
              )}
            </div>

            {/* Add address form */}
            {isAddingAddress && (
              <form onSubmit={handleAddNewAddress} className="p-4 pt-0 space-y-3 text-right" id="add_addr_form">
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg"
                  style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                >
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="العنوان التفصيلي"
                  value={newAddressText}
                  onChange={(e) => setNewAddressText(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg"
                  style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                  required
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full h-11 rounded-lg font-bold cursor-pointer"
                  style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                >
                  {actionLoading ? '...' : 'حفظ العنوان'}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* ════════════════════════════════════════════
            PAYMENT METHOD
        ════════════════════════════════════════════ */}
        <section id="payment_section">
          <h2 className="flex items-center gap-2 mb-3 text-right" style={{ fontSize: '20px', fontWeight: 600, color: 'white', textTransform: 'none', letterSpacing: 0 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)', fontSize: '20px' }}>account_balance_wallet</span>
            وسيلة الدفع
          </h2>

          {/* 3-col payment type grid */}
          <div className="grid grid-cols-3 gap-2 mb-3" id="payment_grid">
            {PAYMENT_TYPES.map(pt => {
              const isActive = selectedPayType === pt.key;
              return (
                <button
                  key={pt.key}
                  onClick={() => setSelectedPayType(pt.key)}
                  className="glass flex flex-col items-center gap-2 p-4 rounded-xl relative overflow-hidden cursor-pointer transition-all"
                  style={{
                    border: isActive ? '2px solid var(--color-primary-fixed)' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: isActive ? '0 0 15px rgba(168,255,96,0.15)' : 'none',
                  }}
                  id={`pay_type_${pt.key}`}
                >
                  {isActive && (
                    <span
                      className="absolute top-1 start-1 material-symbols-outlined"
                      style={{ fontSize: '14px', color: 'var(--color-secondary)', fontVariationSettings: "'FILL' 1" }}
                    >check_circle</span>
                  )}
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '24px', color: isActive ? 'var(--color-primary-fixed)' : 'white', fontVariationSettings: pt.key === 'apple_pay' ? "'FILL' 1" : "'FILL' 0" }}
                  >{pt.icon}</span>
                  <span style={{ fontSize: '12px', color: isActive ? 'white' : 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{pt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Saved payment methods for selected type */}
          {paymentMethods.length > 0 && (
            <div className="space-y-2">
              {paymentMethods
                .filter(pm => pm.provider.toLowerCase().includes(selectedPayType === 'apple_pay' ? 'apple' : selectedPayType))
                .map(pm => (
                  <label
                    key={pm.id}
                    onClick={() => setSelectedPayment(pm.id)}
                    className="glass flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all"
                    style={{ border: selectedPayment === pm.id ? '1px solid var(--color-primary-fixed)' : '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <input type="radio" name="payment_method" checked={selectedPayment === pm.id} readOnly style={{ accentColor: 'var(--color-primary-fixed)' }} />
                    <span style={{ fontSize: '14px', color: 'white', textTransform: 'none', letterSpacing: 0 }}>{pm.provider}</span>
                  </label>
                ))}
            </div>
          )}

          {/* Add card toggle */}
          <button
            onClick={() => setIsAddingCard(!isAddingCard)}
            className="flex items-center gap-2 mt-3 cursor-pointer"
            style={{ color: 'var(--color-secondary)', fontSize: '14px', textTransform: 'none', letterSpacing: 0, background: 'none', border: 'none' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{isAddingCard ? 'remove' : 'add'}</span>
            {isAddingCard ? 'إلغاء' : 'إضافة بطاقة جديدة'}
          </button>

          {isAddingCard && (
            <form onSubmit={handleAddNewCard} className="glass rounded-xl p-4 mt-2 space-y-3 text-right" id="add_card_form">
              <input
                type="text"
                placeholder="رقم البطاقة"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\s+/g, ''))}
                maxLength={16}
                className="w-full h-11 px-3 rounded-lg"
                style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                required
              />
              <input
                type="text"
                placeholder="اسم حامل البطاقة"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                className="w-full h-11 px-3 rounded-lg"
                style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                required
              />
              <button
                type="submit"
                disabled={actionLoading}
                className="w-full h-11 rounded-lg font-bold cursor-pointer"
                style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
              >
                {actionLoading ? '...' : 'حفظ البطاقة'}
              </button>
            </form>
          )}
        </section>

        {/* ════════════════════════════════════════════
            ORDER SUMMARY
        ════════════════════════════════════════════ */}
        <section className="glass p-4 rounded-xl space-y-3" id="order_summary_section">
          <SummaryRow label="المجموع الفرعي" value={`${subtotal.toFixed(2)} ر.س`} />
          <SummaryRow label="رسوم التوصيل (مميز)" value={`${deliveryFee.toFixed(2)} ر.س`} />

          {/* Luxury fee row */}
          <div className="flex justify-between items-center p-2 rounded-lg" style={{ background: 'rgba(163,249,91,0.05)', border: '1px solid rgba(163,249,91,0.2)' }}>
            <span style={{ fontSize: '16px', color: 'var(--color-secondary)', textTransform: 'none', letterSpacing: 0 }}>{luxuryFee.toFixed(2)} ر.س</span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '16px', color: 'var(--color-secondary)', textTransform: 'none', letterSpacing: 0 }}>رسوم الرفاهية (أولوية)</span>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-secondary)', fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
          </div>

          {couponDiscount > 0 && (
            <SummaryRow label={`خصم ${couponDiscount}%`} value={`-${discountVal.toFixed(2)} ر.س`} accent />
          )}

          {/* Coupon input */}
          <div className="flex gap-2">
            <button
              onClick={handleVerifyCoupon}
              className="px-4 h-10 rounded-lg font-bold cursor-pointer flex-shrink-0"
              style={{ background: 'var(--color-secondary)', color: '#1e3700', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
            >تطبيق</button>
            <input
              type="text"
              placeholder="كوبون خصم"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="flex-1 h-10 px-3 rounded-lg text-center tracking-widest"
              style={{ background: 'var(--color-surface-container-high)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
            />
          </div>
          {couponError   && <p style={{ color: 'var(--color-error)', fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>{couponError}</p>}
          {couponSuccess && <p style={{ color: 'var(--color-primary-fixed)', fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}>{couponSuccess}</p>}

          {/* Divider + Total */}
          <div className="pt-3 border-t flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-secondary)', textTransform: 'none', letterSpacing: 0 }}>{grandTotal.toFixed(2)} ر.س</span>
            <span style={{ fontSize: '20px', fontWeight: 600, color: 'white', textTransform: 'none', letterSpacing: 0 }}>الإجمالي</span>
          </div>
        </section>

      </div>

      {/* ════════════════════════════════════════════
          FIXED BOTTOM ACTION BAR
      ════════════════════════════════════════════ */}
      <footer
        className="fixed left-0 right-0 z-40 glass rounded-t-2xl flex items-center px-6"
        style={{ bottom: '80px', height: '80px', boxShadow: '0 -4px 24px rgba(136,220,65,0.1)' }}
        id="checkout_footer"
      >
        <button
          onClick={handlePlaceOrder}
          disabled={actionLoading}
          className="w-full h-14 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 neon-glow-checkout relative overflow-hidden group"
          style={{ background: 'var(--color-secondary)', color: '#1e3700', fontSize: '18px', textTransform: 'none', letterSpacing: 0 }}
          id="place_order_btn"
        >
          <span className="relative z-10">{actionLoading ? 'جاري المعالجة...' : `إتمام الطلب (${grandTotal.toFixed(2)} ر.س)`}</span>
          <span className="material-symbols-outlined relative z-10 animate-pulse" style={{ fontVariationSettings: "'FILL' 1", fontSize: '20px' }}>bolt</span>
          {/* Shine */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </button>
      </footer>

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
