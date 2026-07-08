// ─────────────────────────────────────────────────────────────────────────────
// Website commerce UI — Visual Excellence v2 (Menu → Cart → Checkout → Tracking).
// All state runs through the reuse-only controller (features/website/checkout.ts):
// existing services + the pure financial engine. Checkout completes HERE on the
// website — the app is never required. This file transforms only the visual layer;
// the controller, IDs and financial logic are unchanged. Theme-token styled, a11y.
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

const T = {
  primary: 'var(--color-primary-fixed, #a3f95b)', onPrimary: 'var(--color-on-primary-fixed, #0c2000)',
  accent: 'var(--color-tertiary-fixed, #6ee7ff)', surf: 'var(--color-surface-container, #10160f)',
  surfHigh: 'var(--color-surface-container-high, #141a17)', on: 'var(--color-on-surface, #e8ebe3)',
  onVar: 'var(--color-on-surface-variant, #a7b0a6)', line: 'var(--color-outline-variant, #2a3330)',
  cardR: 'var(--card-radius, 20px)', btnR: 'var(--button-radius, 14px)',
};
const hairline = `1px solid color-mix(in srgb, ${T.line} 82%, transparent)`;
const softShadow = '0 1px 2px rgba(0,0,0,.2), 0 12px 32px -12px rgba(0,0,0,.45)';

const wrap: React.CSSProperties = { maxWidth: 820, margin: '0 auto', padding: '28px 20px 96px' };
const card: React.CSSProperties = { background: T.surf, border: hairline, borderRadius: T.cardR, padding: 20, boxShadow: softShadow };
const btn = (primary = true): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 22px', borderRadius: T.btnR, fontWeight: 800, cursor: 'pointer', border: primary ? 'none' : hairline, background: primary ? T.primary : 'transparent', color: primary ? T.onPrimary : T.on, boxShadow: primary ? `0 8px 24px -10px color-mix(in srgb, ${T.primary} 75%, transparent)` : 'none' });
const input: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: 12, border: hairline, background: T.surfHigh, color: T.on, fontSize: 15, outline: 'none' };
const h2: React.CSSProperties = { fontSize: 'clamp(24px,4vw,30px)', fontWeight: 900, letterSpacing: '-0.02em', color: T.on, margin: '0 0 16px' };
const muted = T.onVar;

function menuTile(seed: string): string {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 58% 44%), hsl(${(h + 40) % 360} 62% 30%))`;
}
function menuEmoji(category?: string, name?: string): string {
  const s = `${category || ''} ${name || ''}`.toLowerCase();
  if (/عصير|مشروب|juice|drink|coffee|قهو|شاي|tea/.test(s)) return '🥤';
  if (/دجاج|مندي|chicken|كبسة|rice|أرز/.test(s)) return '🍛';
  if (/برجر|burger/.test(s)) return '🍔';
  if (/بيتزا|pizza/.test(s)) return '🍕';
  if (/حلو|sweet|dessert|كيك|cake/.test(s)) return '🍰';
  if (/دواء|صيدل|pharma|medic/.test(s)) return '💊';
  if (/خضار|بقال|grocer|market/.test(s)) return '🛒';
  return '🍽️';
}

export interface WebsiteCommerceProps { path: string; search: string; brandName: string; onNavigate: (to: string) => void }

function param(search: string, key: string): string {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(key) || '';
}

/** Commerce-scoped motion + micro-interaction styles (reduced-motion safe). Injected once. */
const CommerceStyles: React.FC = () => (
  <style>{`
    .wc-btn { transition: transform .12s ease, filter .18s ease, box-shadow .2s ease, background .18s ease; }
    .wc-btn:hover { transform: translateY(-2px); filter: brightness(1.03); }
    .wc-btn:active { transform: translateY(0) scale(.98); }
    .wc-row { transition: border-color .2s ease, transform .2s ease; }
    .wc-row:hover { border-color: color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 34%, var(--color-outline-variant,#2a3330)); }
    .wc-field:focus-within { border-color: color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 55%, transparent) !important; box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 13%, transparent); }
    .wc-chip { transition: background .18s ease, color .18s ease, border-color .18s ease; }
    .wc-pop { animation: wc-pop .35s cubic-bezier(.22,1,.36,1) both; }
    @keyframes wc-pop { from { opacity: 0; transform: scale(.9) translateY(8px); } to { opacity: 1; transform: none; } }
    .wc-pulse { animation: wc-pulse 1.8s ease-in-out infinite; }
    @keyframes wc-pulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 55%, transparent); } 50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 0%, transparent); } }
    .wc-sticky { animation: wc-rise .3s cubic-bezier(.22,1,.36,1) both; }
    @keyframes wc-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .wc-btn, .wc-row, .wc-chip, .wc-pop, .wc-pulse, .wc-sticky { animation: none !important; transition: none !important; } }
  `}</style>
);

export const WebsiteCommerce: React.FC<WebsiteCommerceProps> = ({ path, search, brandName, onNavigate }) => {
  let view: React.ReactNode = null;
  if (path.startsWith('/menu')) view = <MenuView search={search} brandName={brandName} onNavigate={onNavigate} />;
  else if (path.startsWith('/cart')) view = <CartView onNavigate={onNavigate} />;
  else if (path.startsWith('/checkout')) view = <CheckoutView brandName={brandName} onNavigate={onNavigate} />;
  else if (path.startsWith('/order')) view = <OrderView search={search} brandName={brandName} onNavigate={onNavigate} />;
  if (!view) return null;
  return <><CommerceStyles />{view}</>;
};

// Compact stepper control reused across menu + cart.
const Stepper: React.FC<{ qty: number; onDec: () => void; onInc: () => void; small?: boolean }> = ({ qty, onDec, onInc, small }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 999, background: T.surfHigh, border: hairline }}>
    <button className="wc-btn" aria-label="decrease" onClick={onDec} style={{ width: small ? 30 : 34, height: small ? 30 : 34, borderRadius: 999, border: 'none', cursor: 'pointer', background: 'transparent', color: T.on, fontSize: 18, lineHeight: 1 }}>−</button>
    <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800, color: T.on, fontSize: 15 }}>{qty}</span>
    <button className="wc-btn" aria-label="increase" onClick={onInc} style={{ width: small ? 30 : 34, height: small ? 30 : 34, borderRadius: 999, border: 'none', cursor: 'pointer', background: T.primary, color: T.onPrimary, fontSize: 18, lineHeight: 1, fontWeight: 800 }}>+</button>
  </div>
);

// ── Menu (restaurant details) ────────────────────────────────────────────────────
const MenuView: React.FC<{ search: string; brandName: string; onNavigate: (to: string) => void }> = ({ search, brandName, onNavigate }) => {
  const branchId = param(search, 'b') || 'demo-branch-1';
  const merchantId = param(search, 'm') || undefined;
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [lines, setLines] = useState<WebsiteCartLine[]>(() => getWebsiteCart());

  useEffect(() => { let a = true; loadMenu(branchId, merchantId).then(m => { if (a) setItems(m); }); return () => { a = false; }; }, [branchId, merchantId]);

  const qtyOf = (id: string) => lines.find(l => l.id === id)?.quantity || 0;
  const add = (it: MenuItem) => { addToWebsiteCart(it, 1); setLines(getWebsiteCart()); };
  const setQty = (id: string, q: number) => setLines(setWebsiteCartQty(id, q));
  const cartCount = lines.reduce((s, l) => s + l.quantity, 0);
  const cartTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);

  // Group menu items by category for a premium sectioned menu.
  const groups = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    (items || []).forEach(it => { const k = it.category || 'Menu'; if (!map.has(k)) map.set(k, []); map.get(k)!.push(it); });
    return Array.from(map.entries());
  }, [items]);

  return (
    <div>
      {/* Restaurant header band */}
      <div style={{ position: 'relative', overflow: 'hidden', borderBottom: hairline, background: `linear-gradient(135deg, color-mix(in srgb, ${T.primary} 14%, ${T.surfHigh}), ${T.surf})` }}>
        <div style={{ ...wrap, paddingTop: 28, paddingBottom: 26 }}>
          <button onClick={() => onNavigate('/restaurants')} className="wc-btn" style={{ ...btn(false), padding: '7px 14px', fontSize: 13 }}>← All restaurants</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18 }}>
            <span aria-hidden="true" style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 20, display: 'grid', placeItems: 'center', fontSize: 36, background: menuTile(brandName || 'HaaT'), boxShadow: softShadow }}>🍽️</span>
            <div>
              <h1 style={{ ...h2, margin: 0, fontSize: 'clamp(24px,4vw,32px)' }}>{brandName || 'Order online'}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {['⭐ New store', '🕒 25–35 min', '🛵 Delivery available', '💵 Cash on delivery'].map(x => (
                  <span key={x} className="wc-chip" style={{ padding: '5px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: T.surf, border: hairline, color: T.onVar }}>{x}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...wrap, paddingTop: 24 }}>
        {items === null ? (
          <div style={{ display: 'grid', gap: 10 }}>{Array.from({ length: 5 }).map((_v, i) => <div key={i} style={{ ...card, height: 84, opacity: 0.5 }} />)}</div>
        ) : items.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 44 }} aria-hidden="true">🍽️</div>
            <p style={{ fontWeight: 800, fontSize: 18, color: T.on, margin: '10px 0 6px' }}>Menu coming soon</p>
            <p style={{ color: muted, margin: 0 }}>This store's live menu will appear here at launch.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 32 }}>
            {groups.map(([cat, its]) => (
              <section key={cat}>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: T.on, margin: '0 0 14px', letterSpacing: '-0.01em' }}>{cat}</h2>
                <div style={{ display: 'grid', gap: 12 }}>
                  {its.map((it, i) => {
                    const q = qtyOf(it.id);
                    return (
                      <div key={it.id} className="wc-row" style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, padding: 14 }}>
                        <span aria-hidden="true" style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: 30, background: menuTile(it.name) }}>{menuEmoji(it.category, it.name)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <p style={{ fontWeight: 800, margin: 0, fontSize: 16, color: T.on }}>{it.name}</p>
                            {i === 0 && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, padding: '2px 8px', borderRadius: 999, background: `color-mix(in srgb, ${T.primary} 18%, transparent)`, color: T.primary }}>POPULAR</span>}
                          </div>
                          <p style={{ color: muted, fontSize: 13.5, margin: '6px 0 0' }}>Freshly prepared to order.</p>
                          <span style={{ fontWeight: 800, color: T.primary, fontSize: 15, marginTop: 8, display: 'inline-block' }}>SAR {it.price.toFixed(2)}</span>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {q > 0
                            ? <Stepper qty={q} onDec={() => setQty(it.id, q - 1)} onInc={() => setQty(it.id, q + 1)} small />
                            : <button id={`add_${it.id}`} onClick={() => add(it)} className="wc-btn" style={{ ...btn(), padding: '10px 20px' }}>Add</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {cartCount > 0 && (
        <div className="wc-sticky" style={{ position: 'sticky', bottom: 16, zIndex: 20, maxWidth: 820, margin: '0 auto', padding: '0 20px' }}>
          <button id="go_cart" onClick={() => onNavigate('/cart')} className="wc-btn" style={{ ...btn(), width: '100%', height: 58, fontSize: 16, justifyContent: 'space-between', paddingInline: 24, boxShadow: `0 16px 40px -12px color-mix(in srgb, ${T.primary} 70%, transparent)` }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span style={{ display: 'grid', placeItems: 'center', minWidth: 26, height: 26, borderRadius: 999, background: T.onPrimary, color: T.primary, fontSize: 13 }}>{cartCount}</span>View cart</span>
            <span>SAR {cartTotal.toFixed(2)} →</span>
          </button>
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
    <div style={wrap}>
      <h1 style={h2}>Your cart</h1>
      <div style={{ ...card, textAlign: 'center', padding: 44 }}>
        <div style={{ fontSize: 48 }} aria-hidden="true">🛒</div>
        <p style={{ fontWeight: 800, fontSize: 18, color: T.on, margin: '12px 0 4px' }}>Your cart is empty</p>
        <p style={{ color: muted, margin: '0 0 20px' }}>Add a few items to get started.</p>
        <button onClick={() => onNavigate('/menu')} className="wc-btn" style={btn()}>Browse the menu</button>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <h1 style={h2}>Your cart</h1>
      <div style={{ display: 'grid', gap: 12 }}>
        {lines.map(l => (
          <div key={l.id} className="wc-row" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <span aria-hidden="true" style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 26, background: menuTile(l.name) }}>{menuEmoji(undefined, l.name)}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 800, margin: 0, color: T.on, fontSize: 15.5 }}>{l.name}</p>
                <p style={{ color: muted, fontSize: 13.5, margin: '3px 0 0' }}>SAR {l.price.toFixed(2)} · <strong style={{ color: T.on }}>SAR {(l.price * l.quantity).toFixed(2)}</strong></p>
              </div>
            </div>
            <Stepper qty={l.quantity} onDec={() => setQty(l.id, l.quantity - 1)} onInc={() => setQty(l.id, l.quantity + 1)} />
          </div>
        ))}
      </div>
      <button onClick={() => onNavigate('/menu')} className="wc-btn" style={{ ...btn(false), marginTop: 14, padding: '9px 16px', fontSize: 14 }}>+ Add more items</button>
      <BreakdownCard bd={bd} />
      <button id="to_checkout" onClick={() => onNavigate('/checkout')} className="wc-btn" style={{ ...btn(), width: '100%', height: 56, marginTop: 16, fontSize: 16, justifyContent: 'space-between', paddingInline: 24 }}>
        <span>Go to checkout</span><span>SAR {bd.total.toFixed(2)} →</span>
      </button>
    </div>
  );
};

// Checkout progress indicator.
const Steps: React.FC<{ active: number }> = ({ active }) => {
  const steps = ['Cart', 'Details', 'Confirm'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 999, fontSize: 13, fontWeight: 800, background: i <= active ? T.primary : T.surfHigh, color: i <= active ? T.onPrimary : T.onVar, border: i <= active ? 'none' : hairline }}>{i < active ? '✓' : i + 1}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: i <= active ? T.on : T.onVar }}>{s}</span>
          </div>
          {i < steps.length - 1 && <span style={{ flex: 1, height: 2, borderRadius: 2, background: i < active ? T.primary : T.line }} />}
        </React.Fragment>
      ))}
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
  const [pay, setPay] = useState<'cod' | 'wallet' | 'card'>('cod');
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState('');

  const tip: TipMode = tipPct > 0 ? { mode: 'percent', value: tipPct } : null;
  const bd = useMemo(() => breakdownFor(lines, { couponPercent: couponPct, tip }), [lines, couponPct, tipPct]);
  const tips = tipOptions(bd.subtotal - bd.discount, TIP_PRESETS);

  if (lines.length === 0) return (
    <div style={wrap}><h1 style={h2}>Checkout</h1><div style={{ ...card, textAlign: 'center', padding: 40 }}><div style={{ fontSize: 44 }} aria-hidden="true">🛒</div><p style={{ color: muted, margin: '10px 0 18px' }}>Your cart is empty.</p><button onClick={() => onNavigate('/menu')} className="wc-btn" style={btn()}>Browse the menu</button></div></div>
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

  const sectionTitle = (icon: string, text: string) => (
    <p style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 16, margin: '0 0 14px', color: T.on }}>
      <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 16, background: `color-mix(in srgb, ${T.primary} 14%, transparent)` }}>{icon}</span>{text}
    </p>
  );

  return (
    <div style={wrap}>
      <h1 style={{ ...h2, marginBottom: 18 }}>Checkout</h1>
      <Steps active={1} />
      <div style={{ display: 'grid', gap: 14 }}>
        <section style={card}>
          {sectionTitle('📍', 'Contact & delivery')}
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="wc-field" style={{ ...input, padding: 0, display: 'flex' }}><input id="co_name" style={{ ...input, border: 'none', background: 'transparent' }} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} aria-label="Full name" /></div>
            <div className="wc-field" style={{ ...input, padding: 0, display: 'flex' }}><input id="co_phone" style={{ ...input, border: 'none', background: 'transparent' }} placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} aria-label="Phone" /></div>
            <div className="wc-field" style={{ ...input, padding: 0, display: 'flex' }}><input id="co_address" style={{ ...input, border: 'none', background: 'transparent' }} placeholder="Delivery address" value={address} onChange={e => setAddress(e.target.value)} aria-label="Delivery address" /></div>
          </div>
          <p style={{ color: muted, fontSize: 12.5, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true">🔓</span>Checking out as guest — no app or account required.</p>
        </section>

        <section style={card}>
          {sectionTitle('🎟️', 'Promo code')}
          <div className="wc-field" style={{ display: 'flex', gap: 8, borderRadius: 12, border: hairline, background: T.surfHigh, padding: 6 }}>
            <input id="co_coupon" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: T.on, fontSize: 15, padding: '8px 10px' }} placeholder="Enter promo code" value={couponCode} onChange={e => setCouponCode(e.target.value)} aria-label="Promo code" />
            <button id="apply_coupon" onClick={submitCoupon} className="wc-btn" style={{ ...btn(false), padding: '9px 18px' }}>Apply</button>
          </div>
          {couponMsg && <p style={{ color: couponPct > 0 ? T.primary : muted, fontSize: 13.5, fontWeight: couponPct > 0 ? 700 : 400, marginTop: 10 }}>{couponPct > 0 ? '✓ ' : ''}{couponMsg}</p>}
        </section>

        <section style={card}>
          {sectionTitle('💚', 'Tip your captain')}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tips.map(t => {
              const on = tipPct === t.percent;
              return <button key={t.percent} onClick={() => setTipPct(t.percent)} className="wc-btn wc-chip" style={{ padding: '10px 16px', borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer', border: on ? `1px solid ${T.primary}` : hairline, background: on ? `color-mix(in srgb, ${T.primary} 16%, transparent)` : T.surfHigh, color: on ? T.primary : T.on }}>{t.percent === 0 ? 'No tip' : `${t.percent}% · SAR ${t.amount.toFixed(2)}`}</button>;
            })}
          </div>
        </section>

        <section style={card}>
          {sectionTitle('💳', 'Payment')}
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 12, border: `1px solid ${pay === 'cod' ? T.primary : T.line}`, background: pay === 'cod' ? `color-mix(in srgb, ${T.primary} 10%, transparent)` : 'transparent', color: T.on, fontWeight: 700 }}>
              <input id="pay_cod" type="radio" name="pay" checked={pay === 'cod'} onChange={() => setPay('cod')} style={{ accentColor: 'var(--color-primary-fixed, #a3f95b)' }} />
              <span aria-hidden="true" style={{ fontSize: 20 }}>💵</span>
              <span style={{ flex: 1 }}>Cash on Delivery</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: `color-mix(in srgb, ${T.primary} 18%, transparent)`, color: T.primary }}>RECOMMENDED</span>
            </label>
            {(['card', 'wallet'] as const).map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: hairline, color: muted, opacity: 0.6 }}>
                <input type="radio" name="pay" disabled />
                <span aria-hidden="true" style={{ fontSize: 20 }}>{m === 'card' ? '💳' : '👛'}</span>
                <span style={{ flex: 1 }}>{m === 'card' ? 'Card' : 'Wallet'}</span>
                <span style={{ fontSize: 11 }}>Coming soon</span>
              </label>
            ))}
          </div>
        </section>

        <BreakdownCard bd={bd} />
        {err && <p role="alert" style={{ color: '#f87171', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true">⚠️</span>{err}</p>}
        <button id="place_order" disabled={placing} onClick={place} className="wc-btn" style={{ ...btn(), width: '100%', height: 56, fontSize: 16.5, opacity: placing ? 0.6 : 1 }}>
          {placing ? 'Placing order…' : `Place order · SAR ${bd.total.toFixed(2)}`}
        </button>
        <p style={{ textAlign: 'center', color: muted, fontSize: 12.5, marginTop: 2 }}>🔒 Your details are used only to complete this delivery.</p>
      </div>
    </div>
  );
};

// ── Order success + live tracking ─────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = { pending: 'Order received', accepted: 'Accepted by store', preparing: 'Preparing your order', on_the_way: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled' };
const STATUS_ICON: Record<string, string> = { pending: '📝', accepted: '✅', preparing: '👨‍🍳', on_the_way: '🛵', delivered: '🎉', cancelled: '✖️' };
const TRACK_FLOW = ['pending', 'accepted', 'preparing', 'on_the_way', 'delivered'];

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

  const activeIdx = t ? TRACK_FLOW.indexOf(t.status) : 0;
  const cancelled = t?.status === 'cancelled';
  const pct = cancelled ? 0 : Math.max(0, activeIdx) / (TRACK_FLOW.length - 1) * 100;

  return (
    <div style={wrap}>
      {/* Success hero */}
      <div id="order_success" className="wc-pop" style={{ ...card, textAlign: 'center', marginBottom: 16, padding: 32, background: `radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, ${T.primary} 12%, transparent), ${T.surf} 65%)` }}>
        <div className="wc-pulse" style={{ width: 72, height: 72, margin: '0 auto', borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 38, background: T.primary, color: T.onPrimary }} aria-hidden="true">✓</div>
        <h1 style={{ ...h2, margin: '18px 0 4px' }}>Order placed!</h1>
        <p style={{ color: muted, margin: 0 }}>Order <strong style={{ color: T.on }}>#{orderId.toUpperCase()}</strong> — thank you for ordering with {brandName}.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          <button id="download_receipt" onClick={downloadReceipt} className="wc-btn" style={{ ...btn(false), padding: '10px 18px' }}>🧾 Receipt</button>
          <button onClick={() => onNavigate('/menu')} className="wc-btn" style={{ ...btn(false), padding: '10px 18px' }}>🔁 Order again</button>
        </div>
      </div>

      {/* Live tracking */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ fontWeight: 800, fontSize: 16, margin: 0, color: T.on, display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden="true">📡</span>Live tracking</p>
          {t?.etaMinutes ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontWeight: 800, fontSize: 13, background: `color-mix(in srgb, ${T.primary} 14%, transparent)`, color: T.primary }}>ETA ~{t.etaMinutes} min</span> : null}
        </div>

        {!t ? <p style={{ color: muted, marginTop: 14 }}>Loading…</p> : cancelled ? (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 14, background: T.surfHigh, border: hairline }}>
            <span id="track_status" style={{ fontSize: 17, fontWeight: 800, color: '#f87171' }}>✖️ {STATUS_LABEL.cancelled}</span>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div style={{ position: 'relative', height: 6, borderRadius: 999, background: T.surfHigh, margin: '20px 0 22px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 999, background: `linear-gradient(90deg, ${T.primary}, ${T.accent})`, transition: 'width .6s cubic-bezier(.22,1,.36,1)' }} />
            </div>
            <span id="track_status" style={{ fontSize: 20, fontWeight: 900, color: T.primary, letterSpacing: '-0.01em' }}>{STATUS_ICON[t.status]} {STATUS_LABEL[t.status] || t.status}</span>
            {t.driver && <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 14, background: T.surfHigh, border: hairline }}>
              <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 22, background: `color-mix(in srgb, ${T.primary} 16%, transparent)` }}>🛵</span>
              <div><p style={{ margin: 0, fontWeight: 800, color: T.on, fontSize: 14.5 }}>{t.driver.name}</p><p style={{ margin: '2px 0 0', color: muted, fontSize: 13 }}>is handling your delivery</p></div>
            </div>}

            {/* Vertical step timeline */}
            <ol style={{ listStyle: 'none', padding: 0, margin: '22px 0 0', display: 'grid', gap: 0 }}>
              {TRACK_FLOW.map((st, i) => {
                const done = i < activeIdx, current = i === activeIdx;
                const stamp = t.timeline.find(s => s.status === st);
                return (
                  <li key={st} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: i < TRACK_FLOW.length - 1 ? 18 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
                      <span className={current ? 'wc-pulse' : undefined} aria-hidden="true" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, background: done || current ? T.primary : T.surfHigh, color: done || current ? T.onPrimary : T.onVar, border: done || current ? 'none' : hairline }}>{done ? '✓' : current ? '•' : i + 1}</span>
                      {i < TRACK_FLOW.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 20, background: done ? T.primary : T.line, marginTop: 2 }} />}
                    </div>
                    <div style={{ paddingTop: 3 }}>
                      <p style={{ margin: 0, fontWeight: current ? 800 : 600, color: done || current ? T.on : T.onVar, fontSize: 14.5 }}>{STATUS_LABEL[st]}</p>
                      {stamp && <p style={{ margin: '2px 0 0', color: muted, fontSize: 12.5 }}>{new Date(stamp.at).toLocaleTimeString()}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22, paddingTop: 18, borderTop: hairline }}>
          <button onClick={doCancel} className="wc-btn" style={{ ...btn(false), padding: '9px 16px', fontSize: 13.5 }}>Cancel</button>
          <button onClick={doReorder} className="wc-btn" style={{ ...btn(false), padding: '9px 16px', fontSize: 13.5 }}>Reorder</button>
          <button onClick={doRefund} className="wc-btn" style={{ ...btn(false), padding: '9px 16px', fontSize: 13.5 }}>Request refund</button>
          <button onClick={doSupport} className="wc-btn" style={{ ...btn(false), padding: '9px 16px', fontSize: 13.5 }}>Support</button>
        </div>
        {note && <p role="status" style={{ color: T.primary, fontSize: 14, marginTop: 12, fontWeight: 600 }}>{note}</p>}
      </section>
    </div>
  );
};

// ── Shared breakdown card ───────────────────────────────────────────────────────────
const BreakdownCard: React.FC<{ bd: ReturnType<typeof breakdownFor> }> = ({ bd }) => {
  const row = (label: string, value: number, strong = false, accent = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: strong ? 18 : 14.5, fontWeight: strong ? 800 : 500, color: strong ? T.on : muted, marginTop: strong ? 10 : 6 }}>
      <span>{label}</span><span style={accent ? { color: T.primary, fontWeight: 700 } : strong ? { color: T.primary } : undefined}>{value < 0 ? '−' : ''}SAR {Math.abs(value).toFixed(2)}</span>
    </div>
  );
  return (
    <div style={{ ...card, marginTop: 16 }}>
      <p style={{ fontWeight: 800, fontSize: 15, margin: '0 0 6px', color: T.on }}>Order summary</p>
      {row('Subtotal', bd.subtotal)}
      {bd.discount > 0 && row('Discount', -bd.discount, false, true)}
      {row('Delivery', bd.deliveryFee)}
      {bd.serviceFee > 0 && row('Service fee', bd.serviceFee)}
      {bd.taxMode !== 'none' && bd.tax > 0 && row(bd.taxMode === 'inclusive' ? 'VAT (incl.)' : 'VAT', bd.tax)}
      {bd.tip > 0 && row('Tip', bd.tip)}
      <div style={{ borderTop: hairline, marginTop: 12, paddingTop: 2 }}>{row('Total', bd.total, true)}</div>
    </div>
  );
};
