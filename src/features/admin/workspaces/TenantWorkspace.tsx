import React, { useEffect, useState } from 'react';
import { Building2, Palette, Globe, CreditCard, BarChart3, Power, PauseCircle, Archive, Save, RotateCcw, Eye, ToggleRight, Image, MessageSquare } from 'lucide-react';
import { Drawer } from '../../../components/ui/Modal';
import { MetricCard, EmptyStateBox, StatusBadge } from '../../../components/admin/EnterpriseUI';
import { toast } from '../../../components/ui/feedback';
import { WsHeader, WsTabBar, wsCard, type WsTab } from './shell';
import { tenantService } from '../../../services/tenant.service';
import { adminCrud } from '../../../services/admin-crud.service';

const TABS: WsTab[] = [
  { k: 'brand', ar: 'الهوية', en: 'Brand', Icon: Palette },
  { k: 'theme', ar: 'السمة', en: 'Theme', Icon: Image },
  { k: 'apps', ar: 'التطبيقات والنطاق', en: 'Apps & Domain', Icon: Globe },
  { k: 'features', ar: 'الميزات', en: 'Features', Icon: ToggleRight },
  { k: 'templates', ar: 'القوالب', en: 'Templates', Icon: MessageSquare },
  { k: 'usage', ar: 'الاستخدام', en: 'Usage', Icon: BarChart3 },
];

const statusKind = (s: string) => s === 'active' ? 'success' : s === 'suspended' ? 'warning' : s === 'archived' ? 'inactive' : 'pending';
const FEATURES: { k: string; ar: string; en: string }[] = [
  { k: 'wallet', ar: 'المحفظة', en: 'Wallet' }, { k: 'loyalty', ar: 'الولاء والنقاط', en: 'Loyalty & points' },
  { k: 'scheduling', ar: 'جدولة الطلبات', en: 'Order scheduling' }, { k: 'tips', ar: 'الإكراميات', en: 'Tips' },
  { k: 'live_tracking', ar: 'التتبّع المباشر', en: 'Live tracking' }, { k: 'ratings', ar: 'التقييمات', en: 'Ratings' },
  { k: 'referrals', ar: 'الإحالات', en: 'Referrals' }, { k: 'subscriptions', ar: 'الاشتراكات', en: 'Subscriptions' },
];

const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 12px', borderRadius: 10, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', fontSize: 13, outline: 'none' };
const lblS: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: 4, display: 'block' };

/** Tenant workspace — full White-Label Brand Manager: identity, logos, theme (live apply), apps, features, templates. */
export const TenantWorkspace: React.FC<{ tenant: any; lang: 'ar' | 'en'; onClose: () => void; onChanged?: () => void }> = ({ tenant, lang, onClose, onChanged }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tab, setTab] = useState('brand');
  const [status, setStatus] = useState<string>(tenant.status || 'draft');
  const [usage, setUsage] = useState<{ orders: number; drivers: number; merchants: number; customers: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ ...tenant });
  const [features, setFeatures] = useState<Record<string, boolean>>(() => {
    try { return tenant.features_json ? JSON.parse(tenant.features_json) : { wallet: true, loyalty: true, scheduling: true, tips: true, live_tracking: true, ratings: true, referrals: false, subscriptions: false }; }
    catch { return {}; }
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    let alive = true;
    (async () => {
      const [o, d, m, c] = await Promise.all([
        adminCrud('orders').list().then(r => r.data.length).catch(() => 0),
        adminCrud('drivers').list().then(r => r.data.length).catch(() => 0),
        adminCrud('merchants').list().then(r => r.data.length).catch(() => 0),
        adminCrud('customers').list().then(r => r.data.length).catch(() => 0),
      ]);
      if (alive) setUsage({ orders: o, drivers: d, merchants: m, customers: c });
    })();
    return () => { alive = false; };
  }, [tenant.id]);

  const Field = ({ k, label, ph, type }: { k: string; label: string; ph?: string; type?: string }) => (
    <label className="block"><span style={lblS}>{label}</span>
      <input style={inp} type={type || 'text'} value={form[k] ?? ''} placeholder={ph} dir={type === 'tel' || /url|email|package|bundle|domain/.test(k) ? 'ltr' : undefined}
        onChange={e => set(k, e.target.value)} /></label>
  );
  const Color = ({ k, label }: { k: string; label: string }) => (
    <label className="block"><span style={lblS}>{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={form[k] || '#a3f95b'} onChange={e => set(k, e.target.value)} style={{ width: 38, height: 38, padding: 0, border: '1px solid var(--color-outline-variant)', borderRadius: 10, background: 'transparent', cursor: 'pointer' }} />
        <input style={{ ...inp, flex: 1 }} value={form[k] ?? ''} placeholder="#a3f95b" dir="ltr" onChange={e => set(k, e.target.value)} />
      </span></label>
  );

  const save = async () => {
    setSaving(true);
    const patch: Record<string, any> = { ...form, features_json: JSON.stringify(features) };
    delete patch.id; delete patch.created_at;
    const { error } = await tenantService.saveBranding(tenant.id, patch);
    setSaving(false);
    if (error) return toast.error(L('تعذّر حفظ الهوية', 'Could not save branding'));
    toast.success(L('تم حفظ هوية العلامة', 'Brand identity saved')); onChanged?.();
  };
  const applyTheme = () => { tenantService.applyTheme({ ...form }); toast.success(L('تم تطبيق سمة العلامة (معاينة حيّة)', 'Brand theme applied (live preview)')); };
  const restore = () => { tenantService.restoreDefaultTheme(); toast.success(L('تمت استعادة سمة HAAT NOW', 'HAAT NOW theme restored')); };

  const transition = async (fn: () => Promise<{ error: any }>, next: string, okAr: string, okEn: string) => {
    const { error } = await fn();
    if (error) { toast.error(L('تعذّر تغيير حالة المستأجر', 'Could not change tenant status')); return; }
    setStatus(next); toast.success(L(okAr, okEn)); onChanged?.();
  };

  return (
    <Drawer open onClose={onClose} heightClass="max-h-[92vh]" title={L('مدير العلامة البيضاء', 'White-Label Brand Manager')}
      footer={
        <div className="flex gap-2 flex-wrap">
          <button onClick={save} disabled={saving} id="tenant_save_btn" className="flex-1 min-w-[120px] h-11 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Save size={15} />{saving ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}</button>
          {status !== 'active' && <button onClick={() => transition(() => tenantService.activate(tenant.id), 'active', 'تم تفعيل المستأجر', 'Tenant activated')} className="h-11 px-3 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}><Power size={15} />{L('تفعيل', 'Activate')}</button>}
          {status === 'active' && <button onClick={() => transition(() => tenantService.suspend(tenant.id), 'suspended', 'تم تعليق المستأجر', 'Tenant suspended')} className="h-11 px-3 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={wsCard}><PauseCircle size={15} />{L('تعليق', 'Suspend')}</button>}
          {status !== 'archived' && <button onClick={() => transition(() => tenantService.archive(tenant.id), 'archived', 'تمت أرشفة المستأجر', 'Tenant archived')} className="h-11 px-3 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={wsCard}><Archive size={15} />{L('أرشفة', 'Archive')}</button>}
          <button onClick={onClose} className="h-11 px-3 rounded-xl text-sm font-bold cursor-pointer" style={wsCard}>{L('إغلاق', 'Close')}</button>
        </div>
      }>
      <div className="px-4 pb-4 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'} id="tenant_workspace">
        <WsHeader Icon={Building2} title={form.brand_name || L('بدون اسم', 'Unnamed')} subtitle={tenant.slug || form.subdomain}
          badge={<StatusBadge kind={statusKind(status) as any} label={status} />} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <MetricCard label={L('الخطة', 'Plan')} value={form.plan || '—'} Icon={CreditCard} accent="#9ed442" />
          <MetricCard label={L('الحالة', 'Status')} value={status} />
          <MetricCard label={L('الدولة', 'Country')} value={form.country_code || '—'} Icon={Globe} />
          <MetricCard label={L('اللون', 'Color')} value={<span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded" style={{ background: form.primary_color || '#a3f95b' }} />{form.primary_color || '#a3f95b'}</span>} />
        </div>
        <WsTabBar tabs={TABS} active={tab} onChange={setTab} lang={lang} />

        {tab === 'brand' && (
          <div className="grid grid-cols-2 gap-3">
            <Field k="brand_name" label={L('اسم العلامة', 'Brand name')} ph="HAAT NOW" />
            <Field k="app_name" label={L('اسم التطبيق', 'App name')} ph="HAAT" />
            <Field k="company_name" label={L('اسم الشركة', 'Company name')} ph="HAAT Delivery LLC" />
            <Field k="support_email" label={L('بريد الدعم', 'Support email')} ph="support@brand.com" />
            <Field k="support_phone" label={L('هاتف الدعم', 'Support phone')} ph="+20…" type="tel" />
            <Field k="country_code" label={L('الدولة', 'Country')} ph="EG" />
            <div className="col-span-2 pt-1" style={{ borderTop: '1px solid var(--color-outline-variant)' }} />
            <Field k="logo_url" label={L('الشعار (URL)', 'Logo URL')} ph="https://…/logo.svg" />
            <Field k="dark_logo_url" label={L('شعار داكن', 'Dark logo')} ph="https://…/logo-dark.svg" />
            <Field k="light_logo_url" label={L('شعار فاتح', 'Light logo')} ph="https://…/logo-light.svg" />
            <Field k="favicon_url" label={L('أيقونة الموقع', 'Favicon')} ph="https://…/favicon.png" />
            <Field k="splash_url" label={L('شاشة البداية', 'Splash image')} ph="https://…/splash.png" />
            <Field k="app_icon_url" label={L('أيقونة التطبيق', 'App icon')} ph="https://…/icon-512.png" />
          </div>
        )}

        {tab === 'theme' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Color k="primary_color" label={L('اللون الأساسي', 'Primary')} />
              <Color k="secondary_color" label={L('اللون الثانوي', 'Secondary')} />
              <Color k="accent_color" label={L('لون التمييز', 'Accent')} />
              <Field k="font_family" label={L('الخط', 'Font family')} ph="Cairo" />
              <Field k="card_radius" label={L('استدارة البطاقات (px)', 'Card radius (px)')} ph="22" type="number" />
              <Field k="button_radius" label={L('استدارة الأزرار (px)', 'Button radius (px)')} ph="12" type="number" />
              <Field k="glass_intensity" label={L('شدة الزجاج (px)', 'Glass blur (px)')} ph="28" type="number" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={applyTheme} id="tenant_apply_theme" className="flex-1 min-w-[140px] h-11 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Eye size={15} />{L('تطبيق السمة (معاينة حيّة)', 'Apply theme (live)')}</button>
              <button onClick={restore} className="h-11 px-4 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={wsCard}><RotateCcw size={15} />{L('استعادة HAAT', 'Restore HAAT')}</button>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('«تطبيق السمة» يطبّق ألوان العلامة وخطّها واستداراتها على الواجهة فورًا عبر محرّك التصميم الموحّد (نفس applyDesign).', 'Apply theme writes the brand colors/font/radii to the live UI via the unified design engine (same applyDesign).')}</p>
          </div>
        )}

        {tab === 'apps' && (
          <div className="grid grid-cols-2 gap-3">
            <Field k="subdomain" label={L('النطاق الفرعي', 'Subdomain')} ph="brand" />
            <Field k="custom_domain" label={L('النطاق المخصّص', 'Custom domain')} ph="app.brand.com" />
            <Field k="package_name" label={L('اسم حزمة أندرويد', 'Android package')} ph="com.brand.app" />
            <Field k="bundle_id" label={L('معرّف حزمة iOS', 'iOS bundle ID')} ph="com.brand.app" />
            <div className="col-span-2 pt-1" style={{ borderTop: '1px solid var(--color-outline-variant)' }} />
            <Field k="store_title" label={L('عنوان المتجر', 'Store title')} ph="Brand — Food Delivery" />
            <Field k="store_subtitle" label={L('العنوان الفرعي', 'Store subtitle')} ph="Fast delivery" />
            <label className="block col-span-2"><span style={lblS}>{L('وصف المتجر', 'Store description')}</span>
              <textarea rows={3} style={{ ...inp, height: 'auto', padding: 10, resize: 'vertical' }} value={form.store_description ?? ''} onChange={e => set('store_description', e.target.value)} /></label>
          </div>
        )}

        {tab === 'features' && (
          <div className="grid grid-cols-2 gap-2">
            {FEATURES.map(f => {
              const on = !!features[f.k];
              return (
                <button key={f.k} onClick={() => setFeatures(s => ({ ...s, [f.k]: !s[f.k] }))}
                  className="flex items-center justify-between px-3 h-12 rounded-xl text-sm font-bold cursor-pointer"
                  style={{ background: 'var(--color-surface-container-high)', border: `1px solid ${on ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)'}`, color: 'var(--color-on-surface)' }}>
                  {L(f.ar, f.en)}
                  <span className="w-10 h-6 rounded-full flex items-center px-0.5 transition-all" style={{ background: on ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)', justifyContent: on ? 'flex-end' : 'flex-start' }}>
                    <span className="w-5 h-5 rounded-full" style={{ background: '#fff' }} />
                  </span>
                </button>
              );
            })}
            <p className="col-span-2 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('تُحفظ مفاتيح الميزات لكل مستأجر (features_json) وتتحكّم في تفعيل وحدات المنتج لتلك العلامة.', 'Feature flags persist per tenant (features_json) and gate product modules for that brand.')}</p>
          </div>
        )}

        {tab === 'templates' && (
          <div className="space-y-3">
            <label className="block"><span style={lblS}>{L('قالب بريد الترحيب', 'Welcome email template')}</span>
              <textarea rows={3} style={{ ...inp, height: 'auto', padding: 10, resize: 'vertical' }} value={form.tpl_email_welcome ?? ''} placeholder={L('مرحبًا بك في {{brand}}…', 'Welcome to {{brand}}…')} onChange={e => set('tpl_email_welcome', e.target.value)} /></label>
            <label className="block"><span style={lblS}>{L('قالب رسالة OTP', 'OTP SMS template')}</span>
              <textarea rows={2} style={{ ...inp, height: 'auto', padding: 10, resize: 'vertical' }} value={form.tpl_sms_otp ?? ''} placeholder={L('رمز {{brand}}: {{code}}', '{{brand}} code: {{code}}')} onChange={e => set('tpl_sms_otp', e.target.value)} /></label>
            <label className="block"><span style={lblS}>{L('قالب إشعار الطلب', 'Order push template')}</span>
              <textarea rows={2} style={{ ...inp, height: 'auto', padding: 10, resize: 'vertical' }} value={form.tpl_push_order ?? ''} placeholder={L('طلبك #{{id}} في الطريق', 'Your order #{{id}} is on the way')} onChange={e => set('tpl_push_order', e.target.value)} /></label>
            <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('تدعم القوالب المتغيّرات مثل {{brand}} و{{code}} و{{id}}.', 'Templates support variables like {{brand}}, {{code}}, {{id}}.')}</p>
          </div>
        )}

        {tab === 'usage' && (
          usage ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <MetricCard label={L('الطلبات', 'Orders')} value={usage.orders} />
                <MetricCard label={L('المندوبون', 'Drivers')} value={usage.drivers} />
                <MetricCard label={L('التجّار', 'Merchants')} value={usage.merchants} />
                <MetricCard label={L('العملاء', 'Customers')} value={usage.customers} />
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                {L('إجماليات المنصّة — تصبح مقصورة على المستأجر بعد تفعيل عزل البيانات (tenant_id + RLS).', 'Platform totals — become per-tenant once data isolation (tenant_id + RLS) is enabled.')}
              </p>
            </div>
          ) : <EmptyStateBox Icon={BarChart3} title={L('جارٍ التحميل…', 'Loading…')} />
        )}
      </div>
    </Drawer>
  );
};
