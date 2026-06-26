import React, { useState } from 'react';
import { Building2, AppWindow, Plug, Flag, Server, Check, Palette, Smartphone, Mail, Phone } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { platformService } from '../../platform/platform.service';
import { FlagState } from '../../platform/platformModel';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 14, padding: 14 };
const chip = (color: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, color, background: `${color}22`, borderRadius: 999, padding: '3px 9px' });

const statusColor = (s: string) => s === 'active' || s === 'enabled' ? '#4ade80' : s === 'beta' ? '#60a5fa' : s === 'experimental' ? '#fbbf24' : s === 'draft' || s === 'inactive' || s === 'disabled' ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface-variant)';
const FLAG_CYCLE: FlagState[] = ['enabled', 'beta', 'experimental', 'disabled'];

type Section = 'brands' | 'applications' | 'providers' | 'flags' | 'environments';

export const PlatformRegistry: React.FC = () => {
  const { lang } = useAppConfig();
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [section, setSection] = useState<Section>('brands');
  const [, force] = useState(0);
  const refresh = () => force(x => x + 1);

  const TABS: { k: Section; ar: string; en: string; Icon: typeof Building2 }[] = [
    { k: 'brands', ar: 'العلامات التجارية', en: 'Brands', Icon: Building2 },
    { k: 'applications', ar: 'التطبيقات', en: 'Applications', Icon: AppWindow },
    { k: 'providers', ar: 'المزوّدون', en: 'Providers', Icon: Plug },
    { k: 'flags', ar: 'مفاتيح الميزات', en: 'Feature Flags', Icon: Flag },
    { k: 'environments', ar: 'البيئات', en: 'Environments', Icon: Server },
  ];

  return (
    <div id="platform_registry" dir={lang === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setSection(t.k)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer"
            style={section === t.k ? { background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' } : { ...card, padding: '6px 12px' }}>
            <t.Icon size={14} />{L(t.ar, t.en)}
          </button>
        ))}
      </div>

      {section === 'brands' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {platformService.brands().map(b => (
            <div key={b.id} style={card} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-bold" style={{ color: 'var(--color-on-surface)' }}><Palette size={16} color={b.colors.primary} />{b.displayName}</span>
                <span style={chip(statusColor(b.status))}>{b.status === 'active' ? L('نشط', 'Active') : L('مسودة', 'Draft')}</span>
              </div>
              <div className="flex gap-1.5">
                {[b.colors.primary, b.colors.secondary, b.colors.accent].map((c, i) => <span key={i} title={c} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: '1px solid var(--color-outline-variant)' }} />)}
              </div>
              <div className="text-[11px] space-y-1" style={{ color: 'var(--color-on-surface-variant)' }}>
                <p className="flex items-center gap-1.5"><Smartphone size={12} />{b.packageName}</p>
                <p className="flex items-center gap-1.5"><Mail size={12} />{b.supportEmail || '—'}</p>
                <p>{L('الخط', 'Font')}: {b.fonts}</p>
              </div>
            </div>
          ))}
          <div style={{ ...card, borderStyle: 'dashed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-on-surface-variant)', fontSize: 12 }}>
            {L('إضافة علامة جديدة (قريباً — يتطلب الوضع متعدد المستأجرين)', 'Add brand (soon — requires multi-tenant rollout)')}
          </div>
        </div>
      )}

      {section === 'applications' && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {platformService.applications().map(a => (
            <div key={a.id} style={card} className="flex items-center justify-between">
              <div><p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{a.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{a.vertical}</p></div>
              <button onClick={() => { platformService.toggleApplication(a.id, !a.enabled); refresh(); }}
                style={chip(statusColor(a.enabled ? 'active' : 'draft'))} className="cursor-pointer">
                {a.enabled ? L('مُفعّل', 'Enabled') : L('معطّل', 'Disabled')}
              </button>
            </div>
          ))}
        </div>
      )}

      {section === 'providers' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {platformService.providers().map(p => (
            <div key={p.id} style={card} className="flex items-center justify-between">
              <div><p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{p.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{p.type} · {p.country === '*' ? L('كل الدول', 'All countries') : p.country}</p></div>
              <span style={chip(statusColor(p.status))}>{p.status === 'active' ? L('نشط', 'Active') : L('غير مفعّل', 'Inactive')}</span>
            </div>
          ))}
        </div>
      )}

      {section === 'flags' && (
        <div className="space-y-2">
          {platformService.flags().map(f => (
            <div key={f.key} style={card} className="flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{f.label}</p>
                <p className="text-[11px] font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>{f.key} · {f.scope}</p></div>
              <button onClick={() => { const next = FLAG_CYCLE[(FLAG_CYCLE.indexOf(f.state) + 1) % FLAG_CYCLE.length]; platformService.setFlagState(f.key, next); refresh(); }}
                style={chip(statusColor(f.state))} className="cursor-pointer shrink-0">
                {f.state === 'enabled' ? L('مُفعّل', 'Enabled') : f.state === 'disabled' ? L('معطّل', 'Disabled') : f.state === 'beta' ? L('تجريبي', 'Beta') : L('اختباري', 'Experimental')}
              </button>
            </div>
          ))}
        </div>
      )}

      {section === 'environments' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {platformService.environments().map(e => (
            <div key={e.id} style={card} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}><Server size={14} />{e.name}</span>
                {(e.name === 'production' || e.name === 'sandbox') && <Check size={14} color="#4ade80" />}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                {L('التخزين', 'Storage')}: {e.storage || '—'} · {L('النطاق', 'Domain')}: {e.domain || '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
        <Phone size={11} className="inline" /> {L('طبقة أساس — مهيّأة للوضع متعدد المستأجرين. القيم محفوظة محليًا الآن وتُربط بجداول platform_* عند التفعيل.', 'Foundation layer — multi-tenant ready. Values persist locally for now and bind to the platform_* tables when enabled.')}
      </p>
    </div>
  );
};
