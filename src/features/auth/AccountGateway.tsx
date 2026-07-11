import React from 'react';
import { User, Store, Bike, Building2, Globe2, ShieldCheck, ChevronRight, Lock } from 'lucide-react';
import { HaatLogo } from '../website/icons';

// ─────────────────────────────────────────────────────────────────────────────
// Account-type gateway — the FIRST screen of the auth flow. It NEVER signs anyone in
// and NEVER opens Super Admin directly: the user picks an account type, then continues
// to the EXISTING authentication screen (phone/OTP). Sign-in and role are still decided
// by the existing RBAC after login — this screen only sets intent/context. No duplicate auth.
//
// PUBLIC mode exposes ONLY customer/merchant/driver. Internal administration roles
// (franchise, country admin, super admin) live behind the private Admin Portal entry
// (admin./console. host, or ?console=1) and are never advertised on the public site.
// ─────────────────────────────────────────────────────────────────────────────

export type AccountType = 'customer' | 'merchant' | 'driver' | 'franchise' | 'country_admin' | 'admin';
export type GatewayMode = 'public' | 'admin';

type Opt = { key: AccountType; icon: any; ar: string; en: string; descAr: string; descEn: string };

const PUBLIC_OPTIONS: Opt[] = [
  { key: 'customer', icon: User, ar: 'عميل', en: 'Customer', descAr: 'اطلب طعاماً وبقالة وأدوية', descEn: 'Order food, grocery & pharmacy' },
  { key: 'merchant', icon: Store, ar: 'تاجر', en: 'Merchant', descAr: 'أدر متجرك وطلباتك', descEn: 'Manage your store & orders' },
  { key: 'driver', icon: Bike, ar: 'كابتن توصيل', en: 'Driver', descAr: 'استلم الطلبات واربح', descEn: 'Accept deliveries & earn' },
];
const ADMIN_OPTIONS: Opt[] = [
  { key: 'franchise', icon: Building2, ar: 'امتياز', en: 'Franchise', descAr: 'أدر امتيازك في مدينتك', descEn: 'Run your city franchise' },
  { key: 'country_admin', icon: Globe2, ar: 'مدير دولة', en: 'Country Admin', descAr: 'أدر العمليات في بلدك', descEn: 'Operate your country' },
  { key: 'admin', icon: ShieldCheck, ar: 'مدير عام', en: 'Super Admin', descAr: 'إدارة المنصّة بالكامل', descEn: 'Full platform control' },
];

/** Detect whether the private admin portal is being requested (subdomain or ?console/?portal). */
export function detectGatewayMode(): GatewayMode {
  try {
    const h = window.location.hostname.toLowerCase();
    if (h.startsWith('admin.') || h.startsWith('console.')) return 'admin';
    const q = new URLSearchParams(window.location.search);
    const p = (q.get('portal') || q.get('console') || '').toLowerCase();
    if (p === 'admin' || p === '1' || p === 'console' || q.has('console')) return 'admin';
  } catch { /* ignore */ }
  return 'public';
}

export const AccountGateway: React.FC<{ lang: 'ar' | 'en'; mode?: GatewayMode; onChoose: (t: AccountType) => void; onEnterAdmin?: () => void }> = ({ lang, mode = 'public', onChoose, onEnterAdmin }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const isAdmin = mode === 'admin';
  const OPTIONS = isAdmin ? ADMIN_OPTIONS : PUBLIC_OPTIONS;
  return (
    <div dir={dir} id="account_gateway" data-mode={mode} style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 12%, transparent), var(--color-background,#0a0f0c) 60%)', color: 'var(--color-on-surface,#e8ebe3)', fontFamily: 'var(--font-family, Cairo, system-ui, sans-serif)' }}>
      <div style={{ width: 'min(560px, 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><HaatLogo height={38} /></div>
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 10, fontSize: 12, fontWeight: 800, letterSpacing: '.04em', color: 'var(--color-primary-fixed,#a3f95b)' }}>
            <Lock size={13} />{L('بوابة الإدارة الخاصة', 'Private admin portal')}
          </div>
        )}
        <h1 style={{ textAlign: 'center', fontSize: 'clamp(24px,5vw,30px)', fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 6px' }}>{isAdmin ? L('دخول فريق الإدارة', 'Administration sign-in') : L('اختر نوع الحساب', 'Choose your account')}</h1>
        <p style={{ textAlign: 'center', color: 'var(--color-on-surface-variant,#a7b0a6)', margin: '0 0 22px', fontSize: 15 }}>{isAdmin ? L('هذه البوابة مخصّصة لفريق العمل الداخلي.', 'This portal is for internal staff only.') : L('اختر كيف تريد الدخول، ثم سجّل الدخول.', 'Pick how you want to sign in — you’ll authenticate next.')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {OPTIONS.map(o => (
            <button key={o.key} id={`acct_${o.key}`} data-account={o.key} onClick={() => onChoose(o.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'start', padding: '16px 16px', borderRadius: 16, cursor: 'pointer', border: '1px solid var(--color-outline-variant,#2a3330)', background: 'color-mix(in srgb, var(--color-surface-container,#10160f) 80%, transparent)', color: 'inherit', transition: 'transform .15s ease, border-color .15s ease, background .15s ease' }}
              onMouseEnter={e => { const t = e.currentTarget; t.style.transform = 'translateY(-2px)'; t.style.borderColor = 'var(--color-primary-fixed,#a3f95b)'; }}
              onMouseLeave={e => { const t = e.currentTarget; t.style.transform = 'none'; t.style.borderColor = 'var(--color-outline-variant,#2a3330)'; }}>
              <span aria-hidden="true" style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, display: 'grid', placeItems: 'center', color: 'var(--color-primary-fixed,#a3f95b)', background: 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 28%, transparent)' }}><o.icon size={22} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 15.5 }}>{L(o.ar, o.en)}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-on-surface-variant,#a7b0a6)', marginTop: 2 }}>{L(o.descAr, o.descEn)}</span>
              </span>
              <ChevronRight size={18} style={{ color: 'var(--color-on-surface-variant,#a7b0a6)', transform: dir === 'rtl' ? 'scaleX(-1)' : 'none' }} />
            </button>
          ))}
        </div>
        <p style={{ textAlign: 'center', color: 'var(--color-on-surface-variant,#a7b0a6)', fontSize: 12, marginTop: 20 }}>{L('يتم تحديد صلاحياتك بأمان بعد تسجيل الدخول.', 'Your access is set securely by permissions after you sign in.')}</p>
        {!isAdmin && onEnterAdmin && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button id="gateway_admin_link" onClick={onEnterAdmin}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant,#a7b0a6)', fontSize: 12.5, fontWeight: 700, opacity: 0.8 }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--color-primary-fixed,#a3f95b)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.color = 'var(--color-on-surface-variant,#a7b0a6)'; }}>
              <Lock size={12} />{L('عضو في الفريق؟ بوابة الإدارة', 'Team member? Admin portal')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
