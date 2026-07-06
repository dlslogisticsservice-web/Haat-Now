// ─────────────────────────────────────────────────────────────────────────────
// Website commerce UI (Launch Sprint 3, Parts 2–4).
// Menu → Cart → Checkout (guest + customer) → Order success → Live tracking. All state
// runs through the reuse-only controller (features/website/checkout.ts): existing services
// + the pure financial engine. Checkout completes HERE, on the website — the app is never
// required. Theme-token styled, responsive, accessible.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import {
  loadMenu, getWebsiteCart, addToWebsiteCart, setWebsiteCartQty, breakdownFor, applyCoupon,
  placeWebsiteOrder, getTracking, cancelWebsiteOrder, reorderWebsite, requestRefund, contactSupport,
  guestIdentity, TIP_PRESETS, type MenuItem, type WebsiteCartLine, type WebsiteTracking,
} from './checkout';
import { tipOptions } from '../../website-platform/finance/pricing';
import { buildReceipt, renderReceiptHtml } from '../../website-platform/finance/receipt';

type TipMode = { mode: 'percent'; value: number } | null;

const wrap: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' };
const card: React.CSSProperties = { background: 'var(--color-surface-container, #10160f)', border: '1px solid var(--color-outline-variant, #2a3330)', borderRadius: 'var(--card-radius, 16px)', padding: 18 };
const btn = (primary = true): React.CSSProperties => ({ padding: '12px 20px', borderRadius: 'var(--button-radius, 12px)', fontWeight: 800, cursor: 'pointer', border: primary ? 'none' : '1px solid var(--color-outline-variant, #2a3330)', background: primary ? 'var(--color-primary-fixed, #a3f95b)' : 'transparent', color: primary ? 'var(--color-on-primary-fixed, #0c2000)' : 'var(--color-on-surface, #e8ebe3)' });
const input: React.CSSProperties = { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--color-outline-variant, #2a3330)', background: 'var(--color-surface-container-high, #141a17)', color: 'var(--color-on-surface, #e8ebe3)', fontSize: 15, outline: 'none' };
const h2: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: 'var(--color-on-surface, #e8ebe3)', margin: '0 0 14px' };
const muted = 'var(--color-on-surface-variant, #a7b0a6)';

export interface WebsiteCommerceProps {
  path: string;
  search: string;
  brandName: string;
  onNavigate: (to: string) => void;
}

function param(search: string, key: string): string {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(key) || '';
}

export const WebsiteCommerce: React.FC<WebsiteCommerceProps> = ({ path, search, brandName, onNavigate }) => {
  if (path.startsWith('/menu')) return <MenuView search={search} onNavigate={onNavigate} />;
  if (path.startsWith('/cart')) return <CartView onNavigate={onNavigate} />;
  if (path.startsWith('/checkout')) return <CheckoutView brandName={brandName} onNavigate={onNavigate} />;
  if (path.startsWith('/order')) return <OrderView search={search} brandName={brandName} onNavigate={onNavigate} />;
  return null;
};

// ── Menu ──────────────────────────────────────────────────────────────────────────
const MenuView: React.FC<{ search: string; onNavigate: (to: string) => void }> = ({ search, onNavigate }) => {
  const branchId = param(search, 'b') || 'demo-branch-1';
  const merchantId = param(search, 'm') || undefined;
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [cartCount, setCartCount] = useState(() => getWebsiteCart().reduce((s, l) => s + l.quantity, 0));

  useEffect(() => { let a = true; loadMenu(branchId, merchantId).then(m => { if (a) setItems(m); }); return () => { a = false; }; }, [branchId, merchantId]);

  const add = (it: MenuItem) => { addToWebsiteCart(it, 1); setCartCount(getWebsiteCart().reduce((s, l) => s + l.quantity, 0)); };

  return (
    <div style={wrap}>
      <h1 style={{ ...h2, fontSize: 28 }}>Order online</h1>
      {items === null ? <p style={{ color: muted }}>Loading menu…</p>
        : items.length === 0 ? (
          <div style={card}><p style={{ color: muted, margin: 0 }}>This menu is served from the live catalog. Connect a live backend to populate items.</p></div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map(it => (
              <div key={it.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div><p style={{ fontWeight: 700, margin: 0, color: 'var(--color-on-surface, #e8ebe3)' }}>{it.name}</p>{it.category && <p style={{ color: muted, fontSize: 13, margin: '2px 0 0' }}>{it.category}</p>}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 800, color: 'var(--color-primary-fixed, #a3f95b)' }}>SAR {it.price.toFixed(2)}</span>
                  <button id={`add_${it.id}`} onClick={() => add(it)} style={btn()}>Add</button>
                </div>
              </div>
            ))}
          </div>
        )}
      {cartCount > 0 && (
        <div style={{ position: 'sticky', bottom: 16, marginTop: 20 }}>
          <button id="go_cart" onClick={() => onNavigate('/cart')} style={{ ...btn(), width: '100%', height: 52 }}>View cart ({cartCount}) →</button>
        </div>
      )}
    </div>
  );
};

// ── Cart ──────────────────────────────────────────────────────────────────────────
const CartView: React.FC<{ onNavigate: (to: string) => void }> = ({ onNavigate }) => {
  const [lines, setLines] = useState<WebsiteCartLine[]>(() => getWebsiteCart());
  const bd = useMemo(() => breakdownFor(lines), [lines]);
  const setQty = (id: string, q: number) => setLines(setWebsiteCartQty(id, q));

  if (lines.length === 0) return (
    <div style={wrap}><h1 style={h2}>Your cart</h1><div style={card}><p style={{ color: muted, margin: 0 }}>Your cart is empty. <button onClick={() => onNavigate('/menu')} style={{ ...btn(false), padding: '4px 8px' }}>Browse the menu</button></p></div></div>
  );

  return (
    <div style={wrap}>
      <h1 style={h2}>Your cart</h1>
      <div style={{ display: 'grid', gap: 10 }}>
        {lines.map(l => (
          <div key={l.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><p style={{ fontWeight: 700, margin: 0 }}>{l.name}</p><p style={{ color: muted, fontSize: 13, margin: '2px 0 0' }}>SAR {l.price.toFixed(2)}</p></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button aria-label="decrease" onClick={() => setQty(l.id, l.quantity - 1)} style={{ ...btn(false), padding: '6px 12px' }}>−</button>
              <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{l.quantity}</span>
              <button aria-label="increase" onClick={() => setQty(l.id, l.quantity + 1)} style={{ ...btn(false), padding: '6px 12px' }}>+</button>
            </div>
          </div>
        ))}
      </div>
      <BreakdownCard bd={bd} />
      <button id="to_checkout" onClick={() => onNavigate('/checkout')} style={{ ...btn(), width: '100%', height: 52, marginTop: 16 }}>Checkout · SAR {bd.total.toFixed(2)}</button>
    </div>
  );
};

// ── Checkout ────────────────────────────────────────────────────────────────────────
const CheckoutView: React.FC<{ brandName: string; onNavigate: (to: string) => void }> = ({ brandName, onNavigate }) => {
  const [lines] = useState<WebsiteCartLine[]>(() => getWebsiteCart());
  const guest = useMemo(() => guestIdentity(), []);
  const [name, setName] = useState(guest.name === 'Guest' ? '' : guest.name);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponPct, setCouponPct] = useState(0);
  const [couponMsg, setCouponMsg] = useState('');
  const [tipPct, setTipPct] = useState(0);
  const [pay, setPay] = useState<'cash' | 'wallet' | 'card'>('cash');
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState('');

  const tip: TipMode = tipPct > 0 ? { mode: 'percent', value: tipPct } : null;
  const bd = useMemo(() => breakdownFor(lines, { couponPercent: couponPct, tip }), [lines, couponPct, tipPct]);
  const tips = tipOptions(bd.subtotal - bd.discount, TIP_PRESETS);

  if (lines.length === 0) return (
    <div style={wrap}><h1 style={h2}>Checkout</h1><div style={card}><p style={{ color: muted, margin: 0 }}>Your cart is empty.</p></div></div>
  );

  const submitCoupon = async () => {
    const r = await applyCoupon(couponCode);
    setCouponPct(r.ok ? r.discountPercent : 0);
    setCouponMsg(r.ok ? `Applied −${r.discountPercent}%` : (r.message || 'Invalid'));
  };

  const place = async () => {
    setErr('');
    if (!name.trim() || !address.trim()) { setErr('Please enter your name and delivery address.'); return; }
    setPlacing(true);
    const res = await placeWebsiteOrder({
      customerId: guest.id, customerName: name.trim(),
      branchId: lines[0].branchId, branchName: brandName,
      lines, breakdown: bd,
    });
    setPlacing(false);
    if (res.error || !res.data) { setErr(res.error || 'Something went wrong. Please try again.'); return; }
    try { sessionStorage.setItem(`haat_web_receipt_${res.data.orderId}`, JSON.stringify(bd)); } catch { /* ignore */ }
    onNavigate(`/order?id=${encodeURIComponent(res.data.orderId)}`);
  };

  return (
    <div style={wrap}>
      <h1 style={h2}>Checkout</h1>
      <div style={{ display: 'grid', gap: 14 }}>
        <section style={card}>
          <p style={{ fontWeight: 800, margin: '0 0 10px' }}>Contact & delivery</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <input id="co_name" style={input} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} aria-label="Full name" />
            <input id="co_phone" style={input} placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} aria-label="Phone" />
            <input id="co_address" style={input} placeholder="Delivery address" value={address} onChange={e => setAddress(e.target.value)} aria-label="Delivery address" />
          </div>
          <p style={{ color: muted, fontSize: 12, marginTop: 8 }}>Checking out as guest — no app or account required.</p>
        </section>

        <section style={card}>
          <p style={{ fontWeight: 800, margin: '0 0 10px' }}>Coupon</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="co_coupon" style={{ ...input, flex: 1 }} placeholder="Promo code" value={couponCode} onChange={e => setCouponCode(e.target.value)} aria-label="Promo code" />
            <button id="apply_coupon" onClick={submitCoupon} style={btn(false)}>Apply</button>
          </div>
          {couponMsg && <p style={{ color: couponPct > 0 ? 'var(--color-primary-fixed, #a3f95b)' : muted, fontSize: 13, marginTop: 8 }}>{couponMsg}</p>}
        </section>

        <section style={card}>
          <p style={{ fontWeight: 800, margin: '0 0 10px' }}>Tip your captain</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tips.map(t => (
              <button key={t.percent} onClick={() => setTipPct(t.percent)} style={{ ...btn(tipPct === t.percent), padding: '8px 14px' }}>{t.percent === 0 ? 'No tip' : `${t.percent}% · SAR ${t.amount.toFixed(2)}`}</button>
            ))}
          </div>
        </section>

        <section style={card}>
          <p style={{ fontWeight: 800, margin: '0 0 10px' }}>Payment</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {(['cash', 'wallet', 'card'] as const).map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--color-on-surface, #e8ebe3)' }}>
                <input type="radio" name="pay" checked={pay === m} onChange={() => setPay(m)} /> {m === 'cash' ? 'Cash on delivery' : m === 'wallet' ? 'Wallet' : 'Card'}
              </label>
            ))}
          </div>
        </section>

        <BreakdownCard bd={bd} />
        {err && <p role="alert" style={{ color: '#f87171', fontSize: 14 }}>{err}</p>}
        <button id="place_order" disabled={placing} onClick={place} style={{ ...btn(), width: '100%', height: 54, opacity: placing ? 0.6 : 1 }}>
          {placing ? 'Placing order…' : `Place order · SAR ${bd.total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

// ── Order success + live tracking ─────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = { pending: 'Order received', accepted: 'Accepted by store', preparing: 'Preparing your order', on_the_way: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled' };

const OrderView: React.FC<{ search: string; brandName: string; onNavigate: (to: string) => void }> = ({ search, brandName, onNavigate }) => {
  const orderId = param(search, 'id');
  const [t, setT] = useState<WebsiteTracking | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    const load = () => getTracking(orderId).then(r => { if (active) setT(r); });
    load();
    const iv = setInterval(load, 4000);
    return () => { active = false; clearInterval(iv); };
  }, [orderId]);

  const downloadReceipt = () => {
    try {
      const raw = sessionStorage.getItem(`haat_web_receipt_${orderId}`);
      const bd = raw ? JSON.parse(raw) : null;
      if (!bd) { setNote('Receipt unavailable.'); return; }
      const receipt = buildReceipt(bd, { name: brandName }, { orderId, merchantName: brandName });
      const html = renderReceiptHtml(receipt, { name: brandName });
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    } catch { setNote('Receipt unavailable.'); }
  };

  const doCancel = async () => { const r = await cancelWebsiteOrder(orderId); setNote(r.ok ? 'Order cancelled.' : (r.error || 'Cannot cancel.')); };
  const doReorder = async () => { await reorderWebsite(orderId); onNavigate('/cart'); };
  const doRefund = async () => { const r = await requestRefund(orderId, 'Refund requested from website'); setNote(r.ok ? 'Refund request submitted.' : 'Could not submit refund.'); };
  const doSupport = async () => { const r = await contactSupport(`Help with order ${orderId}`, 'Customer requested help from the website', orderId); setNote(r.ok ? 'Support ticket opened.' : 'Could not contact support.'); };

  if (!orderId) return <div style={wrap}><h1 style={h2}>Order</h1><p style={{ color: muted }}>Missing order reference.</p></div>;

  return (
    <div style={wrap}>
      <div id="order_success" style={{ ...card, textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 44 }} aria-hidden="true">✅</div>
        <h1 style={{ ...h2, marginBottom: 4 }}>Order placed</h1>
        <p style={{ color: muted, margin: 0 }}>Order <strong>#{orderId.toUpperCase()}</strong> — thank you!</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <button id="download_receipt" onClick={downloadReceipt} style={btn(false)}>Receipt</button>
          <button onClick={() => onNavigate('/menu')} style={btn(false)}>Order again</button>
        </div>
      </div>

      <section style={card}>
        <p style={{ fontWeight: 800, margin: '0 0 12px' }}>Live tracking</p>
        {!t ? <p style={{ color: muted }}>Loading…</p> : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span id="track_status" style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary-fixed, #a3f95b)' }}>{STATUS_LABEL[t.status] || t.status}</span>
              {t.etaMinutes ? <span style={{ color: muted }}>ETA ~{t.etaMinutes} min</span> : null}
            </div>
            {t.driver && <p style={{ color: muted, marginTop: 6 }}>🛵 {t.driver.name} is handling your delivery.</p>}
            <ol style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 8 }}>
              {t.timeline.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', color: muted, fontSize: 13 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--color-primary-fixed, #a3f95b)' }} />
                  {STATUS_LABEL[s.status] || s.status} · {new Date(s.at).toLocaleTimeString()}
                </li>
              ))}
            </ol>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <button onClick={doCancel} style={btn(false)}>Cancel</button>
          <button onClick={doReorder} style={btn(false)}>Reorder</button>
          <button onClick={doRefund} style={btn(false)}>Request refund</button>
          <button onClick={doSupport} style={btn(false)}>Support</button>
        </div>
        {note && <p role="status" style={{ color: 'var(--color-primary-fixed, #a3f95b)', fontSize: 14, marginTop: 10 }}>{note}</p>}
      </section>
    </div>
  );
};

// ── Shared breakdown card ───────────────────────────────────────────────────────────
const BreakdownCard: React.FC<{ bd: ReturnType<typeof breakdownFor> }> = ({ bd }) => {
  const row = (label: string, value: number, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: strong ? 17 : 14, fontWeight: strong ? 800 : 500, color: strong ? 'var(--color-on-surface, #e8ebe3)' : muted, marginTop: strong ? 8 : 4 }}>
      <span>{label}</span><span style={strong ? { color: 'var(--color-primary-fixed, #a3f95b)' } : undefined}>SAR {value.toFixed(2)}</span>
    </div>
  );
  return (
    <div style={{ ...card, marginTop: 16 }}>
      {row('Subtotal', bd.subtotal)}
      {bd.discount > 0 && row('Discount', -bd.discount)}
      {row('Delivery', bd.deliveryFee)}
      {bd.serviceFee > 0 && row('Service fee', bd.serviceFee)}
      {bd.taxMode !== 'none' && bd.tax > 0 && row(bd.taxMode === 'inclusive' ? 'VAT (incl.)' : 'VAT', bd.tax)}
      {bd.tip > 0 && row('Tip', bd.tip)}
      <div style={{ borderTop: '1px solid var(--color-outline-variant, #2a3330)', marginTop: 10, paddingTop: 4 }}>{row('Total', bd.total, true)}</div>
    </div>
  );
};
