// ─────────────────────────────────────────────────────────────────────────────
// App Runtime Preview — the Application Studio's "Live App" mode.
//
// It mounts the ACTUAL production customer screens (the very same components the live
// customer app renders — HomeScreen, WalletScreen, ProfileScreen, OrdersList,
// DiscoverScreen) inside the device frame, driven by a sandbox demo identity. This is
// not a mockup, screenshot, or placeholder — it is the real React application running
// inside the Studio.
//
// Scope & honesty:
//  · Customer content screens are cycle-free (they do not import features/admin), so they
//    mount here safely. Merchant/Driver apps import back into admin (a cycle Guardian
//    forbids), so those channels keep their real experience-surface canvas instead — no
//    fake screen is shown for them.
//  · Screens that require external navigation ids (a specific branch/cart) are not mounted
//    here; `hasRuntimeScreen` returns false and the caller shows the experience canvas.
//  · Heavy screens are lazy-loaded (matching App.tsx) and wrapped in a CONTAINED error
//    boundary so a screen that throws degrades to a clear message — never crashes the Studio.
// ─────────────────────────────────────────────────────────────────────────────
import React, { Suspense } from 'react';
import { Loader2, MonitorSmartphone } from 'lucide-react';
import type { ChannelId } from '../../experience-channels/channels';
import { DEMO_CONTENT_ENABLED } from '../../config/runtime';

// The real production screens — same modules the live app lazy-loads (App.tsx).
const HomeScreen = React.lazy(() => import('../home/HomeScreen').then(m => ({ default: m.HomeScreen })));
const WalletScreen = React.lazy(() => import('../wallet/WalletScreen').then(m => ({ default: m.WalletScreen })));
const ProfileScreen = React.lazy(() => import('../profile/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const OrdersList = React.lazy(() => import('../orders/OrdersList').then(m => ({ default: m.OrdersList })));
const DiscoverScreen = React.lazy(() => import('../discover/DiscoverScreen').then(m => ({ default: m.DiscoverScreen })));

// Sandbox demo customer (auth.service DEMO_ACCOUNTS['+201000000001']) — a real seeded
// identity so the real screens fetch real sandbox data, never fabricated content.
const DEMO_CUSTOMER = { id: '11111111-0000-0000-0000-000000000001', phone_number: '+201000000001', role: 'customer' };
const noop = () => {};

// Which customer screens have a real runtime component mounted here.
const RUNTIME_CUSTOMER = new Set(['home', 'wallet', 'profile', 'orders', 'search', 'categories']);

/** Does a real production screen mount for this channel+screen? (else caller shows canvas) */
export function hasRuntimeScreen(channel: ChannelId, screenId: string): boolean {
  return channel === 'customer' && RUNTIME_CUSTOMER.has(screenId);
}

// Contained error boundary — a screen that throws shows a message INSIDE the frame,
// never reloads or crashes the Studio.
class ScreenBoundary extends React.Component<{ screenId: string; children: React.ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidUpdate(prev: { screenId: string }) { if (prev.screenId !== this.props.screenId && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>Live screen error</p>
        <p style={{ fontSize: 11, marginTop: 6, direction: 'ltr' }}>{String(this.state.err.message || this.state.err)}</p>
      </div>
    );
    return this.props.children as React.ReactElement;
  }
}

const DEVICE_W: Record<'desktop' | 'tablet' | 'mobile', number> = { desktop: 420, tablet: 640, mobile: 390 };

export interface AppRuntimePreviewProps {
  channel: ChannelId;
  screenId: string;
  device: 'desktop' | 'tablet' | 'mobile';
  lang: 'ar' | 'en';
}

export const AppRuntimePreview: React.FC<AppRuntimePreviewProps> = ({ channel, screenId, device, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const width = DEVICE_W[device] ?? 390;

  const screen = ((): React.ReactNode => {
    // The Live App runtime mounts real customer screens with a seeded SANDBOX identity, so
    // it renders only when demo content is enabled (sandbox). In production-data mode there
    // is no preview identity to drive a customer screen — the note below is shown instead.
    if (channel !== 'customer' || !DEMO_CONTENT_ENABLED) return null;
    const u = DEMO_CUSTOMER; // gated sandbox preview identity (registered in check-demo-isolation.cjs)
    switch (screenId) {
      case 'home': return <HomeScreen customerId={u.id} selectedCat={null} onSelectCat={noop} searchQuery="" onSearchQuery={noop} onSelectRestaurant={noop} onNavigateToWallet={noop} />;
      case 'wallet': return <WalletScreen customerId={u.id} />;
      case 'profile': return <ProfileScreen session={u} onLogout={noop} />;
      case 'orders': return <OrdersList customerId={u.id} selectedOrderIdInit={undefined} onSelectOrderBack={noop} />;
      case 'search':
      case 'categories': return <DiscoverScreen customerId={u.id} onOpenBranch={noop} />;
      default: return null;
    }
  })();

  return (
    <div id="app_runtime_preview" data-channel={channel} data-screen={screenId} dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ width: '100%', display: 'grid', justifyItems: 'center', gap: 8 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 700, color: 'var(--color-primary-fixed,#a3f95b)' }}>
        <MonitorSmartphone size={13} />{L('التطبيق الحقيقي — مكوّنات الإنتاج', 'Live app runtime — production components')}
      </div>
      {screen ? (
        <div style={{ width, maxWidth: '100%', height: 720, maxHeight: '72vh', overflow: 'auto', borderRadius: 26, border: '1px solid var(--color-outline-variant)', background: 'var(--color-background,#0a0f0c)', boxShadow: '0 24px 70px -34px rgba(0,0,0,.7)', position: 'relative', contain: 'layout paint' }}>
          <ScreenBoundary screenId={screenId}>
            <Suspense fallback={<div style={{ height: '100%', display: 'grid', placeItems: 'center' }}><Loader2 className="animate-spin" size={28} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} /></div>}>
              {screen}
            </Suspense>
          </ScreenBoundary>
        </div>
      ) : (
        <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--color-on-surface-variant)', maxWidth: 360 }}>
          <p style={{ fontSize: 12.5, margin: 0 }}>{L('لا يوجد وقت تشغيل مباشر لهذه الشاشة هنا.', 'No live runtime is mounted for this screen here.')}</p>
          <p style={{ fontSize: 11, margin: '6px 0 0', opacity: 0.8 }}>{L('يظهر التشغيل الحقيقي لشاشات العميل (الرئيسية، المحفظة، الطلبات…). بدّل إلى «اللوحة» لتحرير تجارب هذه الشاشة.', 'Live runtime is available for Customer screens (Home, Wallet, Orders…). Switch to “Canvas” to author this screen’s experiences.')}</p>
        </div>
      )}
    </div>
  );
};

export default AppRuntimePreview;
