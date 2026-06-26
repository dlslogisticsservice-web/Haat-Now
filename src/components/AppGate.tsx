import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Wrench, ArrowUpCircle } from 'lucide-react';
import { releaseService, ReleaseGate } from '../services/release.service';
import { APP_VERSION, isVersionBelow } from '../config/version';
import { useAppConfig } from '../contexts/AppConfigContext';

/** Online/offline detector (navigator + events). */
function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

const screen: React.CSSProperties = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', background: 'var(--color-background)' };

/**
 * Release gate — wraps the app. Blocks with a Maintenance or Force-Update screen
 * when the store-side `settings` say so, and shows an offline banner. Real config
 * from `releaseService` (public.settings); fail-open so a config error never bricks the app.
 */
export const AppGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang } = useAppConfig();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const online = useOnline();
  const [gate, setGate] = useState<ReleaseGate | null>(null);

  useEffect(() => {
    let alive = true;
    releaseService.getGate().then(g => { if (alive) setGate(g); }).catch(() => { if (alive) setGate(null); });
    return () => { alive = false; };
  }, []);

  const mustUpdate = !!gate?.minVersion && isVersionBelow(APP_VERSION, gate.minVersion);
  const storeUrl = /iphone|ipad|ipod/i.test(navigator.userAgent) ? gate?.storeUrlIos : gate?.storeUrlAndroid;

  if (gate?.maintenance) {
    return (
      <div style={screen} dir={lang === 'ar' ? 'rtl' : 'ltr'} id="maintenance_screen">
        <Wrench size={48} color="var(--color-primary-fixed)" />
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{L('قيد الصيانة', 'Under maintenance')}</h1>
        <p className="max-w-sm text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{lang === 'ar' ? gate.maintenanceMessageAr : gate.maintenanceMessageEn}</p>
        <button onClick={() => location.reload()} className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-bold cursor-pointer" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
          <RefreshCw size={16} />{L('إعادة المحاولة', 'Retry')}
        </button>
      </div>
    );
  }

  if (mustUpdate) {
    return (
      <div style={screen} dir={lang === 'ar' ? 'rtl' : 'ltr'} id="force_update_screen">
        <ArrowUpCircle size={48} color="var(--color-primary-fixed)" />
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{L('تحديث مطلوب', 'Update required')}</h1>
        <p className="max-w-sm text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          {L('يتوفّر إصدار جديد مطلوب لمواصلة استخدام التطبيق.', 'A newer version is required to keep using the app.')}
        </p>
        {storeUrl ? (
          <a href={storeUrl} className="inline-flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-bold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', textDecoration: 'none' }}>
            <ArrowUpCircle size={16} />{L('تحديث الآن', 'Update now')}
          </a>
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{L('يرجى التحديث من متجر التطبيقات.', 'Please update from your app store.')}</p>
        )}
      </div>
    );
  }

  return (
    <>
      {!online && (
        <div id="offline_banner" className="fixed top-0 inset-x-0 z-[300] flex items-center justify-center gap-2 py-1.5 text-xs font-bold"
          style={{ background: '#f87171', color: '#fff' }} role="status">
          <WifiOff size={13} />{L('لا يوجد اتصال بالإنترنت', 'No internet connection')}
        </div>
      )}
      {children}
    </>
  );
};
