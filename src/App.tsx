import React, { useState, useEffect } from 'react';
import { cartService } from './services/cart.service';
import { LoginScreen } from './features/auth/LoginScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { RestaurantScreen } from './features/restaurant/RestaurantScreen';
import { CheckoutPage } from './features/checkout/CheckoutPage';
import { OrdersList } from './features/orders/OrdersList';
import { WalletScreen } from './features/wallet/WalletScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { MerchantApp } from './features/merchant/MerchantApp';
import { DriverApp } from './features/driver/DriverApp';
import { AdminDashboard } from './features/admin/AdminDashboard';

interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    branch_id: string;
  };
  variant: {
    id: string;
    name: string;
    price_modifier: number;
  } | null;
  quantity: number;
}

// Material Symbol wrapper
function Icon({ name, fill = 0, className = '', style }: { name: string; fill?: 0 | 1; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill}`, ...style }}
    >
      {name}
    </span>
  );
}

export default function App() {
  const [session, setSession] = useState<{ id: string; phone_number: string; role: string } | null>(null);
  const [simulatedRole, setSimulatedRole] = useState<'customer' | 'merchant' | 'driver' | 'admin'>('customer');

  const [currentScreen, setCurrentScreen] = useState<'home' | 'restaurant' | 'checkout' | 'orders' | 'wallet' | 'profile'>('home');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedBranchName, setSelectedBranchName] = useState<string>('');
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string | undefined>(undefined);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (session?.id) {
      cartService.fetchRemoteCart(session.id)
        .then((remoteCart) => {
          if (remoteCart && remoteCart.items.length > 0) {
            setCart(remoteCart.items as CartItem[]);
          } else {
            const local = cartService.getCart();
            if (local && local.items.length > 0) setCart(local.items as CartItem[]);
          }
        })
        .catch(err => console.error('Failed to sync remote cart:', err));
    } else {
      const local = cartService.getCart();
      setCart(local && local.items.length > 0 ? (local.items as CartItem[]) : []);
    }
  }, [session?.id]);

  useEffect(() => {
    if (session?.id) {
      cartService.syncLocalCartToRemote(
        session.id,
        cart as Parameters<typeof cartService.syncLocalCartToRemote>[1],
        cart.length > 0 ? cart[0].product.branch_id : null,
        null
      ).catch(err => console.error('Failed to write cart to remote:', err));
    }
  }, [cart, session?.id]);

  useEffect(() => {
    const saved = localStorage.getItem('haat_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
        setSimulatedRole(parsed.role || 'customer');
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleLoginSuccess = (user: { id: string; phone_number: string; role: string }) => {
    setSession(user);
    setSimulatedRole(user.role as 'customer' | 'merchant' | 'driver' | 'admin');
    localStorage.setItem('haat_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('haat_session');
  };

  const handleSwitchSimulatedRole = (role: 'customer' | 'merchant' | 'driver' | 'admin') => {
    setSimulatedRole(role);
    if (role === 'customer') setCurrentScreen('home');
  };

  const handleAddToCart = (product: CartItem['product'], variant: CartItem['variant']) => {
    if (cart.length > 0 && cart[0].product.branch_id !== product.branch_id) {
      const confirmWipe = window.confirm('لديك أصناف مضافة من متجر آخر بالسلة. هل ترغب في إفراغ السلة وبدء سلة جديدة؟');
      if (!confirmWipe) return;
      setCart([{ product, variant, quantity: 1 }]);
      setIsCartOpen(true);
      return;
    }
    const existingIndex = cart.findIndex(i => i.product.id === product.id && i.variant?.id === variant?.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, variant, quantity: 1 }]);
    }
    setIsCartOpen(true);
  };

  const handleUpdateProductQty = (prodId: string, varId: string | null, change: number) => {
    const idx = cart.findIndex(i => i.product.id === prodId && i.variant?.id === varId);
    if (idx > -1) {
      const updated = [...cart];
      const newQty = updated[idx].quantity + change;
      if (newQty <= 0) updated.splice(idx, 1);
      else updated[idx].quantity = newQty;
      setCart(updated);
    }
  };

  const getCartSubtotal = () =>
    cart.reduce((sum, item) => {
      const price = item.product.price + (item.variant ? item.variant.price_modifier : 0);
      return sum + price * item.quantity;
    }, 0);

  const totalCartQty = cart.reduce((s, i) => s + i.quantity, 0);

  const handleNavigateToCheckout = () => {
    setIsCartOpen(false);
    setSelectedBranchId(cart[0].product.branch_id);
    setCurrentScreen('checkout');
  };

  const handleOrderPlacedSuccess = (orderId: string) => {
    setCart([]);
    setSelectedTrackingOrderId(orderId);
    setCurrentScreen('orders');
  };

  // ── Auth wall ──────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen" style={{ background: '#111417' }}>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // ── Role labels for simulator toolbar ─────────────────────
  const roleLabels: Record<string, string> = {
    customer: 'العميل',
    merchant: 'التاجر',
    driver: 'الكابتن',
    admin: 'الإدارة',
  };

  return (
    <div className="min-h-screen" style={{ background: '#111417', color: 'var(--color-on-surface)' }}>

      {/* ── Compact Dev Simulator Toolbar ─────────────────── */}
      <div
        className="sticky top-0 z-[60] flex items-center justify-between gap-2 px-3 py-1.5"
        style={{ background: 'var(--color-surface-container-high)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px' }}
        id="simulator_toolbar"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['customer', 'merchant', 'driver', 'admin'] as const).map(r => (
            <button
              key={r}
              onClick={() => handleSwitchSimulatedRole(r)}
              className="px-2.5 py-1 rounded-full font-bold transition-colors active:scale-95"
              style={{
                fontSize: '10px',
                background: simulatedRole === r ? 'var(--color-primary-fixed)' : 'var(--color-surface-container)',
                color: simulatedRole === r ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)',
              }}
              id={`sim_role_${r}`}
            >
              {roleLabels[r]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '10px' }}>{session.phone_number}</span>
          <button
            onClick={handleLogout}
            className="hover:underline"
            style={{ color: 'var(--color-error)', fontSize: '10px' }}
          >
            خروج
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          CUSTOMER PORTAL
      ═══════════════════════════════════════════════════════ */}
      {simulatedRole === 'customer' && (
        <>
          {/* ── Stitch-spec Top Header (hidden on full-screen portals) ─── */}
          {currentScreen !== 'wallet' && currentScreen !== 'profile' && (
          <header
            className="sticky top-[36px] z-50 flex items-center justify-between px-4 h-16 shadow-sm"
            style={{ background: 'rgba(17,20,23,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            id="stitch_header"
          >
            {/* Left: menu + logo */}
            <div className="flex items-center gap-3">
              <Icon name="menu" className="text-[var(--color-primary-fixed)] cursor-pointer hover:opacity-80 transition-opacity" />
              <span
                className="text-headline-sm font-bold neon-text-glow"
                style={{ color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}
              >
                HAAT NOW
              </span>
            </div>

            {/* Right: location chip (md+) + cart + account */}
            <div className="flex items-center gap-3">
              <div
                className="hidden md:flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{ background: 'var(--color-surface-container)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <Icon name="location_on" className="text-[var(--color-on-surface-variant)]" style={{ fontSize: '16px' } as React.CSSProperties} />
                <span className="text-label-sm" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--color-on-surface)', fontSize: '12px' }}>
                  تجمع الخامسة
                </span>
              </div>

              {/* Cart button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
                id="cart_header_btn"
              >
                <Icon name="shopping_bag" className="text-[var(--color-on-surface)]" />
                {totalCartQty > 0 && (
                  <span
                    className="absolute -top-1.5 -end-1.5 w-4 h-4 rounded-full flex items-center justify-center font-bold"
                    style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '9px' }}
                  >
                    {totalCartQty}
                  </span>
                )}
              </button>

              <Icon name="account_circle" className="text-[var(--color-primary-fixed)] cursor-pointer hover:opacity-80 transition-opacity" />
            </div>
          </header>
          )}

          {/* ── Main scrollable content (hidden on full-screen portals) ─── */}
          {currentScreen !== 'wallet' && currentScreen !== 'profile' && (
          <main className="max-w-7xl mx-auto px-4 pt-6 pb-32" id="customer_main">

            {currentScreen === 'home' && (
              <HomeScreen
                customerId={session.id}
                onSelectRestaurant={(bId, rName) => {
                  setSelectedBranchId(bId);
                  setSelectedBranchName(rName);
                  setCurrentScreen('restaurant');
                }}
              />
            )}

            {currentScreen === 'restaurant' && (
              <RestaurantScreen
                branchId={selectedBranchId}
                restaurantName={selectedBranchName}
                cartItems={cart}
                onBack={() => setCurrentScreen('home')}
                onAddToCart={handleAddToCart as (p: any, v: any) => void}
                onViewCart={() => setIsCartOpen(true)}
              />
            )}

            {currentScreen === 'checkout' && (
              <CheckoutPage
                cartItems={cart}
                branchId={selectedBranchId}
                customerId={session.id}
                onBack={() => setCurrentScreen('restaurant')}
                onOrderPlaced={handleOrderPlacedSuccess}
              />
            )}

            {currentScreen === 'orders' && (
              <OrdersList
                customerId={session.id}
                selectedOrderIdInit={selectedTrackingOrderId}
                onSelectOrderBack={() => setSelectedTrackingOrderId(undefined)}
              />
            )}

          </main>
          )}

          {/* ── Wallet Screen (full-width) ─────────────── */}
          {currentScreen === 'wallet' && <WalletScreen customerId={session.id} />}

          {/* ── Profile Screen (full-width) ───────────── */}
          {currentScreen === 'profile' && <ProfileScreen session={session} onLogout={handleLogout} />}

          {/* ── Stitch-spec Floating Bottom Nav ─────────────── */}
          <nav
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md flex justify-around items-center h-16 px-4 z-50 rounded-full"
            style={{
              background: 'rgba(29,32,35,0.6)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 0 20px rgba(163,249,91,0.2)',
            }}
            id="stitch_bottom_nav"
          >
            {/* Home */}
            <button
              onClick={() => setCurrentScreen('home')}
              className="flex flex-col items-center justify-center transition-colors active:scale-90 duration-200 cursor-pointer relative"
              style={{ color: currentScreen === 'home' || currentScreen === 'restaurant' ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}
              id="nav_home"
            >
              <Icon name="home_app_logo" fill={currentScreen === 'home' || currentScreen === 'restaurant' ? 1 : 0} />
              {(currentScreen === 'home' || currentScreen === 'restaurant') && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full" style={{ background: 'var(--color-primary-fixed)' }} />
              )}
            </button>

            {/* Wallet */}
            <button
              onClick={() => setCurrentScreen('wallet')}
              className="flex flex-col items-center justify-center transition-colors active:scale-90 duration-200 cursor-pointer relative"
              style={{ color: currentScreen === 'wallet' ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}
              id="nav_wallet"
            >
              <Icon name="account_balance_wallet" fill={currentScreen === 'wallet' ? 1 : 0} />
              {currentScreen === 'wallet' && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full" style={{ background: 'var(--color-primary-fixed)' }} />
              )}
            </button>

            {/* Orders */}
            <button
              onClick={() => { setSelectedTrackingOrderId(undefined); setCurrentScreen('orders'); }}
              className="flex flex-col items-center justify-center transition-colors active:scale-90 duration-200 cursor-pointer relative"
              style={{ color: currentScreen === 'orders' ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}
              id="nav_orders"
            >
              <Icon name="receipt_long" fill={currentScreen === 'orders' ? 1 : 0} />
              {currentScreen === 'orders' && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full" style={{ background: 'var(--color-primary-fixed)' }} />
              )}
            </button>

            {/* Cart */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex flex-col items-center justify-center transition-colors active:scale-90 duration-200 cursor-pointer relative"
              style={{ color: totalCartQty > 0 ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}
              id="nav_cart"
            >
              <Icon name="local_mall" fill={totalCartQty > 0 ? 1 : 0} />
              {totalCartQty > 0 && (
                <span
                  className="absolute -top-1 -end-1 w-4 h-4 rounded-full flex items-center justify-center font-bold"
                  style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '9px' }}
                >
                  {totalCartQty}
                </span>
              )}
            </button>

            {/* Profile */}
            <button
              onClick={() => setCurrentScreen('profile')}
              className="flex flex-col items-center justify-center transition-colors active:scale-90 duration-200 cursor-pointer relative"
              style={{ color: currentScreen === 'profile' ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}
              id="nav_profile"
            >
              <Icon name="person" fill={currentScreen === 'profile' ? 1 : 0} />
              {currentScreen === 'profile' && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full" style={{ background: 'var(--color-primary-fixed)' }} />
              )}
            </button>
          </nav>

          {/* ── FAB: Chat (home only) ─────────────────────────── */}
          {currentScreen === 'home' && (
            <button
              className="fixed bottom-24 end-6 p-4 rounded-full z-40 cursor-pointer transition-all hover:scale-110 active:scale-95"
              style={{
                background: 'var(--color-primary-fixed)',
                color: 'var(--color-on-primary-fixed)',
                boxShadow: '0 8px 32px rgba(163,249,91,0.4)',
              }}
              id="fab_chat"
            >
              <Icon name="chat_bubble" />
            </button>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          OTHER PORTALS
      ═══════════════════════════════════════════════════════ */}
      {simulatedRole === 'merchant' && <MerchantApp />}
      {simulatedRole === 'driver'   && <DriverApp driverId={session.id} />}
      {simulatedRole === 'admin'    && <AdminDashboard />}

      {/* ═══════════════════════════════════════════════════════
          CART DRAWER
      ═══════════════════════════════════════════════════════ */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-[70] flex justify-end"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          id="cart_drawer_mask"
          onClick={(e) => { if (e.target === e.currentTarget) setIsCartOpen(false); }}
        >
          <div
            className="w-full max-w-md h-full flex flex-col p-6 animate-slide-up glass-panel"
            style={{ borderInlineStart: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
            id="cart_drawer_panel"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6" id="cart_header">
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/10"
                style={{ background: 'var(--color-surface-container-high)' }}
                id="cart_close_btn"
              >
                <Icon name="close" className="text-[var(--color-on-surface)]" />
              </button>
              <h3 className="text-headline-sm flex items-center gap-2" style={{ color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}>
                <Icon name="shopping_bag" fill={1} className="text-[var(--color-primary-fixed)]" />
                سلة وجباتي
              </h3>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto space-y-3" id="cart_items_scroll">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center" id="cart_empty">
                  <Icon name="shopping_bag" className="text-5xl opacity-20" style={{ fontSize: '48px' } as React.CSSProperties} />
                  <p className="text-body-md" style={{ color: 'var(--color-on-surface-variant)' }}>سلتك خالية، ابدأ بالتصفح!</p>
                </div>
              ) : (
                cart.map((item, idx) => {
                  const price = item.product.price + (item.variant ? item.variant.price_modifier : 0);
                  return (
                    <div
                      key={idx}
                      className="flex flex-row-reverse justify-between items-center gap-3 p-4 rounded-xl glass-panel"
                      style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                      id={`cart_row_${idx}`}
                    >
                      <div className="flex-1 text-right">
                        <h4 className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{item.product.name}</h4>
                        {item.variant && (
                          <span className="text-xs block mt-0.5" style={{ color: 'var(--color-primary-fixed)' }}>({item.variant.name})</span>
                        )}
                        <span className="text-xs font-semibold mt-1 block" style={{ color: 'var(--color-primary-fixed)', fontVariant: 'tabular-nums' }}>
                          {price.toFixed(2)} ر.س
                        </span>
                      </div>
                      {/* Qty controls */}
                      <div
                        className="flex items-center gap-3 px-2.5 py-1.5 rounded-xl"
                        style={{ background: 'var(--color-surface-container-highest)', border: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <button
                          onClick={() => handleUpdateProductQty(item.product.id, item.variant?.id ?? null, 1)}
                          className="cursor-pointer hover:text-[var(--color-primary-fixed)] transition-colors"
                          style={{ color: 'var(--color-on-surface)', fontSize: '18px', lineHeight: 1 }}
                        >
                          +
                        </button>
                        <span className="font-bold text-xs" style={{ color: 'var(--color-on-surface)' }}>{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateProductQty(item.product.id, item.variant?.id ?? null, -1)}
                          className="cursor-pointer hover:text-red-400 transition-colors"
                          style={{ color: 'var(--color-on-surface)', fontSize: '18px', lineHeight: 1 }}
                        >
                          −
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="pt-6 space-y-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} id="cart_footer">
                <div className="flex flex-row-reverse justify-between text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span>المجموع الفرعي</span>
                  <span>{getCartSubtotal().toFixed(2)} ر.س</span>
                </div>
                <button
                  onClick={handleNavigateToCheckout}
                  className="w-full h-14 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] neon-glow-btn"
                  style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}
                  id="checkout_btn"
                >
                  <Icon name="arrow_back" />
                  المتابعة وإتمام الدفع
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
