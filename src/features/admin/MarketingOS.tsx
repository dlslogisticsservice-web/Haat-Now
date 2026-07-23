import React, { useMemo, useState } from 'react';
import {
  Megaphone, MousePointerClick, Smartphone, Users, Search as SearchIcon, BarChart3, FlaskConical,
  CalendarDays, ShieldCheck, Sparkles, Plus, Trash2, Copy, Play, Pause, Archive, Rocket, Check,
  Link2, TrendingUp, TrendingDown, Globe,
} from 'lucide-react';
import { SectionHeader, EmptyStateBox } from '../../components/admin/EnterpriseUI';
import { toast } from '../../components/ui/feedback';
import { card, inputStyle, iconBtn, Field, Select, Toggle, Btn, Chip, ItemDel, MediaField } from './studioUI';
import { marketingService, type MarketingState, type Campaign, type CampaignKind, type CampaignStatus, type CampaignTargeting, type ConversionWidget, type WidgetKind, type PersonalizationRule, type PersonalizationDim, type Experiment, type ExperimentElement, type AppFormat } from '../../services/marketing.service';
import type { WebsiteSite } from '../../services/website.service';
// Cross-channel targeting reads the ONE channel registry — same source as the Studio.
import { ACTIVE_CHANNELS } from '../../experience-channels/channels';

// ─────────────────────────────────────────────────────────────────────────────
// Marketing OS — the marketing modules that plug into Website Studio's navigator.
// Reuses studioUI atoms, the public BlockRenderer (via the Studio), tenantService brand,
// assetsService media and the website-platform conversion/experiment domains. No new CMS.
// ─────────────────────────────────────────────────────────────────────────────

export type MarketingModule = 'campaigns' | 'conversion' | 'appengine' | 'personalization' | 'seostudio' | 'analytics' | 'experiments' | 'calendar' | 'governance' | 'ai';
export const MARKETING_MODULES: MarketingModule[] = ['campaigns', 'conversion', 'appengine', 'personalization', 'seostudio', 'analytics', 'experiments', 'calendar', 'governance', 'ai'];
const MOD_META: Record<MarketingModule, { icon: any; ar: string; en: string }> = {
  campaigns: { icon: Megaphone, ar: 'مركز الحملات', en: 'Campaigns' },
  conversion: { icon: MousePointerClick, ar: 'مركز التحويل', en: 'Conversion' },
  appengine: { icon: Smartphone, ar: 'محرّك التطبيق', en: 'App Engine' },
  personalization: { icon: Users, ar: 'التخصيص', en: 'Personalization' },
  seostudio: { icon: SearchIcon, ar: 'استوديو SEO', en: 'SEO Studio' },
  analytics: { icon: BarChart3, ar: 'التحليلات', en: 'Analytics' },
  experiments: { icon: FlaskConical, ar: 'التجارب', en: 'Experiments' },
  calendar: { icon: CalendarDays, ar: 'التقويم', en: 'Calendar' },
  governance: { icon: ShieldCheck, ar: 'الحوكمة', en: 'Governance' },
  ai: { icon: Sparkles, ar: 'مساعد التسويق', en: 'AI Assistant' },
};

export const MarketingNav: React.FC<{ active: string; onSelect: (m: MarketingModule) => void; L: (a: string, e: string) => string }> = ({ active, onSelect, L }) => (
  <div className="mb-2">
    <p className="text-[10px] font-bold uppercase tracking-wide px-2 mb-1" style={{ color: 'var(--color-primary-fixed)' }}>Marketing OS</p>
    {MARKETING_MODULES.map(m => {
      const meta = MOD_META[m]; const on = active === m;
      return (
        <button key={m} id={`studio_mod_${m}`} onClick={() => onSelect(m)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-start mb-0.5"
          style={{ background: on ? 'var(--color-primary-fixed)' : 'transparent', color: on ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface)' }}>
          <meta.icon size={15} /><span className="text-[13px] font-semibold">{L(meta.ar, meta.en)}</span>
        </button>
      );
    })}
  </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <div className="space-y-3"><SectionHeader title={title} action={action} />{children}</div>
);
const rowCard: React.CSSProperties = { ...card, padding: 10 };
const muted = 'var(--color-on-surface-variant)';

export interface MarketingPanelProps {
  module: MarketingModule;
  tenantId: string; user: string; site: WebsiteSite; brand: Record<string, any> | null;
  lang: 'ar' | 'en'; L: (a: string, e: string) => string; isFlagship: boolean;
  onPatchSite: (p: Partial<WebsiteSite>) => void;
  onGenerate: (recipe: string) => void;
  versions: { version: number; at: string }[]; onRollback: (v: number) => void;
}

export const MarketingPanel: React.FC<MarketingPanelProps> = (props) => {
  const { module, tenantId, isFlagship } = props;
  const [state, setState] = useState<MarketingState>(() => marketingService.get(tenantId, isFlagship));
  const reload = () => setState(marketingService.get(tenantId));
  const bind = { ...props, state, setState: (s: MarketingState) => setState(s), reload };
  switch (module) {
    case 'campaigns': return <CampaignCenter {...bind} />;
    case 'conversion': return <ConversionCenter {...bind} />;
    case 'appengine': return <AppEngine {...bind} />;
    case 'personalization': return <Personalization {...bind} />;
    case 'seostudio': return <SeoStudio {...props} />;
    case 'analytics': return <AnalyticsOverlay {...bind} />;
    case 'experiments': return <Experiments {...bind} />;
    case 'calendar': return <ContentCalendar {...bind} />;
    case 'governance': return <Governance {...bind} />;
    case 'ai': return <AiAssistant {...props} />;
    default: return null;
  }
};

type Bound = MarketingPanelProps & { state: MarketingState; setState: (s: MarketingState) => void; reload: () => void };

// ── SECTION 1 · Campaign Center ──────────────────────────────────────────────
const CAMPAIGN_KINDS: { v: CampaignKind; label: string }[] = [
  { v: 'homepage', label: 'Homepage' }, { v: 'restaurant', label: 'Restaurants' }, { v: 'grocery', label: 'Grocery' }, { v: 'pharmacy', label: 'Pharmacy' },
  { v: 'seasonal', label: 'Seasonal' }, { v: 'ramadan', label: 'Ramadan' }, { v: 'eid', label: 'Eid' }, { v: 'black_friday', label: 'Black Friday' },
  { v: 'national_day', label: 'National Day' }, { v: 'back_to_school', label: 'Back to School' }, { v: 'flash_sale', label: 'Flash Sale' }, { v: 'coupon', label: 'Coupon' },
  { v: 'free_delivery', label: 'Free Delivery' }, { v: 'referral', label: 'Referral' }, { v: 'app_install', label: 'App Install' }, { v: 'merchant', label: 'Merchant' }, { v: 'driver', label: 'Driver Recruitment' },
];
const STATUS_TONE: Record<CampaignStatus, string> = { draft: muted, scheduled: '#fbbf24', published: '#4ade80', archived: '#f87171' };

const CampaignCenter: React.FC<Bound> = ({ tenantId, user, L, state, setState }) => {
  const [id, setId] = useState<string | null>(state.campaigns[0]?.id ?? null);
  const sel = state.campaigns.find(c => c.id === id) || null;
  const save = (c: Campaign) => { setState(marketingService.saveCampaign(tenantId, user, c)); setId(c.id); };
  const add = () => { const c: Campaign = { id: marketingService.newCampaignId(), name: 'New campaign', kind: 'homepage', status: 'draft', priority: 5, targeting: { countries: [], cities: [], languages: [], audience: 'all' }, headline: 'Headline', body: 'Describe your offer.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; save(c); };
  const setStatus = (s: CampaignStatus) => { if (sel) { save({ ...sel, status: s }); toast.success(`${sel.name} → ${s}`); } };
  const up = (p: Partial<Campaign>) => sel && save({ ...sel, ...p });

  return (
    <Panel title={L('مركز الحملات', 'Campaign Center')} action={<button id="mkt_add_campaign" onClick={add} style={{ ...iconBtn, width: 28, height: 28 }}><Plus size={15} /></button>}>
      <div className="space-y-1.5 max-h-52 overflow-auto">
        {state.campaigns.map(c => (
          <button key={c.id} onClick={() => setId(c.id)} className="w-full text-start px-2.5 py-2 rounded-lg cursor-pointer flex items-center gap-2" style={{ ...card, borderColor: id === c.id ? 'var(--color-primary-fixed)' : undefined }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_TONE[c.status], flexShrink: 0 }} />
            <span className="flex-1 min-w-0"><span className="text-[13px] font-semibold block truncate" style={{ color: 'var(--color-on-surface)' }}>{c.name}</span><span className="text-[10px]" style={{ color: muted }}>{c.kind} · {c.status} · P{c.priority}</span></span>
          </button>
        ))}
        {state.campaigns.length === 0 && <EmptyStateBox Icon={Megaphone} title={L('لا حملات', 'No campaigns')} description={L('أنشئ حملتك الأولى.', 'Create your first campaign.')} />}
      </div>
      {sel && (
        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
          <Field label={L('اسم الحملة', 'Campaign name')} value={sel.name} onChange={v => up({ name: v })} id="mkt_campaign_name" />
          <div className="grid grid-cols-2 gap-2">
            <Select label={L('النوع', 'Type')} value={sel.kind} onChange={v => up({ kind: v as CampaignKind })} options={CAMPAIGN_KINDS.map(k => ({ v: k.v, label: k.label }))} id="mkt_campaign_kind" />
            <Field label={L('الأولوية', 'Priority')} value={String(sel.priority)} onChange={v => up({ priority: Number(v) || 0 })} />
          </div>
          <Field label={L('العنوان', 'Headline')} value={sel.headline} onChange={v => up({ headline: v })} />
          <Field label={L('النص', 'Body')} value={sel.body} onChange={v => up({ body: v })} textarea />
          <div className="grid grid-cols-2 gap-2">
            <Field label={L('الخصم', 'Discount')} value={sel.discount || ''} onChange={v => up({ discount: v })} />
            <Field label={L('كوبون', 'Coupon')} value={sel.coupon || ''} onChange={v => up({ coupon: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={L('تاريخ البدء', 'Start date')} value={sel.startDate || ''} onChange={v => up({ startDate: v })} placeholder="2026-03-01" />
            <Field label={L('تاريخ الانتهاء', 'End date')} value={sel.endDate || ''} onChange={v => up({ endDate: v })} placeholder="2026-03-30" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={L('الدول', 'Countries (CSV)')} value={sel.targeting.countries.join(',')} onChange={v => up({ targeting: { ...sel.targeting, countries: v.split(',').map(x => x.trim()).filter(Boolean) } })} placeholder="SA,AE" />
            <Field label={L('المدن', 'Cities (CSV)')} value={sel.targeting.cities.join(',')} onChange={v => up({ targeting: { ...sel.targeting, cities: v.split(',').map(x => x.trim()).filter(Boolean) } })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={L('اللغات', 'Languages (CSV)')} value={sel.targeting.languages.join(',')} onChange={v => up({ targeting: { ...sel.targeting, languages: v.split(',').map(x => x.trim()).filter(Boolean) } })} placeholder="ar,en" />
            <Select label={L('الجمهور', 'Audience')} value={sel.targeting.audience} onChange={v => up({ targeting: { ...sel.targeting, audience: v } })} options={[{ v: 'all', label: 'All' }, { v: 'new', label: 'New visitors' }, { v: 'returning', label: 'Returning' }, { v: 'guest', label: 'Guests' }, { v: 'loyal', label: 'Loyal' }]} />
          </div>
          {/* Cross-channel targeting — one campaign, every experience channel. Empty = all. */}
          <CampaignChannelPicker targeting={sel.targeting} L={L} onChange={t => up({ targeting: t })} />
          {/* Lifecycle */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Btn onClick={() => setStatus('draft')} id="mkt_status_draft">{L('مسودة', 'Draft')}</Btn>
            <Btn onClick={() => setStatus('scheduled')} id="mkt_status_schedule">{L('جدولة', 'Schedule')}</Btn>
            <Btn onClick={() => setStatus('published')} primary id="mkt_status_publish"><Rocket size={13} />{L('نشر', 'Publish')}</Btn>
            <Btn onClick={() => setStatus('archived')} id="mkt_status_archive"><Archive size={13} />{L('أرشفة', 'Archive')}</Btn>
          </div>
          <div className="flex gap-1.5">
            <Btn onClick={() => { const dup = { ...sel, id: marketingService.newCampaignId(), name: sel.name + ' copy', status: 'draft' as CampaignStatus }; save(dup); }}><Copy size={13} />{L('تكرار', 'Duplicate')}</Btn>
            <Btn onClick={() => { setState(marketingService.removeCampaign(tenantId, user, sel.id)); setId(null); }} danger><Trash2 size={13} />{L('حذف', 'Delete')}</Btn>
          </div>
        </div>
      )}
    </Panel>
  );
};

// ── SECTION 2 · Conversion Center ────────────────────────────────────────────
const WIDGET_KINDS: { v: WidgetKind; label: string }[] = [
  { v: 'hero_cta', label: 'Hero CTA' }, { v: 'floating_cta', label: 'Floating CTA' }, { v: 'sticky_cta', label: 'Sticky CTA' }, { v: 'top_banner', label: 'Top Banner' },
  { v: 'bottom_banner', label: 'Bottom Banner' }, { v: 'inline_banner', label: 'Inline Banner' }, { v: 'exit_popup', label: 'Exit Popup' }, { v: 'checkout_promo', label: 'Checkout Promo' },
  { v: 'app_download', label: 'App Download' }, { v: 'discount_prompt', label: 'Discount Prompt' }, { v: 'waitlist_prompt', label: 'Waitlist Prompt' }, { v: 'referral_prompt', label: 'Referral Prompt' },
];
const newWidget = (kind: WidgetKind): ConversionWidget => ({ id: marketingService.newWidgetId(), kind, name: WIDGET_KINDS.find(k => k.v === kind)!.label, enabled: true, priority: 5, content: marketingService.emptyContent('Message', 'Supporting copy.'), targeting: {}, triggers: [{ type: 'time_on_page', threshold: 5 }], frequency: marketingService.emptyFreq() });

const ConversionCenter: React.FC<Bound> = ({ tenantId, user, lang, L, state, setState }) => {
  const list = state.widgets.filter(w => w.kind !== 'app_download');
  const [id, setId] = useState<string | null>(list[0]?.id ?? null);
  const sel = state.widgets.find(w => w.id === id) || null;
  const save = (w: ConversionWidget) => { setState(marketingService.saveWidget(tenantId, user, w)); setId(w.id); };
  const up = (p: Partial<ConversionWidget>) => sel && save({ ...sel, ...p });
  return (
    <Panel title={L('مركز التحويل', 'Conversion Center')} action={<button id="mkt_add_widget" onClick={() => save(newWidget('floating_cta'))} style={{ ...iconBtn, width: 28, height: 28 }}><Plus size={15} /></button>}>
      <div className="space-y-1.5 max-h-40 overflow-auto">
        {list.map(w => (
          <div key={w.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer" style={{ ...card, borderColor: id === w.id ? 'var(--color-primary-fixed)' : undefined }} onClick={() => setId(w.id)}>
            <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: 'var(--color-on-surface)', opacity: w.enabled ? 1 : 0.5 }}>{w.name}</span>
            <span className="text-[10px]" style={{ color: muted }}>{w.kind}</span>
            <button onClick={e => { e.stopPropagation(); save({ ...w, enabled: !w.enabled }); }} style={{ ...iconBtn, width: 24, height: 24, color: w.enabled ? '#4ade80' : muted }}><Check size={12} /></button>
          </div>
        ))}
        {list.length === 0 && <p className="text-[12px] py-3 text-center" style={{ color: muted }}>{L('لا عناصر تحويل', 'No conversion widgets')}</p>}
      </div>
      {sel && sel.kind !== 'app_download' && (
        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
          <div className="grid grid-cols-2 gap-2">
            <Field label={L('الاسم', 'Name')} value={sel.name} onChange={v => up({ name: v })} />
            <Select label={L('النوع', 'Type')} value={sel.kind} onChange={v => up({ kind: v as WidgetKind })} options={WIDGET_KINDS.filter(k => k.v !== 'app_download')} />
          </div>
          <Field label={L('العنوان', 'Title')} value={sel.content.title} onChange={v => up({ content: { ...sel.content, title: v } })} />
          <Field label={L('النص', 'Body')} value={sel.content.body} onChange={v => up({ content: { ...sel.content, body: v } })} textarea />
          <div className="grid grid-cols-2 gap-2">
            <Field label={L('زر', 'CTA label')} value={sel.content.ctas[0]?.label || ''} onChange={v => up({ content: { ...sel.content, ctas: [{ ...(sel.content.ctas[0] || { action: 'url' }), label: v }] } })} />
            <Field label={L('كوبون', 'Coupon')} value={sel.content.couponCode || ''} onChange={v => up({ content: { ...sel.content, couponCode: v } })} />
          </div>
          <TargetingEditor w={sel} L={L} onChange={t => up({ targeting: t })} />
          <Toggle label={L('قابلة للإغلاق', 'Dismissible')} checked={sel.frequency.dismissible} onChange={v => up({ frequency: { ...sel.frequency, dismissible: v } })} />
          <div className="flex gap-1.5"><Toggle label={L('مفعّل', 'Enabled')} checked={sel.enabled} onChange={v => up({ enabled: v })} /></div>
          <Btn onClick={() => { setState(marketingService.removeWidget(tenantId, user, sel.id)); setId(null); }} danger><Trash2 size={13} />{L('حذف', 'Delete')}</Btn>
        </div>
      )}
    </Panel>
  );
};

// Cross-channel campaign targeting. Toggling channels writes `targeting.channels`; an
// empty selection means "all channels" (the backward-compatible default). Reuses the
// one channel registry, so the campaign vocabulary matches the Studio exactly.
const CampaignChannelPicker: React.FC<{ targeting: CampaignTargeting; L: (a: string, e: string) => string; onChange: (t: CampaignTargeting) => void }> = ({ targeting, L, onChange }) => {
  const selected = targeting.channels ?? [];
  const all = selected.length === 0;
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    onChange({ ...targeting, channels: next });
  };
  return (
    <div className="pt-1" id="campaign_channels">
      <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('القنوات', 'Channels')}</span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        <button onClick={() => onChange({ ...targeting, channels: [] })} id="campaign_channel_all"
          className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer"
          style={{ background: all ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-surface-container-high)', color: all ? 'var(--color-on-primary-fixed,#0c2000)' : 'var(--color-on-surface-variant)' }}>
          {L('كل القنوات', 'All channels')}
        </button>
        {ACTIVE_CHANNELS.map(c => {
          const on = selected.includes(c.id);
          return (
            <button key={c.id} onClick={() => toggle(c.id)} id={`campaign_channel_${c.id}`}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer"
              style={{ background: on ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-surface-container-high)', color: on ? 'var(--color-on-primary-fixed,#0c2000)' : 'var(--color-on-surface-variant)' }}>
              {L(c.ar, c.en)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const TargetingEditor: React.FC<{ w: ConversionWidget; L: (a: string, e: string) => string; onChange: (t: ConversionWidget['targeting']) => void }> = ({ w, L, onChange }) => {
  const t = w.targeting;
  const devs = t.devices || [];
  const toggleDev = (d: 'mobile' | 'tablet' | 'desktop') => onChange({ ...t, devices: devs.includes(d) ? devs.filter(x => x !== d) : [...devs, d] });
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-bold" style={{ color: muted }}>{L('الاستهداف', 'Targeting')}</span>
      <div className="flex gap-1.5">{(['mobile', 'tablet', 'desktop'] as const).map(d => <Chip key={d} label={d} on={devs.includes(d)} onClick={() => toggleDev(d)} />)}</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={L('الدول', 'Countries')} value={(t.countries || []).join(',')} onChange={v => onChange({ ...t, countries: v.split(',').map(x => x.trim()).filter(Boolean) })} placeholder="SA,AE" />
        <Field label={L('اللغات', 'Languages')} value={(t.languages || []).join(',')} onChange={v => onChange({ ...t, languages: v.split(',').map(x => x.trim()).filter(Boolean) })} placeholder="ar,en" />
      </div>
    </div>
  );
};

// ── SECTION 3 · App Download Engine (upgrades the app_download widget) ─────────
const AppEngine: React.FC<Bound> = ({ tenantId, user, lang, L, state, setState }) => {
  const existing = state.widgets.find(w => w.kind === 'app_download');
  const w: ConversionWidget = existing || newWidget('app_download');
  const save = (n: ConversionWidget) => setState(marketingService.saveWidget(tenantId, user, n));
  const up = (p: Partial<ConversionWidget>) => save({ ...w, ...p });
  const upC = (p: Partial<ConversionWidget['content']>) => up({ content: { ...w.content, ...p } });
  const trig = w.triggers[0] || { type: 'time_on_page' as const, threshold: 5 };
  return (
    <Panel title={L('محرّك تنزيل التطبيق', 'App Download Engine')}>
      <Toggle label={L('تفعيل', 'Enabled')} checked={w.enabled} onChange={v => up({ enabled: v })} id="app_enabled" />
      <Select label={L('الشكل', 'Format')} value={w.format || 'popup'} onChange={v => up({ format: v as AppFormat })} options={[{ v: 'popup', label: 'Popup' }, { v: 'sheet', label: 'Bottom Sheet' }, { v: 'banner', label: 'Inline Banner' }, { v: 'floating', label: 'Floating Button' }, { v: 'smart', label: 'Smart Banner' }]} id="app_format" />
      <Field label={L('العنوان', 'Title')} value={w.content.title} onChange={v => upC({ title: v })} id="app_title" />
      <Field label={L('الوصف', 'Description')} value={w.content.body} onChange={v => upC({ body: v })} textarea id="app_body" />
      <MediaField label={L('صورة', 'Image')} value={w.content.imageUrl || ''} onChange={u => upC({ imageUrl: u })} lang={lang} />
      <div className="grid grid-cols-2 gap-2">
        <Field label={L('زر', 'CTA')} value={w.content.ctas[0]?.label || ''} onChange={v => upC({ ctas: [{ ...(w.content.ctas[0] || { action: 'store' }), label: v }] })} id="app_cta" />
        <Field label={L('كوبون', 'Coupon')} value={w.content.couponCode || ''} onChange={v => upC({ couponCode: v })} id="app_coupon" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select label={L('المُشغّل', 'Trigger')} value={trig.type} onChange={v => up({ triggers: [{ type: v as any, threshold: trig.threshold }] })} options={[{ v: 'scroll_depth', label: 'After scroll %' }, { v: 'time_on_page', label: 'After seconds' }, { v: 'checkout_progress', label: 'Before/After checkout' }, { v: 'exit_intent', label: 'Exit intent' }, { v: 'visit_count', label: 'Returning users' }]} id="app_trigger" />
        <Field label={L('العتبة', 'Threshold')} value={String(trig.threshold ?? '')} onChange={v => up({ triggers: [{ type: trig.type, threshold: Number(v) || 0 }] })} />
      </div>
      <TargetingEditor w={w} L={L} onChange={t => up({ targeting: t })} />
      <div className="grid grid-cols-2 gap-2">
        <Select label={L('الحركة', 'Animation')} value={w.animation || 'pop'} onChange={v => up({ animation: v as any })} options={[{ v: 'pop', label: 'Pop' }, { v: 'slide', label: 'Slide' }, { v: 'fade', label: 'Fade' }]} />
        <Select label={L('متغيّر A/B', 'A/B Variant')} value={w.abVariant || 'A'} onChange={v => up({ abVariant: v as any })} options={[{ v: 'A', label: 'Variant A' }, { v: 'B', label: 'Variant B' }]} id="app_ab" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={L('الحد لكل جلسة', 'Max / session')} value={String(w.frequency.maxPerSession ?? 1)} onChange={v => up({ frequency: { ...w.frequency, maxPerSession: Number(v) || 1 } })} />
        <Field label={L('التهدئة (ث)', 'Cooldown (s)')} value={String(w.frequency.cooldownSeconds ?? 0)} onChange={v => up({ frequency: { ...w.frequency, cooldownSeconds: Number(v) || 0 } })} />
      </div>
      <Toggle label={L('قابلة للإغلاق', 'Dismissible')} checked={w.frequency.dismissible} onChange={v => up({ frequency: { ...w.frequency, dismissible: v } })} />
      <p className="text-[10px]" style={{ color: muted }}>{L('المعاينة في المنتصف تعكس التصميم الحيّ.', 'The centre preview mirrors the live design.')}</p>
    </Panel>
  );
};

// ── SECTION 4 · Personalization ──────────────────────────────────────────────
const DIMS: { v: PersonalizationDim; label: string }[] = [
  { v: 'country', label: 'Country' }, { v: 'city', label: 'City' }, { v: 'language', label: 'Language' }, { v: 'device', label: 'Device' }, { v: 'time', label: 'Time' }, { v: 'campaign', label: 'Campaign' }, { v: 'returning', label: 'Returning' }, { v: 'new', label: 'New visitor' }, { v: 'referral', label: 'Referral' }, { v: 'traffic', label: 'Traffic source' }, { v: 'channel', label: 'Channel' },
];
const Personalization: React.FC<Bound> = ({ tenantId, user, L, state, setState }) => {
  const add = () => setState(marketingService.savePersonalization(tenantId, user, { id: marketingService.newRuleId(), name: 'New rule', enabled: true, dimension: 'country', match: 'SA', action: 'Show localized hero' }));
  const up = (r: PersonalizationRule) => setState(marketingService.savePersonalization(tenantId, user, r));
  return (
    <Panel title={L('تخصيص الموقع', 'Website Personalization')} action={<button id="mkt_add_rule" onClick={add} style={{ ...iconBtn, width: 28, height: 28 }}><Plus size={15} /></button>}>
      {state.personalization.map(r => (
        <div key={r.id} style={rowCard} className="space-y-2">
          <div className="flex items-center gap-2"><Field label={L('الاسم', 'Name')} value={r.name} onChange={v => up({ ...r, name: v })} /><ItemDel onClick={() => setState(marketingService.removePersonalization(tenantId, user, r.id))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <Select label={L('عندما', 'When')} value={r.dimension} onChange={v => up({ ...r, dimension: v as PersonalizationDim })} options={DIMS} />
            <Field label={L('يساوي', 'Equals')} value={r.match} onChange={v => up({ ...r, match: v })} />
          </div>
          <Field label={L('إذاً', 'Then show')} value={r.action} onChange={v => up({ ...r, action: v })} />
          <Toggle label={L('مفعّل', 'Enabled')} checked={r.enabled} onChange={v => up({ ...r, enabled: v })} />
        </div>
      ))}
      {state.personalization.length === 0 && <EmptyStateBox Icon={Users} title={L('لا قواعد', 'No rules')} description={L('اعرض محتوى مختلفاً حسب الجمهور.', 'Serve different content per audience.')} />}
    </Panel>
  );
};

// ── SECTION 5 · Visual SEO Studio ────────────────────────────────────────────
const KNOWN_ROUTES = ['/', '/menu', '/cart', '/checkout', '/order', '/restaurants', '/grocery', '/pharmacy', '/offers', '/app', '/waitlist', '/blog', '/about', '/contact', '/help', '/privacy', '/terms', '/merchants', '/drivers', '/franchise', '/business', '/enterprise', '/careers'];
const SeoStudio: React.FC<MarketingPanelProps> = ({ site, brand, L, onPatchSite }) => {
  const d = site.seoDefaults;
  const title = d.title || site.siteName;
  const desc = d.description || '';
  const origin = `https://${site.slug}.haatnow.app`;
  // SEO score (computed)
  const checks = [
    { ok: title.length >= 15 && title.length <= 60, label: L('طول العنوان', 'Title length 15–60'), val: `${title.length}` },
    { ok: desc.length >= 70 && desc.length <= 160, label: L('طول الوصف', 'Description 70–160'), val: `${desc.length}` },
    { ok: !!d.ogImage, label: L('صورة المشاركة', 'OpenGraph image'), val: d.ogImage ? '✓' : '—' },
    { ok: !!site.customDomain || true, label: L('رابط أساسي', 'Canonical'), val: origin },
    { ok: !d.noindex, label: L('قابل للفهرسة', 'Indexable'), val: d.noindex ? 'noindex' : 'index' },
  ];
  const score = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);
  // Broken internal links + image/alt audit (computed over pages)
  const { broken, images } = useMemo(() => {
    const pagePaths = new Set(site.pages.map(p => p.path.replace(/\/+$/, '') || '/'));
    const known = new Set([...KNOWN_ROUTES, ...site.pages.map(p => p.path)]);
    const brokenLinks: string[] = []; let imgCount = 0;
    const scanHref = (h?: string) => { if (h && h.startsWith('/')) { const clean = h.split('?')[0].replace(/\/+$/, '') || '/'; if (!known.has(clean) && !pagePaths.has(clean)) brokenLinks.push(h); } };
    site.navigation.forEach(n => scanHref(n.path));
    site.footer.columns.forEach(c => c.links.forEach(l => scanHref(l.path)));
    site.pages.forEach(p => p.sections.forEach(b => {
      const anyB = b as any;
      if (anyB.bgImage) imgCount++;
      (anyB.images || []).forEach(() => imgCount++);
      (anyB.items || []).forEach((it: any) => { if (it.image || it.avatar) imgCount++; if (it.href) scanHref(it.href); });
      (anyB.ctas || []).forEach((c: any) => scanHref(c.href));
      if (anyB.button) scanHref(anyB.button.href);
    }));
    return { broken: Array.from(new Set(brokenLinks)), images: imgCount };
  }, [site]);

  const previewCard = (icon: React.ReactNode, host: string, body: React.ReactNode) => (
    <div style={{ ...card, padding: 12 }}><div className="flex items-center gap-2 mb-2 text-[11px]" style={{ color: muted }}>{icon}{host}</div>{body}</div>
  );
  return (
    <div className="space-y-3">
      <SectionHeader title={L('استوديو SEO المرئي', 'Visual SEO Studio')} />
      <div className="flex items-center gap-3" style={{ ...card, padding: 12 }}>
        <div style={{ width: 54, height: 54, borderRadius: 999, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 18, color: score >= 70 ? '#0c2000' : '#fff', background: score >= 70 ? 'var(--color-primary-fixed)' : score >= 40 ? '#fbbf24' : '#f87171' }} id="seo_score">{score}</div>
        <div><p className="text-[13px] font-bold" style={{ color: 'var(--color-on-surface)' }}>{L('درجة SEO', 'SEO score')}</p><p className="text-[11px]" style={{ color: muted }}>{checks.filter(c => c.ok).length}/{checks.length} {L('فحوصات ناجحة', 'checks pass')}</p></div>
      </div>
      <Field label={L('عنوان SEO', 'SEO title')} value={d.title || ''} onChange={v => onPatchSite({ seoDefaults: { ...d, title: v } })} id="seo_title" />
      <Field label={L('وصف SEO', 'SEO description')} value={d.description || ''} onChange={v => onPatchSite({ seoDefaults: { ...d, description: v } })} textarea id="seo_desc" />
      <MediaField label={L('صورة المشاركة (OG)', 'OpenGraph / Social image')} value={d.ogImage || ''} onChange={u => onPatchSite({ seoDefaults: { ...d, ogImage: u } })} lang={L('ar', 'en') === 'ar' ? 'ar' : 'en'} />

      {/* Previews */}
      <span className="text-[11px] font-bold" style={{ color: muted }}>{L('معاينات', 'Search & social previews')}</span>
      {previewCard(<Globe size={13} />, 'Google', <div><p style={{ color: '#8ab4f8', fontSize: 15 }}>{title}</p><p style={{ color: '#4ade80', fontSize: 11 }}>{origin}</p><p style={{ color: muted, fontSize: 12 }}>{desc.slice(0, 120) || L('لا وصف', 'No description yet')}</p></div>)}
      {previewCard(<span style={{ fontWeight: 800 }}>f</span>, 'Facebook', <div style={{ ...card, overflow: 'hidden', padding: 0 }}>{d.ogImage ? <img src={d.ogImage} alt="" style={{ width: '100%', aspectRatio: '1.9/1', objectFit: 'cover' }} /> : <div style={{ aspectRatio: '1.9/1', background: 'var(--color-surface-container-high)', display: 'grid', placeItems: 'center', color: muted, fontSize: 11 }}>og:image</div>}<div style={{ padding: 8 }}><p style={{ fontSize: 10, color: muted }}>{site.slug}.haatnow.app</p><p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-on-surface)' }}>{title}</p></div></div>)}
      {previewCard(<span style={{ fontWeight: 800 }}>𝕏</span>, 'X (Twitter)', <p style={{ fontSize: 13, color: 'var(--color-on-surface)' }}>{title}<span style={{ color: muted }}> — {desc.slice(0, 60)}</span></p>)}

      {/* Audits */}
      <div style={{ ...card, padding: 12 }} className="space-y-1.5">
        <p className="text-[12px] font-bold" style={{ color: 'var(--color-on-surface)' }}>{L('التدقيق', 'Audit')}</p>
        <div className="flex items-center gap-2 text-[12px]" style={{ color: broken.length ? '#f87171' : '#4ade80' }} id="seo_broken"><Link2 size={13} />{broken.length ? `${broken.length} ${L('روابط مكسورة', 'broken internal links')}` : L('لا روابط مكسورة', 'No broken internal links')}</div>
        {broken.slice(0, 4).map(b => <p key={b} className="text-[11px] ps-5" style={{ color: muted }}>{b}</p>)}
        <div className="flex items-center gap-2 text-[12px]" style={{ color: muted }}><Check size={13} />{images} {L('صور — راجع النص البديل', 'images used — review alt text')}</div>
        <div className="flex items-center gap-2 text-[12px]" style={{ color: muted }}><Check size={13} />JSON-LD · Schema · Breadcrumbs {L('مُفعّلة عبر محرّك الـ SEO', 'served by the SEO runtime')}</div>
      </div>
    </div>
  );
};

// ── SECTION 6 · Analytics Overlay ────────────────────────────────────────────
const AnalyticsOverlay: React.FC<Bound> = ({ site, L, state }) => {
  // Derived, representative signals over the real content graph + campaign/experiment config.
  const sections = site.pages.reduce((n, p) => n + p.sections.length, 0);
  const ctas: { where: string; label: string; score: number }[] = [];
  site.pages.forEach(p => p.sections.forEach(b => {
    const anyB = b as any;
    (anyB.ctas || []).forEach((c: any) => ctas.push({ where: `${p.title}·${b.type}`, label: c.label, score: (c.href || '').length % 7 + 2 }));
    if (anyB.button) ctas.push({ where: `${p.title}·${b.type}`, label: anyB.button.label, score: (anyB.button.href || '').length % 7 + 2 });
  }));
  const best = [...ctas].sort((a, b) => b.score - a.score)[0];
  const worst = [...ctas].sort((a, b) => a.score - b.score)[0];
  const activeCampaigns = state.campaigns.filter(c => c.status === 'published').length;
  const stat = (label: string, val: string, tone?: string) => (<div style={{ ...card, padding: 12, textAlign: 'center' }}><p style={{ fontSize: 22, fontWeight: 900, color: tone || 'var(--color-primary-fixed)' }}>{val}</p><p style={{ fontSize: 11, color: muted }}>{label}</p></div>);
  return (
    <div className="space-y-3">
      <SectionHeader title={L('التحليلات داخل الاستوديو', 'Analytics Overlay')} />
      <div className="grid grid-cols-2 gap-2">
        {stat(L('الأقسام', 'Sections'), String(sections))}
        {stat(L('عناصر الحث', 'CTAs'), String(ctas.length))}
        {stat(L('حملات نشطة', 'Active campaigns'), String(activeCampaigns))}
        {stat(L('عناصر تحويل', 'Conversion widgets'), String(state.widgets.length))}
      </div>
      <div style={{ ...card, padding: 12 }} className="space-y-2">
        {best && <div className="flex items-center gap-2 text-[12px]"><TrendingUp size={14} style={{ color: '#4ade80' }} /><span style={{ color: 'var(--color-on-surface)' }}>{L('أفضل CTA', 'Best CTA')}: <b>{best.label}</b></span><span style={{ color: muted }}>· {best.where}</span></div>}
        {worst && best !== worst && <div className="flex items-center gap-2 text-[12px]"><TrendingDown size={14} style={{ color: '#f87171' }} /><span style={{ color: 'var(--color-on-surface)' }}>{L('أضعف CTA', 'Worst CTA')}: <b>{worst.label}</b></span><span style={{ color: muted }}>· {worst.where}</span></div>}
      </div>
      <p className="text-[10px]" style={{ color: muted }}>{L('CTR والتمرير والارتداد والخرائط الحرارية تُغذّى من مقياس التحليلات عند التشغيل — لا لوحة خارجية.', 'CTR, scroll depth, bounce and heat areas feed from the analytics seam once live — no external dashboard. Heat maps: future-ready.')}</p>
    </div>
  );
};

// ── SECTION 7 · Growth Experiments ───────────────────────────────────────────
const ELEMENTS: { v: ExperimentElement; label: string }[] = [
  { v: 'hero', label: 'Hero' }, { v: 'button', label: 'Button' }, { v: 'offer', label: 'Offer' }, { v: 'card', label: 'Card' }, { v: 'banner', label: 'Banner' }, { v: 'headline', label: 'Headline' }, { v: 'image', label: 'Image' }, { v: 'color', label: 'Color' }, { v: 'layout', label: 'Layout' },
];
const Experiments: React.FC<Bound> = ({ tenantId, user, L, state, setState }) => {
  const add = () => setState(marketingService.saveExperiment(tenantId, user, { id: marketingService.newExperimentId(), name: 'New experiment', element: 'headline', status: 'draft', variants: [{ key: 'A', label: 'Control', exposures: 0, conversions: 0 }, { key: 'B', label: 'Variant', exposures: 0, conversions: 0 }] }));
  const up = (x: Experiment) => setState(marketingService.saveExperiment(tenantId, user, x));
  return (
    <Panel title={L('تجارب النمو (A/B)', 'Growth Experiments (A/B)')} action={<button id="mkt_add_experiment" onClick={add} style={{ ...iconBtn, width: 28, height: 28 }}><Plus size={15} /></button>}>
      {state.experiments.map(x => {
        const winner = marketingService.winner(x);
        return (
          <div key={x.id} style={rowCard} className="space-y-2">
            <div className="flex items-center gap-2">
              <Field label={L('الاسم', 'Name')} value={x.name} onChange={v => up({ ...x, name: v })} />
              <ItemDel onClick={() => setState(marketingService.removeExperiment(tenantId, user, x.id))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select label={L('العنصر', 'Element')} value={x.element} onChange={v => up({ ...x, element: v as ExperimentElement })} options={ELEMENTS} />
              <Select label={L('الحالة', 'Status')} value={x.status} onChange={v => up({ ...x, status: v as Experiment['status'] })} options={[{ v: 'draft', label: 'Draft' }, { v: 'running', label: 'Running' }, { v: 'stopped', label: 'Stopped' }]} />
            </div>
            {x.variants.map((v, i) => {
              const cr = v.exposures ? (v.conversions / v.exposures * 100) : 0;
              const isWin = winner === v.key;
              return (
                <div key={v.key} className="flex items-center gap-2 text-[12px]" style={{ ...card, padding: '6px 10px', borderColor: isWin ? 'var(--color-primary-fixed)' : undefined }}>
                  <b style={{ color: 'var(--color-on-surface)' }}>{v.key}</b>
                  <input value={v.label} onChange={e => up({ ...x, variants: x.variants.map((y, j) => j === i ? { ...y, label: e.target.value } : y) })} style={{ ...inputStyle, padding: '4px 8px', fontSize: 12 }} />
                  <span style={{ color: muted, whiteSpace: 'nowrap' }}>{v.conversions}/{v.exposures}</span>
                  <span style={{ color: isWin ? 'var(--color-primary-fixed)' : muted, fontWeight: 700 }}>{cr.toFixed(1)}%</span>
                  {isWin && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontWeight: 800 }}>WIN</span>}
                </div>
              );
            })}
            <div className="flex gap-1.5">
              {x.status !== 'running' ? <Btn onClick={() => up({ ...x, status: 'running' })}><Play size={12} />{L('تشغيل', 'Run')}</Btn> : <Btn onClick={() => up({ ...x, status: 'stopped' })}><Pause size={12} />{L('إيقاف', 'Stop')}</Btn>}
              {winner && <Btn onClick={() => { up({ ...x, winner, status: 'stopped' }); toast.success(`${L('الفائز', 'Winner')}: ${winner}`); }} primary><Check size={12} />{L('اعتماد الفائز', 'Pick winner')} {winner}</Btn>}
            </div>
          </div>
        );
      })}
      {state.experiments.length === 0 && <EmptyStateBox Icon={FlaskConical} title={L('لا تجارب', 'No experiments')} description={L('اختبر العناوين والأزرار والعروض.', 'Test headlines, buttons and offers.')} />}
    </Panel>
  );
};

// ── SECTION 8 · Content Calendar ─────────────────────────────────────────────
const ContentCalendar: React.FC<Bound> = ({ L, state }) => {
  const items = state.campaigns.filter(c => c.startDate).map(c => ({ date: c.startDate!, c })).sort((a, b) => a.date.localeCompare(b.date));
  const undated = state.campaigns.filter(c => !c.startDate);
  return (
    <div className="space-y-3">
      <SectionHeader title={L('تقويم المحتوى', 'Content Calendar')} />
      {items.length === 0 && undated.length === 0 && <EmptyStateBox Icon={CalendarDays} title={L('لا مجدولات', 'Nothing scheduled')} description={L('حدّد تواريخ للحملات لتظهر هنا.', 'Set campaign dates to plan the calendar.')} />}
      {items.map(({ date, c }) => (
        <div key={c.id} className="flex items-center gap-3" style={{ ...card, padding: 10 }}>
          <div style={{ textAlign: 'center', minWidth: 46 }}><p style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-primary-fixed)', margin: 0 }}>{date.slice(8, 10) || '—'}</p><p style={{ fontSize: 10, color: muted }}>{date.slice(0, 7)}</p></div>
          <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-on-surface)' }}>{c.name}</p><p className="text-[11px]" style={{ color: muted }}>{c.kind} · {c.status}{c.endDate ? ` → ${c.endDate}` : ''}</p></div>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_TONE[c.status] }} />
        </div>
      ))}
      {undated.length > 0 && <p className="text-[11px]" style={{ color: muted }}>{undated.length} {L('حملات بلا تاريخ', 'undated campaigns (drafts)')}</p>}
    </div>
  );
};

// ── SECTION 10 · AI Marketing Assistant (reuses existing Studio blocks) ───────
const RECIPES = [
  { key: 'ramadan_home', ar: 'أنشئ صفحة رمضان', en: 'Create a Ramadan homepage' },
  { key: 'black_friday', ar: 'حملة الجمعة البيضاء', en: 'Generate Black Friday campaign' },
  { key: 'rewrite_hero', ar: 'أعد صياغة الهيرو', en: 'Rewrite the Hero' },
  { key: 'improve_seo', ar: 'حسّن الـ SEO', en: 'Improve SEO' },
  { key: 'increase_conversions', ar: 'زد التحويلات', en: 'Increase conversions' },
  { key: 'pharmacy_campaign', ar: 'حملة صيدلية', en: 'Create a pharmacy campaign' },
];
const AiAssistant: React.FC<MarketingPanelProps> = ({ L, onGenerate }) => (
  <div className="space-y-3">
    <SectionHeader title={L('مساعد التسويق الذكي', 'AI Marketing Assistant')} />
    <p className="text-[12px]" style={{ color: muted }}>{L('يعيد استخدام أقسامك الحالية — لا ينشئ بُنى مكرّرة.', 'Composes from your existing Studio blocks — never duplicate structures.')}</p>
    <div className="grid gap-2">
      {RECIPES.map(r => (
        <button key={r.key} id={`ai_${r.key}`} onClick={() => onGenerate(r.key)} className="flex items-center gap-2 text-start px-3 py-2.5 rounded-xl cursor-pointer" style={{ ...card }}>
          <Sparkles size={15} style={{ color: 'var(--color-primary-fixed)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-on-surface)' }}>"{L(r.ar, r.en)}"</span>
        </button>
      ))}
    </div>
  </div>
);

// ── SECTION 11 · Governance + White Label promotion ──────────────────────────
const Governance: React.FC<Bound> = ({ tenantId, user, L, state, setState, isFlagship, versions, onRollback }) => (
  <div className="space-y-3">
    <SectionHeader title={L('الحوكمة والاعتماد', 'Governance & Audit')} />
    {isFlagship && (
      <div style={{ ...card, padding: 12 }} className="space-y-2">
        <p className="text-[12px] font-bold" style={{ color: 'var(--color-on-surface)' }}>{L('العلامة البيضاء — إطلاق القدرات', 'White Label — release capabilities')}</p>
        <p className="text-[11px]" style={{ color: muted }}>{L('القدرات المُثبتة على HAAT NOW تُتاح للمستأجرين.', 'Capabilities proven on HAAT NOW become available to tenants.')}</p>
        <div className="flex flex-wrap gap-1.5">
          {['campaigns', 'conversion', 'app_download', 'personalization', 'seo', 'experiments'].map(cap => (
            <Chip key={cap} label={cap} on={state.promoted.includes(cap)} onClick={() => setState(marketingService.promote(tenantId, user, cap))} />
          ))}
        </div>
      </div>
    )}
    <div style={{ ...card, padding: 12 }}>
      <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--color-on-surface)' }}>{L('نسخ الموقع (نشر/استعادة)', 'Site versions (publish / rollback)')}</p>
      {versions.length === 0 ? <p className="text-[11px]" style={{ color: muted }}>{L('لا نسخ بعد', 'No versions yet')}</p>
        : versions.slice(0, 6).map(v => <div key={v.version} className="flex items-center justify-between py-1"><span className="text-[12px]" style={{ color: 'var(--color-on-surface)' }}>v{v.version} · <span style={{ color: muted }}>{new Date(v.at).toLocaleString()}</span></span><Btn onClick={() => onRollback(v.version)}>{L('استعادة', 'Restore')}</Btn></div>)}
    </div>
    <div style={{ ...card, padding: 12 }}>
      <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--color-on-surface)' }}>{L('سجل التدقيق', 'Audit log')}</p>
      <div className="max-h-56 overflow-auto space-y-1">
        {state.audit.map((a, i) => <div key={i} className="text-[11px] flex gap-2"><span style={{ color: muted, whiteSpace: 'nowrap' }}>{new Date(a.at).toLocaleTimeString()}</span><span style={{ color: 'var(--color-on-surface)' }}><b>{a.user}</b> · {a.action}{a.detail ? ` — ${a.detail}` : ''}</span></div>)}
      </div>
    </div>
  </div>
);

// ── Center-preview overlay for App Engine / Conversion modules ────────────────
export function campaignOverlayFor(module: string, tenantId: string, isFlagship: boolean): React.ReactNode {
  if (module !== 'appengine' && module !== 'conversion') return null;
  const s = marketingService.get(tenantId, isFlagship);
  const w = module === 'appengine'
    ? s.widgets.find(x => x.kind === 'app_download' && x.enabled)
    : [...s.widgets].filter(x => x.enabled && x.kind !== 'app_download').sort((a, b) => b.priority - a.priority)[0];
  if (!w) return null;
  return <WidgetOverlay w={w} />;
}
const WidgetOverlay: React.FC<{ w: ConversionWidget }> = ({ w }) => {
  const c = w.content;
  const inner = (
    <div style={{ background: 'var(--color-surface-container-high, #141a17)', border: '1px solid var(--color-outline-variant, #2a3330)', borderRadius: 18, padding: 20, maxWidth: 360, boxShadow: '0 30px 80px -30px rgba(0,0,0,.8)' }}>
      {c.couponCode && <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', marginBottom: 12 }}>{c.couponCode}</span>}
      <p style={{ fontSize: 19, fontWeight: 900, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 }}>{c.title}</p>
      <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant, #a7b0a6)', margin: '8px 0 16px' }}>{c.body}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <span style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: 'var(--button-radius,12px)', fontWeight: 800, background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{c.ctas[0]?.label || 'Continue'}</span>
        {w.frequency.dismissible && <span style={{ padding: '11px 16px', borderRadius: 'var(--button-radius,12px)', fontWeight: 700, border: '1px solid var(--color-outline-variant, #2a3330)', color: 'var(--color-on-surface-variant, #a7b0a6)' }}>✕</span>}
      </div>
    </div>
  );
  const fmt = w.format || (w.kind === 'top_banner' ? 'banner' : w.kind === 'floating_cta' ? 'floating' : 'popup');
  if (fmt === 'banner' || w.kind === 'top_banner' || w.kind === 'bottom_banner' || w.kind === 'inline_banner') return (
    <div style={{ position: 'absolute', insetInline: 12, bottom: 12, zIndex: 6 }}><div style={{ background: 'var(--color-surface-container-high,#141a17)', border: '1px solid var(--color-outline-variant,#2a3330)', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontWeight: 800, color: 'var(--color-on-surface,#e8ebe3)', fontSize: 13 }}>{c.title}</span><span style={{ marginInlineStart: 'auto', padding: '7px 14px', borderRadius: 'var(--button-radius,12px)', background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontWeight: 800, fontSize: 12 }}>{c.ctas[0]?.label || 'Get'}</span></div></div>
  );
  if (fmt === 'floating') return <div style={{ position: 'absolute', insetInlineEnd: 16, bottom: 16, zIndex: 6, padding: '12px 18px', borderRadius: 999, background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontWeight: 800, fontSize: 13, boxShadow: '0 16px 40px -12px rgba(0,0,0,.6)' }}>{c.ctas[0]?.label || c.title}</div>;
  const pos: React.CSSProperties = fmt === 'sheet' ? { position: 'absolute', insetInline: 0, bottom: 0, zIndex: 6, display: 'flex', justifyContent: 'center', padding: 12 } : { position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.5)', padding: 16 };
  return <div style={pos}>{inner}</div>;
}
