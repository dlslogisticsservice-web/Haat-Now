import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { notificationService } from './services/notification.service';
import { sandboxStore } from './services/sandboxStore';
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
import { authService } from './services/auth.service';
import { getCategoryThumb } from './utils/categoryImages';
import { useAppConfig } from './contexts/AppConfigContext';
import { useTranslation } from 'react-i18next';
import { COUNTRY_LIST } from './config/countries';
import { Globe } from 'lucide-react';
import { SplashScreen } from './components/splash/SplashScreen';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import {
  Loader2, ShoppingBag, Bell, Home, ScrollText, ShoppingCart,
  Wallet, User, MessageCircle, Crown, X, ChevronRight, LogOut,
  MapPin, ChevronDown, BellOff,
} from 'lucide-react';

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

function getCartItemPhoto(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('شاورما') || n.includes('دجاج')) return 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=90&w=300&crop=entropy';
  if (n.includes('برجر') || n.includes('واغيو') || n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=90&w=300&crop=entropy';
  if (n.includes('بيتزا') || n.includes('pizza'))  return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=90&w=300&crop=entropy';
  if (n.includes('قهو') || n.includes('coffee'))   return 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=90&w=300&crop=entropy';
  if (n.includes('سلطة') || n.includes('salad'))   return 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=90&w=300&crop=entropy';
  if (n.includes('مشاوي') || n.includes('كباب'))   return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=90&w=300&crop=entropy';
  // Non-food items (pharmacy, flowers, electronics…) resolve to their own category.
  return getCategoryThumb(name);
}

export default function App() {
  // ── First-run experience flow ───────────────────────────────────
  const [appPhase, setAppPhase] = useState<'splash' | 'onboarding' | 'ready'>('splash');

  const handleSplashComplete = () => {
    const onboardingDone = localStorage.getItem('haat_onboarding_done');
    setAppPhase(onboardingDone ? 'ready' : 'onboarding');
  };

  const handleOnboardingComplete = () => setAppPhase('ready');

  // ── Country / language (Phase 3) ────────────────────────────────
  const { country, lang, price: money, setCountry, toggleLang } = useAppConfig();
  const { t } = useTranslation();
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  // ── Auth state ──────────────────────────────────────────────────
  const [session, setSession] = useState<{ id: string; phone_number: string; role: string } | null>(null);
  const [sessionValidating, setSessionValidating] = useState(true);

  // ── Navigation ──────────────────────────────────────────────────
  const [currentScreen, setCurrentScreen] = useState<'home' | 'restaurant' | 'checkout' | 'orders' | 'wallet' | 'profile'>('home');
  const [selectedBranchId,     setSelectedBranchId]     = useState<string>('');
  const [selectedBranchName,   setSelectedBranchName]   = useState<string>('');
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string | undefined>(undefined);

  // ── UI overlays ─────────────────────────────────────────────────
  const [cart,           setCart]           = useState<CartItem[]>([]);
  const [isCartOpen,     setIsCartOpen]     = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [notifications,  setNotifications]  = useState<any[]>([]);
  const [isNotifOpen,    setIsNotifOpen]    = useState(false);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const notifChannelRef = useRef<any>(null);

  // ── Cart remote sync ────────────────────────────────────────────
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
        null,
      ).catch(err => console.error('Failed to write cart to remote:', err));
    }
  }, [cart, session?.id]);

  // ── Customer notifications ──────────────────────────────────────
  useEffect(() => {
    if (!session?.id || session.role !== 'customer') return;

    const countUnseen = (list: any[]) => {
      const lastSeen   = localStorage.getItem('haat_notifications_last_seen');
      const lastSeenTs = lastSeen ? new Date(lastSeen).getTime() : 0;
      setUnreadCount(list.filter(n => new Date(n.created_at || 0).getTime() > lastSeenTs).length);
    };

    // Sandbox: read the shared notification store (delivery + loyalty events) and
    // register a push token (push-architecture scaffold) — poll for new events.
    if (import.meta.env.VITE_AUTH_MODE === 'sandbox') {
      sandboxStore.registerPushToken(session.id, `web-${session.id.slice(0, 8)}`, 'web');
      const sync = () => { const list = sandboxStore.getNotifications(session.id); setNotifications(list); countUnseen(list); };
      sync();
      const iv = setInterval(sync, 4000);
      return () => clearInterval(iv);
    }

    const loadAndCount = async () => {
      const { data } = await notificationService.getUserNotifications(session.id);
      if (data) {
        setNotifications(data);
        // Prefer server-side is_read count (H3, post-0020); fall back to last-seen.
        const { count, error } = await notificationService.getUnreadCount(session.id);
        if (!error) setUnreadCount(count); else countUnseen(data);
      }
    };

    loadAndCount();

    const channel = supabase
      .channel(`customer-notifs-${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `target_user_id=eq.${session.id}` }, (payload) => {
        setNotifications(prev => [payload.new as any, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();
    notifChannelRef.current = channel;

    return () => {
      if (notifChannelRef.current) {
        supabase.removeChannel(notifChannelRef.current);
        notifChannelRef.current = null;
      }
    };
  }, [session?.id]);

  // ── Session restore ─────────────────────────────────────────────────────────
  // Works for both modes: getCurrentUser() reads the sandbox session (sandbox mode)
  // or the real Supabase session (supabase mode).
  useEffect(() => {
    let active = true;
    authService.getCurrentUser()
      .then(user => { if (active) setSession(user); })
      .catch(console.error)
      .finally(() => { if (active) setSessionValidating(false); });

    // All auth-change subscription lives in authService (no-op in sandbox mode).
    const unsubscribe = authService.subscribeToAuthChanges(user => setSession(user));
    return () => { active = false; unsubscribe(); };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────
  // verifyOtp already established the real Supabase session; just reflect it in state.
  // The onAuthStateChange listener keeps it authoritative — no fake session is stored.
  const handleLoginSuccess = (user: { id: string; phone_number: string; role: string }) => {
    setSession(user);
  };

  const handleLogout = async () => {
    await authService.signOut();
    setSession(null);
    setIsSideMenuOpen(false);
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
      const newQty  = updated[idx].quantity + change;
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

  const handleMarkNotifsAsRead = () => {
    localStorage.setItem('haat_notifications_last_seen', new Date().toISOString());
    setUnreadCount(0);
    // Persist read-state (H3): sandbox → shared store; supabase → notifications.is_read.
    if (session?.id) {
      if (import.meta.env.VITE_AUTH_MODE === 'sandbox') sandboxStore.markAllNotifsRead(session.id);
      else notificationService.markAllRead(session.id).catch(() => { /* non-blocking */ });
    }
  };

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

  const handleOpenChat = () => {
    setIsNotifOpen(true);
    handleMarkNotifsAsRead();
  };

  // ── First-run experience gates ───────────────────────────────────
  if (appPhase === 'splash')     return <SplashScreen onComplete={handleSplashComplete} />;
  if (appPhase === 'onboarding') return <OnboardingScreen onComplete={handleOnboardingComplete} />;

  // ── Session validation gate ──────────────────────────────────────
  if (sessionValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={36} className="text-[var(--color-primary-fixed)] animate-spin" />
      </div>
    );
  }

  // ── Auth wall ────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen">
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">

      {/* ══════════════════════════════════════════════════════════
          CUSTOMER PORTAL
      ══════════════════════════════════════════════════════════ */}
      {session.role === 'customer' && (
        <>
          {/* ── Top Header ──────────────────────────────────────── */}
          {currentScreen !== 'wallet' && currentScreen !== 'profile' && (
            <header
              className="sticky top-0 z-50 glass-strong flex items-center justify-between px-4"
              id="stitch_header"
              style={{ height: '56px' }}
            >
              {/* LEFT: Avatar → profile */}
              <button
                onClick={() => setCurrentScreen('profile')}
                className="flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                aria-label="الملف الشخصي"
              >
                <User size={18} color="rgba(255,255,255,0.55)" strokeWidth={1.75} />
              </button>

              {/* CENTER: Country selector */}
              <button
                onClick={() => setCountryPickerOpen(true)}
                style={{ textAlign: 'center', flex: 1, background: 'none', border: 'none', cursor: 'pointer' }}
                id="country_selector_btn"
              >
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', lineHeight: 1, marginBottom: '3px', letterSpacing: '0.02em' }}>
                  {lang === 'ar' ? 'التوصيل إلى' : 'Deliver to'}
                </p>
                <div className="flex items-center justify-center gap-1">
                  <span style={{ fontSize: '14px' }}>{country.flag}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
                    {lang === 'ar' ? `${country.defaultCityAr}، ${country.nameAr}` : `${country.defaultCityEn}, ${country.nameEn}`}
                  </span>
                  <ChevronDown size={13} color="rgba(255,255,255,0.4)" strokeWidth={2.5} />
                </div>
              </button>

              {/* RIGHT: Language toggle */}
              <button
                onClick={toggleLang}
                className="flex items-center justify-center gap-1 active:scale-95 transition-transform"
                style={{ height: '38px', padding: '0 10px', borderRadius: '19px', background: 'rgba(163,249,91,0.1)', border: '1px solid rgba(163,249,91,0.25)', flexShrink: 0, cursor: 'pointer' }}
                id="lang_toggle_btn"
                aria-label="language"
              >
                <Globe size={14} color="var(--color-primary-fixed)" strokeWidth={2} />
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary-fixed)' }}>{lang === 'ar' ? 'EN' : 'ع'}</span>
              </button>
            </header>
          )}

          {/* ── Main scrollable content ──────────────────────────── */}
          {currentScreen !== 'wallet' && currentScreen !== 'profile' && (
            <main className="max-w-7xl mx-auto px-4 pt-2" id="customer_main" style={{ paddingBottom: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}>
              {currentScreen === 'home' && (
                <HomeScreen
                  customerId={session.id}
                  onSelectRestaurant={(bId, rName) => {
                    setSelectedBranchId(bId);
                    setSelectedBranchName(rName);
                    setCurrentScreen('restaurant');
                  }}
                  onNavigateToWallet={() => setCurrentScreen('wallet')}
                />
              )}

              {currentScreen === 'restaurant' && (
                <RestaurantScreen
                  branchId={selectedBranchId}
                  restaurantName={selectedBranchName}
                  customerId={session.id}
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

          {/* ── Full-screen portals ───────────────────────────────── */}
          {currentScreen === 'wallet'  && <WalletScreen customerId={session.id} />}
          {currentScreen === 'profile' && <ProfileScreen session={session} onLogout={handleLogout} />}

          {/* ── Bottom Navigation ────────────────────────────────── */}
          <nav className="bottom-nav" id="stitch_bottom_nav" dir="rtl">
            <div className="bottom-nav__inner">

              {/* Home */}
              {(() => {
                const isActive = currentScreen === 'home' || currentScreen === 'restaurant';
                return (
                  <button className={`nav-item${isActive ? ' nav-item--active' : ''}`} onClick={() => setCurrentScreen('home')} id="nav_home" aria-label="الرئيسية">
                    <span className="nav-item__indicator" />
                    <span className="nav-item__icon-wrap">
                      <Home size={22} color={isActive ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)'} strokeWidth={isActive ? 2.5 : 1.75} />
                    </span>
                    <span className="nav-item__label" style={{ color: isActive ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{t('nav.home')}</span>
                  </button>
                );
              })()}

              {/* Orders */}
              {(() => {
                const isActive = currentScreen === 'orders';
                return (
                  <button className={`nav-item${isActive ? ' nav-item--active' : ''}`} onClick={() => { setSelectedTrackingOrderId(undefined); setCurrentScreen('orders'); }} id="nav_orders" aria-label="طلباتي">
                    <span className="nav-item__indicator" />
                    <span className="nav-item__icon-wrap">
                      <ScrollText size={22} color={isActive ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)'} strokeWidth={isActive ? 2.5 : 1.75} />
                    </span>
                    <span className="nav-item__label" style={{ color: isActive ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{t('nav.orders')}</span>
                  </button>
                );
              })()}

              {/* Cart — center FAB */}
              <button className="nav-item" onClick={() => setIsCartOpen(true)} id="nav_cart" aria-label="سلتي">
                <span className="nav-item__icon-wrap" style={{ position: 'relative' }}>
                  <span
                    className="flex items-center justify-center w-11 h-11 rounded-full"
                    style={{
                      background: totalCartQty > 0 ? 'var(--color-primary-fixed)' : 'rgba(255,255,255,0.07)',
                      border: totalCartQty > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'background 200ms',
                      boxShadow: totalCartQty > 0 ? '0 0 20px rgba(163,249,91,0.4)' : 'none',
                    }}
                  >
                    <ShoppingCart
                      size={22}
                      color={totalCartQty > 0 ? '#0c2000' : 'var(--color-on-surface-variant)'}
                      strokeWidth={totalCartQty > 0 ? 2.5 : 1.75}
                    />
                  </span>
                  {totalCartQty > 0 && <span className="nav-badge">{totalCartQty > 9 ? '9+' : totalCartQty}</span>}
                </span>
                <span className="nav-item__label" style={{ color: totalCartQty > 0 ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{t('nav.cart')}</span>
              </button>

              {/* Wallet */}
              {(() => {
                const isActive = currentScreen === 'wallet';
                return (
                  <button className={`nav-item${isActive ? ' nav-item--active' : ''}`} onClick={() => setCurrentScreen('wallet')} id="nav_wallet" aria-label="المحفظة">
                    <span className="nav-item__indicator" />
                    <span className="nav-item__icon-wrap">
                      <Wallet size={22} color={isActive ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)'} strokeWidth={isActive ? 2.5 : 1.75} />
                    </span>
                    <span className="nav-item__label" style={{ color: isActive ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{t('nav.wallet')}</span>
                  </button>
                );
              })()}

              {/* Profile */}
              {(() => {
                const isActive = currentScreen === 'profile';
                return (
                  <button className={`nav-item${isActive ? ' nav-item--active' : ''}`} onClick={() => setCurrentScreen('profile')} id="nav_profile" aria-label="حسابي">
                    <span className="nav-item__indicator" />
                    <span className="nav-item__icon-wrap">
                      <User size={22} color={isActive ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)'} strokeWidth={isActive ? 2.5 : 1.75} />
                    </span>
                    <span className="nav-item__label" style={{ color: isActive ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{t('nav.profile')}</span>
                  </button>
                );
              })()}

            </div>
          </nav>

          {/* ── FAB: Support chat — matches stitch reference green circle ── */}
          {currentScreen === 'home' && (
            <button
              onClick={handleOpenChat}
              className="fixed bottom-[84px] end-4 w-12 h-12 rounded-full z-40 cursor-pointer transition-all hover:scale-110 active:scale-95 flex items-center justify-center animate-pulse-glow"
              style={{ background: 'var(--color-primary-fixed)', boxShadow: '0 4px 20px rgba(163,249,91,0.50)' }}
              id="fab_chat"
              aria-label="الإشعارات والدعم"
            >
              <MessageCircle size={20} color="#0c2000" strokeWidth={2.5} />
            </button>
          )}

          {/* ══════════════════════════════════════════════════════
              SIDE MENU DRAWER
          ══════════════════════════════════════════════════════ */}
          {isSideMenuOpen && (
            <div className="side-menu-overlay" id="side_menu_mask" onClick={() => setIsSideMenuOpen(false)}>
              <div className="side-menu-panel glass-shine" onClick={e => e.stopPropagation()} id="side_menu_panel" dir="rtl">

                {/* Header */}
                <div className="p-6 pt-12" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(163,249,91,0.1)', border: '1px solid rgba(163,249,91,0.2)' }}
                    >
                      <User size={24} color="var(--color-primary-fixed)" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p style={{ color: 'white', fontSize: '15px', fontWeight: 700 }}>
                        {session.phone_number || 'عميل HAAT NOW'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Crown size={13} color="#fb923c" strokeWidth={2} />
                        <span style={{ color: '#fb923c', fontSize: '11px', fontWeight: 600 }}>Platinum Member</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation items */}
                <div className="flex-1 overflow-y-auto py-3">
                  {[
                    { NavIcon: Home,       label: 'الرئيسية', screen: 'home'    as const },
                    { NavIcon: ScrollText, label: 'طلباتي',   screen: 'orders'  as const },
                    { NavIcon: Wallet,     label: 'المحفظة',  screen: 'wallet'  as const },
                    { NavIcon: User,       label: 'حسابي',    screen: 'profile' as const },
                  ].map(item => {
                    const isActive = currentScreen === item.screen || (item.screen === 'home' && currentScreen === 'restaurant');
                    return (
                      <button
                        key={item.screen}
                        onClick={() => { setCurrentScreen(item.screen); setIsSideMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors text-right"
                        style={{
                          background: isActive ? 'rgba(163,249,91,0.07)' : 'none',
                          border: 'none',
                          borderRight: isActive ? '3px solid var(--color-primary-fixed)' : '3px solid transparent',
                          color: isActive ? 'var(--color-primary-fixed)' : 'rgba(255,255,255,0.65)',
                        }}
                      >
                        <item.NavIcon
                          size={20}
                          color={isActive ? 'var(--color-primary-fixed)' : 'rgba(255,255,255,0.4)'}
                          strokeWidth={isActive ? 2.5 : 1.75}
                        />
                        <span style={{ fontSize: '15px', fontWeight: isActive ? 700 : 400 }}>{item.label}</span>
                      </button>
                    );
                  })}

                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '8px 20px' }} />

                  <button
                    onClick={() => { setIsNotifOpen(true); handleMarkNotifsAsRead(); setIsSideMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors text-right"
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)' }}
                  >
                    <Bell size={20} color="rgba(255,255,255,0.4)" strokeWidth={1.75} />
                    <span style={{ fontSize: '15px' }}>الإشعارات</span>
                    {unreadCount > 0 && (
                      <span className="ms-auto px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--color-error)', color: '#fff' }}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Footer */}
                <div className="p-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer transition-all hover:bg-red-900/20"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: '14px', fontWeight: 600 }}
                  >
                    <LogOut size={18} color="#fca5a5" strokeWidth={2} />
                    تسجيل الخروج
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          OTHER PORTALS
      ══════════════════════════════════════════════════════════ */}
      {session.role === 'merchant' && <MerchantApp merchantId={session.id} onLogout={handleLogout} />}
      {session.role === 'driver'   && <DriverApp driverId={session.id} onLogout={handleLogout} />}
      {session.role === 'admin'    && <AdminDashboard adminId={session.id} onLogout={handleLogout} />}

      {/* ══════════════════════════════════════════════════════════
          CART DRAWER
      ══════════════════════════════════════════════════════════ */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-[70] flex justify-end"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          id="cart_drawer_mask"
          onClick={(e) => { if (e.target === e.currentTarget) setIsCartOpen(false); }}
        >
          <div
            className="w-full max-w-md h-full flex flex-col p-6 animate-slide-up glass glass-shine"
            style={{ borderInlineStart: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
            id="cart_drawer_panel"
          >
            <div className="flex justify-between items-center mb-6" id="cart_header" dir="rtl">
              <h3 className="text-headline-sm flex items-center gap-2" style={{ color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}>
                <ShoppingBag size={22} className="text-[var(--color-primary-fixed)]" strokeWidth={2} />
                سلة وجباتي
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/10"
                style={{ background: 'var(--color-surface-container-high)' }}
                id="cart_close_btn"
              >
                <X size={18} className="text-[var(--color-on-surface)]" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5" id="cart_items_scroll">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-6 text-center animate-fade-in" id="cart_empty" dir="rtl">
                  <div
                    className="w-24 h-24 rounded-3xl flex items-center justify-center glass-shine"
                    style={{ background: 'rgba(163,249,91,0.05)', border: '1px solid rgba(163,249,91,0.12)', boxShadow: '0 0 48px rgba(163,249,91,0.06)' }}
                  >
                    <ShoppingBag size={42} strokeWidth={1.25} style={{ color: 'rgba(163,249,91,0.3)' }} />
                  </div>
                  <div>
                    <p style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.01em' }}>سلتك خالية</p>
                    <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', lineHeight: 1.55 }}>تصفح المتاجر وأضف ما يشتهيك!</p>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="px-6 h-11 rounded-2xl font-bold cursor-pointer transition-all active:scale-95"
                    style={{ background: 'var(--color-primary-fixed)', color: '#0c2000', fontSize: '14px', border: 'none', boxShadow: '0 0 20px rgba(163,249,91,0.3)' }}
                  >
                    تصفح المتاجر
                  </button>
                </div>
              ) : (
                cart.map((item, idx) => {
                  const price    = item.product.price + (item.variant ? item.variant.price_modifier : 0);
                  const photoUrl = (item.product as any).product_images?.[0]?.url || getCartItemPhoto(item.product.name);
                  return (
                    <div
                      key={idx}
                      className="glass glass-hover flex items-center gap-3 p-3 rounded-2xl"
                      id={`cart_row_${idx}`}
                      dir="rtl"
                    >
                      {/* Food photo thumbnail — right side in RTL */}
                      <div
                        className="w-[68px] h-[68px] rounded-xl overflow-hidden flex-shrink-0"
                        style={{ border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <img src={photoUrl} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>

                      {/* Text */}
                      <div className="flex-1 text-right min-w-0">
                        <h4 className="font-bold truncate" style={{ color: 'var(--color-on-surface)', fontSize: '14px', letterSpacing: '-0.01em' }}>
                          {item.product.name}
                        </h4>
                        {item.variant && (
                          <span className="block mt-0.5" style={{ color: 'var(--color-primary-fixed)', fontSize: '12px' }}>({item.variant.name})</span>
                        )}
                        <span className="font-bold mt-2 block" style={{ color: 'var(--color-primary-fixed)', fontSize: '15px', letterSpacing: '-0.01em' }}>
                          {money(price)}
                        </span>
                      </div>

                      {/* Vertical qty stepper */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleUpdateProductQty(item.product.id, item.variant?.id ?? null, 1)}
                          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                          style={{ color: 'var(--color-primary-fixed)', fontSize: '18px', background: 'rgba(163,249,91,0.10)', border: '1px solid rgba(163,249,91,0.22)', lineHeight: 1 }}
                        >+</button>
                        <span className="font-bold" style={{ color: 'white', fontSize: '13px' }}>{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateProductQty(item.product.id, item.variant?.id ?? null, -1)}
                          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                          style={{ color: item.quantity === 1 ? '#f87171' : 'var(--color-on-surface-variant)', fontSize: '18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', lineHeight: 1 }}
                        >−</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} id="cart_footer" dir="rtl">

                {/* Coupon input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="كود الخصم"
                    dir="rtl"
                    className="flex-1 h-11 px-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '13px', outline: 'none', caretColor: 'var(--color-primary-fixed)' }}
                  />
                  <button
                    className="h-11 px-4 rounded-xl font-bold cursor-pointer transition-all active:scale-95"
                    style={{ background: 'rgba(163,249,91,0.07)', border: '1px solid rgba(163,249,91,0.15)', color: 'var(--color-primary-fixed)', fontSize: '13px', whiteSpace: 'nowrap' }}
                  >
                    تطبيق
                  </button>
                </div>

                {/* Totals block */}
                <div className="glass rounded-xl p-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span style={{ color: 'var(--color-primary-fixed)', fontWeight: 600, fontSize: '14px' }}>{money(getCartSubtotal())}</span>
                    <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>المجموع الفرعي</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '13px' }}>مجاني</span>
                    <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>رسوم التوصيل</span>
                  </div>
                  <div className="flex justify-between items-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--color-primary-fixed)', fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em', textShadow: '0 0 16px rgba(163,249,91,0.3)' }}>{money(getCartSubtotal())}</span>
                    <span style={{ color: 'white', fontWeight: 700, fontSize: '14px' }}>الإجمالي</span>
                  </div>
                </div>

                {/* Checkout CTA */}
                <button
                  onClick={handleNavigateToCheckout}
                  className="w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] neon-glow"
                  style={{ background: 'var(--color-primary-fixed)', color: '#0c2000', fontSize: '16px' }}
                  id="checkout_btn"
                >
                  <ChevronRight size={20} strokeWidth={2.5} />
                  المتابعة وإتمام الدفع
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          NOTIFICATION DRAWER
      ══════════════════════════════════════════════════════════ */}
      {isNotifOpen && (
        <div
          className="fixed inset-0 z-[70] flex justify-end"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          id="notif_drawer_mask"
          onClick={(e) => { if (e.target === e.currentTarget) setIsNotifOpen(false); }}
        >
          <div
            className="w-full max-w-md h-full flex flex-col p-6 animate-slide-up glass glass-shine"
            style={{ borderInlineStart: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
            id="notif_drawer_panel"
          >
            <div className="flex justify-between items-center mb-6" id="notif_header" dir="rtl">
              <h3 className="text-headline-sm flex items-center gap-2" style={{ color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}>
                <Bell size={22} className="text-[var(--color-primary-fixed)]" strokeWidth={2} />
                الإشعارات
              </h3>
              <button
                onClick={() => setIsNotifOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/10"
                style={{ background: 'var(--color-surface-container-high)' }}
                id="notif_close_btn"
              >
                <X size={18} className="text-[var(--color-on-surface)]" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3" id="notif_list_scroll">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-6 text-center animate-fade-in" id="notif_empty" dir="rtl">
                  <div
                    className="w-24 h-24 rounded-3xl flex items-center justify-center glass-shine"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 40px rgba(0,0,0,0.3)' }}
                  >
                    <BellOff size={40} strokeWidth={1.25} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  </div>
                  <div>
                    <p style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.01em' }}>لا توجد إشعارات</p>
                    <p style={{ color: 'var(--color-on-surface-variant)', fontSize: '14px', lineHeight: 1.55 }}>ستظهر هنا تحديثات طلباتك وعروضك الحصرية</p>
                  </div>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="glass glass-hover p-4 rounded-xl" dir="rtl">
                    <p style={{ color: 'var(--color-on-surface)', fontSize: '14px', lineHeight: 1.55 }}>{notif.message}</p>
                    {notif.created_at && (
                      <p className="mt-1.5" style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px', letterSpacing: '0.02em' }}>
                        {new Date(notif.created_at).toLocaleString('ar-SA')}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          COUNTRY PICKER (multi-country)
      ══════════════════════════════════════════════════════════ */}
      {countryPickerOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setCountryPickerOpen(false); }}
          id="country_picker_mask"
        >
          <div className="w-full max-w-md glass glass-shine animate-slide-up" style={{ borderRadius: '24px 24px 0 0', borderBottom: 'none', padding: '20px' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: 'var(--color-on-surface)', fontSize: '17px', fontWeight: 800 }}>
                {lang === 'ar' ? 'اختر دولتك' : 'Choose your country'}
              </h3>
              <button onClick={() => setCountryPickerOpen(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface-container-high)' }}>
                <X size={18} className="text-[var(--color-on-surface)]" strokeWidth={2} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {COUNTRY_LIST.map((c) => {
                const active = c.code === country.code;
                return (
                  <button
                    key={c.code}
                    onClick={() => { setCountry(c.code, { manual: true }); setCountryPickerOpen(false); }}
                    className="flex items-center gap-2 px-3 py-3 rounded-xl active:scale-95 transition-transform"
                    style={{ background: active ? 'rgba(163,249,91,0.10)' : 'rgba(255,255,255,0.04)', border: active ? '1px solid var(--color-primary-fixed)' : '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '20px' }}>{c.flag}</span>
                    <span style={{ flex: 1, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                      <span className="block" style={{ color: active ? 'var(--color-primary-fixed)' : 'white', fontSize: '14px', fontWeight: 700 }}>
                        {lang === 'ar' ? c.nameAr : c.nameEn}
                      </span>
                      <span className="block" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>{c.currency.code}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
