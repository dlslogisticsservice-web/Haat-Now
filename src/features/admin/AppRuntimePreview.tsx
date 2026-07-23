// ─────────────────────────────────────────────────────────────────────────────
// App Runtime Preview — the Application Studio's "Live App" mode.
//
// It renders the REAL application inside the device frame, but the Studio no longer imports
// any customer screen. All rendering goes through the Runtime abstraction: it builds a
// RuntimeContext, asks the Runtime Registry for the channel's adapter, and mounts the
// adapter's lazy screen. The customer screens live behind the Customer Runtime Adapter
// (runtime/adapters/customer.adapter) — one render path, no placeholders, no duplication.
//
// Scope & honesty (unchanged from M1): real screens mount only with a preview identity,
// which exists only in sandbox (DEMO_CONTENT_ENABLED) — never in production-data mode.
// Merchant/Driver adapters are not registered yet (M5); for those channels getRuntime
// returns undefined and the honest note is shown, never a fake screen.
// ─────────────────────────────────────────────────────────────────────────────
import React, { Suspense, useMemo } from 'react';
import { Loader2, MonitorSmartphone } from 'lucide-react';
import type { ChannelId } from '../../experience-channels/channels';
import { DEMO_CONTENT_ENABLED } from '../../config/runtime';
import { getRuntime } from '../../runtime/registry';
import type { RuntimeContext } from '../../runtime/RuntimeAdapter';
// Side-effect: registers the Customer Runtime Adapter so getRuntime('customer') resolves.
import '../../runtime/adapters/customer.adapter';

// Sandbox preview identity (registered in check-demo-isolation.cjs) — read only behind the
// DEMO_CONTENT_ENABLED gate. The adapter is identity-agnostic; the Studio supplies this.
const DEMO_CUSTOMER = { id: '11111111-0000-0000-0000-000000000001', phone: '+201000000001', role: 'customer' };

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

  // Build the runtime context. A preview identity exists only in sandbox; in production-data
  // mode there is no identity, so identity-requiring screens fall back to the note (never faked).
  const identity = DEMO_CONTENT_ENABLED ? DEMO_CUSTOMER : null;
  const ctx: RuntimeContext = { identity, locale: lang, country: 'SA', sandbox: DEMO_CONTENT_ENABLED };

  // Resolve the screen THROUGH the Runtime Registry — the only path to any app's screens.
  const adapter = getRuntime(channel);
  const screenDef = adapter?.getScreen(screenId);
  const needsIdentity = screenDef?.requires?.includes('identity') ?? false;
  const canMount = !!screenDef && (!needsIdentity || !!identity);

  // Memoize the lazy component per (channel, screenId) so it does not remount every render.
  const LazyScreen = useMemo(
    () => (canMount && screenDef ? React.lazy(async () => ({ default: await screenDef.load() })) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel, screenId, canMount],
  );

  return (
    <div id="app_runtime_preview" data-channel={channel} data-screen={screenId} dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ width: '100%', display: 'grid', justifyItems: 'center', gap: 8 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 700, color: 'var(--color-primary-fixed,#a3f95b)' }}>
        <MonitorSmartphone size={13} />{L('التطبيق الحقيقي — مكوّنات الإنتاج', 'Live app runtime — production components')}
      </div>
      {LazyScreen ? (
        <div style={{ width, maxWidth: '100%', height: 720, maxHeight: '72vh', overflow: 'auto', borderRadius: 26, border: '1px solid var(--color-outline-variant)', background: 'var(--color-background,#0a0f0c)', boxShadow: '0 24px 70px -34px rgba(0,0,0,.7)', position: 'relative', contain: 'layout paint' }}>
          <ScreenBoundary screenId={screenId}>
            <Suspense fallback={<div style={{ height: '100%', display: 'grid', placeItems: 'center' }}><Loader2 className="animate-spin" size={28} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} /></div>}>
              <LazyScreen ctx={ctx} />
            </Suspense>
          </ScreenBoundary>
        </div>
      ) : (
        <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--color-on-surface-variant)', maxWidth: 360 }}>
          <p style={{ fontSize: 12.5, margin: 0 }}>{L('لا يوجد وقت تشغيل مباشر لهذه الشاشة هنا.', 'No live runtime is mounted for this screen here.')}</p>
          <p style={{ fontSize: 11, margin: '6px 0 0', opacity: 0.8 }}>{L('يتوفّر التشغيل الحقيقي لشاشات العميل (الرئيسية، المحفظة، الطلبات…) عبر محوّل وقت تشغيل العميل. بدّل إلى «اللوحة» لتحرير تجارب هذه الشاشة.', 'Live runtime for Customer screens (Home, Wallet, Orders…) is served through the Customer Runtime Adapter. Switch to “Canvas” to author this screen’s experiences.')}</p>
        </div>
      )}
    </div>
  );
};

export default AppRuntimePreview;
