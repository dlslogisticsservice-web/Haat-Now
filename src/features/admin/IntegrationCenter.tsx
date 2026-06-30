import React, { useMemo, useState } from 'react';
import { Plug, CreditCard, MessageSquare, MapPin, Database, BarChart3, Sparkles, Webhook, Check, X, RefreshCw, ChevronDown, ShieldCheck, Lock } from 'lucide-react';
import { WorkspaceHeader, MetricCard } from '../../components/admin/EnterpriseUI';
import { toast } from '../../components/ui/feedback';
import { platformService } from '../../platform/platform.service';
import type { ProviderCategory } from '../../platform/platformModel';
import { useRbac } from '../../hooks/useRbac';

const surface: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)' };
const inp: React.CSSProperties = { width: '100%', height: 34, padding: '0 10px', borderRadius: 8, background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', fontSize: 12, outline: 'none' };

const CATEGORIES: { key: ProviderCategory; ar: string; en: string; Icon: any }[] = [
  { key: 'payment', ar: 'مزوّدو الدفع', en: 'Payment Providers', Icon: CreditCard },
  { key: 'messaging', ar: 'مزوّدو المراسلة', en: 'Messaging Providers', Icon: MessageSquare },
  { key: 'maps', ar: 'مزوّدو الخرائط', en: 'Maps Providers', Icon: MapPin },
  { key: 'storage', ar: 'مزوّدو التخزين', en: 'Storage Providers', Icon: Database },
  { key: 'analytics', ar: 'مزوّدو التحليلات', en: 'Analytics Providers', Icon: BarChart3 },
  { key: 'ai', ar: 'مزوّدو الذكاء الاصطناعي', en: 'AI Providers', Icon: Sparkles },
];

const HealthBadge: React.FC<{ status?: string; L: (a: string, e: string) => string }> = ({ status, L }) => {
  const map: Record<string, [string, string, string]> = {
    connected: ['#4ade80', 'rgba(74,222,128,0.15)', L('متّصل', 'Connected')],
    failed: ['#f87171', 'rgba(248,113,113,0.12)', L('فشل', 'Failed')],
    unknown: ['var(--color-on-surface-variant)', 'var(--color-surface-container-lowest)', L('غير مُختبَر', 'Untested')],
  };
  const [c, bg, label] = map[status || 'unknown'];
  return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: c, background: bg }}>{label}</span>;
};

/** Integration Center — unified provider registry: config, mode, connection test, health, webhooks. */
export const IntegrationCenter: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const { can } = useRbac();
  const [, force] = useState(0); const refresh = () => force(n => n + 1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const providers = platformService.providers();
  const catalog = platformService.providerCatalog();
  const webhooks = platformService.webhookLogs();

  const summary = useMemo(() => ({
    total: providers.length,
    connected: providers.filter(p => p.health?.status === 'connected').length,
    enabled: providers.filter(p => p.enabled).length,
    failed: providers.filter(p => p.health?.status === 'failed').length,
  }), [providers, webhooks]);

  if (!can('platform.integrations.manage')) {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} id="integration_center">
        <WorkspaceHeader Icon={Plug} title={L('مركز التكاملات', 'Integration Center')} subtitle={L('مزوّدو المنصّة الخارجيون', 'External platform providers')} />
        <div className="flex items-center gap-2 p-4 rounded-2xl" style={surface}><Lock size={16} style={{ color: 'var(--color-error)' }} /><span className="text-sm">{L('لا تملك صلاحية إدارة التكاملات.', 'You lack the manage-integrations permission.')}</span></div>
      </div>
    );
  }

  const test = (id: string) => { const r = platformService.testConnection(id); refresh(); r.ok ? toast.success(L('تم التحقّق من الإعداد', 'Configuration validated')) : toast.error(r.error || L('فشل الاختبار', 'Test failed')); };
  const toggle = (id: string, on: boolean) => { platformService.setProviderEnabled(id, on); refresh(); };
  const setMode = (id: string, mode: 'sandbox' | 'production') => { platformService.setProviderMode(id, mode); refresh(); };
  const setCfg = (id: string, key: string, val: string) => { platformService.setProviderConfig(id, { [key]: val }); refresh(); };

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} id="integration_center">
      <WorkspaceHeader Icon={Plug} title={L('مركز التكاملات', 'Integration Center')} subtitle={L('مصدر الحقيقة الوحيد لكل مزوّد خارجي · إعداد · اختبار اتصال · صحّة · سجلّات', 'Single source of truth for every external provider · config · test · health · logs')} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        <MetricCard label={L('المزوّدون', 'Providers')} value={summary.total} Icon={Plug} />
        <MetricCard label={L('متّصل', 'Connected')} value={summary.connected} accent="#4ade80" Icon={Check} />
        <MetricCard label={L('مُفعّل', 'Enabled')} value={summary.enabled} accent="#9ed442" Icon={ShieldCheck} />
        <MetricCard label={L('فشل', 'Failed')} value={summary.failed} accent="#f87171" Icon={X} />
      </div>

      {CATEGORIES.map(cat => {
        const items = providers.filter(p => p.category === cat.key);
        if (!items.length) return null;
        return (
          <div key={cat.key} className="mb-5">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-2"><cat.Icon size={16} style={{ color: 'var(--color-primary-fixed)' }} />{L(cat.ar, cat.en)}</h3>
            <div className="space-y-2">
              {items.map(p => {
                const def = catalog.find(d => d.id === p.id);
                const open = expanded === p.id;
                return (
                  <div key={p.id} className="rounded-2xl overflow-hidden" style={surface} id={`prov_${p.id}`}>
                    <div className="flex items-center justify-between gap-2 p-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <button onClick={() => setExpanded(open ? null : p.id)} className="flex items-center gap-1.5 cursor-pointer" style={{ background: 'none', border: 'none', color: 'var(--color-on-surface)' }}>
                          <ChevronDown size={15} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                          <span className="font-bold text-sm">{p.name}</span>
                        </button>
                        <HealthBadge status={p.health?.status} L={L} />
                        {p.mode && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)' }}>{p.mode === 'production' ? L('إنتاج', 'Production') : L('اختبار', 'Sandbox')}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => test(p.id)} id={`test_${p.id}`} className="text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1" style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }}><RefreshCw size={12} />{L('اختبار', 'Test')}</button>
                        <button onClick={() => toggle(p.id, !p.enabled)} id={`toggle_${p.id}`} className="w-11 h-6 rounded-full flex items-center px-0.5 cursor-pointer" style={{ background: p.enabled ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)', justifyContent: p.enabled ? 'flex-end' : 'flex-start' }}><span className="w-5 h-5 rounded-full" style={{ background: '#fff' }} /></button>
                      </div>
                    </div>
                    {open && (
                      <div className="px-3 pb-3 space-y-2.5" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
                        {def?.supportsMode && (
                          <div className="flex items-center gap-2 pt-2.5">
                            <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الوضع:', 'Mode:')}</span>
                            {(['sandbox', 'production'] as const).map(m => (
                              <button key={m} onClick={() => setMode(p.id, m)} className="text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer" style={p.mode === m ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : { ...surface, color: 'var(--color-on-surface)' }}>{m === 'sandbox' ? L('اختبار', 'Sandbox') : L('إنتاج', 'Production')}</button>
                            ))}
                          </div>
                        )}
                        {def && def.requiredKeys.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                            {def.requiredKeys.map(k => (
                              <label key={k} className="block"><span className="text-[10px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{k}</span>
                                <input type="password" dir="ltr" placeholder="••••••••" value={p.config?.[k] ?? ''} onChange={e => setCfg(p.id, k, e.target.value)} style={inp} /></label>
                            ))}
                          </div>
                        ) : <p className="text-[11px] pt-2" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا يتطلّب هذا المزوّد بيانات اعتماد.', 'This provider needs no credentials.')}</p>}
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                          <span>{L('آخر نجاح:', 'Last success:')} {p.health?.lastSuccess ? new Date(p.health.lastSuccess).toLocaleString(L('ar', 'en')) : '—'}</span>
                          <span>{L('آخر فشل:', 'Last failure:')} {p.health?.lastFailure ? new Date(p.health.lastFailure).toLocaleString(L('ar', 'en')) : '—'}</span>
                          {p.health?.lastError && <span className="col-span-2" style={{ color: '#f87171' }}>{L('الخطأ:', 'Error:')} {p.health.lastError}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Webhook Center */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm flex items-center gap-2"><Webhook size={16} style={{ color: 'var(--color-primary-fixed)' }} />{L('مركز الـ Webhooks', 'Webhook Center')}</h3>
          {webhooks.length > 0 && <button onClick={() => { platformService.clearWebhooks(); refresh(); }} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}>{L('مسح', 'Clear')}</button>}
        </div>
        <div className="rounded-2xl p-3" style={surface} id="webhook_center">
          {webhooks.length === 0 ? <p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا توجد أحداث بعد — تُسجَّل اختبارات الاتصال هنا تلقائيًا.', 'No events yet — connection tests are logged here automatically.')}</p>
            : <div className="space-y-1.5">
              {webhooks.slice(0, 20).map(w => (
                <div key={w.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg" style={{ background: 'var(--color-surface-container-lowest)' }}>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{w.direction === 'outgoing' ? '↑' : '↓'} {w.direction}</span>
                    <b>{w.provider}</b> · {w.event}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-bold" style={{ color: w.status === 'delivered' ? '#4ade80' : w.status === 'failed' ? '#f87171' : '#fbbf24' }}>{w.status} ({w.attempts})</span>
                    {w.status === 'failed' && <button onClick={() => { platformService.retryWebhook(w.id); refresh(); }} className="text-[11px] px-2 py-0.5 rounded cursor-pointer" style={surface}>{L('إعادة', 'Retry')}</button>}
                  </span>
                </div>
              ))}
            </div>}
        </div>
      </div>
    </div>
  );
};
