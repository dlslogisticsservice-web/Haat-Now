import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Globe, Eye, UploadCloud, RotateCcw, Plus, Trash2, ChevronUp, ChevronDown, History as HistoryIcon, Copy,
  GripVertical, Power, Monitor, Tablet, Smartphone, ImageIcon, Pencil, Undo2, Redo2, Check,
  Palette, FileText, PanelBottom, Navigation2, RotateCw, Settings2,
  Wand2, MousePointerClick, Sliders, Lock, LockOpen, Sparkles, Languages, Search as SearchIcon,
  ShieldCheck, AlertTriangle, HeartPulse,
} from 'lucide-react';
import { SectionHeader, EmptyStateBox } from '../../components/admin/EnterpriseUI';
import { toast } from '../../components/ui/feedback';
import { tenantService } from '../../services/tenant.service';
import { websiteService, type WebsiteSite, type WebsitePage, type WebsiteBlock, type WebsiteBlockType, type WebsiteCta, type BlogPost } from '../../services/website.service';
import { BlockRenderer, SectionShell, BlockStyles } from '../website/blocks';
import { assetsService, BRAND_SLOTS, type AssetItem } from '../../experience/assets.service';
import { card, inputStyle, iconBtn, swap, Field, Toggle, Btn, MediaField, MediaListField, StringListField, ItemDel } from './studioUI';
import { MarketingNav, MarketingPanel, MARKETING_MODULES, campaignOverlayFor, type MarketingModule } from './MarketingOS';
import * as aiStudio from '../../services/aiStudio';
import { localizeSite } from '../website/i18n';
import { marketingService } from '../../services/marketing.service';

// ─────────────────────────────────────────────────────────────────────────────
// Website Studio — a professional three-panel visual builder (Structure · Live Preview ·
// Properties). It TRANSFORMS the former Website Center: same services (websiteService CMS,
// tenantService brand/theme, assetsService media, the public BlockRenderer), zero duplicate
// systems. Every edit is instant (draft-based, no publish to preview), with undo/redo/history,
// device preview (desktop/tablet/mobile + landscape), theme & brand studios, media library and
// an app-install campaign composer. Publish/rollback flow reuses websiteService versions.
// ─────────────────────────────────────────────────────────────────────────────

type StudioModule = 'pages' | 'assistant' | 'nav' | 'footer' | 'blog' | 'theme' | 'brand' | 'media' | 'settings' | 'domain' | 'history';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';
type Orientation = 'portrait' | 'landscape';

const BLOCK_TYPES: WebsiteBlockType[] = ['hero', 'features', 'cards', 'stats', 'testimonials', 'partners', 'gallery', 'app_download', 'faq', 'contact', 'cta', 'richtext', 'categories', 'merchants', 'deals', 'steps', 'waitlist'];
const BLOCK_LABEL: Record<WebsiteBlockType, string> = { hero: 'Hero', features: 'Features', cards: 'Cards', stats: 'Statistics', testimonials: 'Testimonials', partners: 'Partners', gallery: 'Gallery', app_download: 'App Download', faq: 'FAQ', contact: 'Contact', cta: 'CTA', richtext: 'Rich text', categories: 'Categories', merchants: 'Merchants', deals: 'Deals', steps: 'Steps', waitlist: 'Waitlist' };
const SECTION_TEMPLATES: { key: string; label: string; make: () => WebsiteBlockType[] }[] = [
  { key: 'marketplace', label: 'Marketplace home', make: () => ['hero', 'categories', 'merchants', 'deals', 'steps', 'cta'] },
  { key: 'saas', label: 'SaaS landing', make: () => ['hero', 'features', 'stats', 'testimonials', 'cta'] },
  { key: 'product', label: 'Product', make: () => ['hero', 'cards', 'gallery', 'app_download'] },
  { key: 'simple', label: 'Simple', make: () => ['hero', 'richtext', 'contact'] },
];

const MODULES: { k: StudioModule; icon: any; ar: string; en: string; group: string }[] = [
  { k: 'pages', icon: FileText, ar: 'الصفحات', en: 'Pages', group: 'Content' },
  { k: 'assistant', icon: Sparkles, ar: 'مساعد الذكاء', en: 'AI Assistant', group: 'Content' },
  { k: 'nav', icon: Navigation2, ar: 'التنقل', en: 'Navigation', group: 'Content' },
  { k: 'footer', icon: PanelBottom, ar: 'التذييل', en: 'Footer', group: 'Content' },
  { k: 'blog', icon: FileText, ar: 'المدونة', en: 'Blog', group: 'Content' },
  { k: 'theme', icon: Palette, ar: 'الثيم', en: 'Theme', group: 'Design' },
  { k: 'brand', icon: Wand2, ar: 'الهوية', en: 'Brand', group: 'Design' },
  { k: 'media', icon: ImageIcon, ar: 'الوسائط', en: 'Media', group: 'Design' },
  { k: 'settings', icon: Settings2, ar: 'الإعدادات', en: 'Settings', group: 'System' },
  { k: 'domain', icon: Globe, ar: 'النطاق', en: 'Domain', group: 'System' },
  { k: 'history', icon: HistoryIcon, ar: 'الإصدارات', en: 'History', group: 'System' },
];
const DEVICE_W: Record<DeviceMode, Record<Orientation, number>> = {
  desktop: { portrait: 1280, landscape: 1280 },
  tablet: { portrait: 820, landscape: 1180 },
  mobile: { portrait: 390, landscape: 844 },
};

function readableOn(hex: string): string {
  const h = (hex || '').replace('#', ''); if (h.length < 6) return '#0c2000';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0c2000' : '#ffffff';
}
/** Theme tokens derived from the tenant brand → applied to the preview so it re-skins live. */
function themeVars(t: Record<string, any> | null): React.CSSProperties {
  const primary = t?.primary_color || '#A3F95B';
  const accent = t?.accent_color || t?.primary_color || '#6ee7ff';
  const radius = t?.card_radius != null ? Number(t.card_radius) : 20;
  const btnR = t?.button_radius != null ? Number(t.button_radius) : 14;
  return { ['--color-primary-fixed' as any]: primary, ['--color-on-primary-fixed' as any]: readableOn(primary), ['--color-tertiary-fixed' as any]: accent, ['--card-radius' as any]: `${radius}px`, ['--button-radius' as any]: `${btnR}px` };
}

// ══════════════════════════════════════════════════════════════════════════════
// Website Studio
// ══════════════════════════════════════════════════════════════════════════════
export const WebsiteCenter: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [brand, setBrand] = useState<Record<string, any> | null>(null);
  const [site, setSite] = useState<WebsiteSite | null>(null);
  const [module, setModule] = useState<StudioModule | MarketingModule>('pages');
  const [pageId, setPageId] = useState('');
  const [postId, setPostId] = useState('');
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [orient, setOrient] = useState<Orientation>('portrait');
  const [undo, setUndo] = useState<WebsiteSite[]>([]);
  const [redo, setRedo] = useState<WebsiteSite[]>([]);
  const [savedAt, setSavedAt] = useState<number>(0);
  const [versions, setVersions] = useState<{ version: number; at: string }[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { tenantService.list().then(({ data }) => { const ts = (data as any[]) || []; setTenants(ts); if (ts[0]) setTenantId(String(ts[0].id)); }); }, []);
  const loadTenant = (id: string) => {
    const s = websiteService.getDraftSite(id);
    setSite(s);
    setVersions(websiteService.listVersions(id));
    setBrand(tenants.find(t => String(t.id) === String(id)) || null);
    setUndo([]); setRedo([]); setSelIdx(null);
    const home = s?.pages.find(p => p.path === '/') || s?.pages[0];
    setPageId(home?.id || '');
  };
  useEffect(() => { if (tenantId) loadTenant(tenantId); /* eslint-disable-next-line */ }, [tenantId, tenants.length]);

  // Studio diagnostics (parity vs the compiled baseline; schema health/migration report).
  // These hooks MUST be declared before the `if (!site)` early return below so the hook
  // order is identical on every render (Rules of Hooks).
  const parity = useMemo(() => (tenantId ? websiteService.parityReport(tenantId) : null), [tenantId, savedAt, site]);
  const health = useMemo(() => (tenantId ? websiteService.healthReport(tenantId) : null), [tenantId, savedAt, site]);

  if (!site) return (
    <div id="website_center" dir={dir} className="p-6">
      <EmptyStateBox Icon={Globe} title={L('لا يوجد مستأجر', 'No tenant selected')} description={L('اختر مستأجراً لبدء البناء.', 'Select a tenant to start building.')} />
    </div>
  );

  // ── Unified mutation: every change persists instantly (autosave) and is undoable ──
  const commit = (next: WebsiteSite) => {
    setUndo(u => [...u.slice(-49), site]);
    setRedo([]);
    websiteService.saveDraft(tenantId, next);
    setSite(next);
    setSavedAt(Date.now());
  };
  const patch = (p: Partial<WebsiteSite>) => commit({ ...site, ...p });
  const doUndo = () => { if (!undo.length) return; const prev = undo[undo.length - 1]; setRedo(r => [...r, site]); setUndo(u => u.slice(0, -1)); websiteService.saveDraft(tenantId, prev); setSite(prev); setSavedAt(Date.now()); };
  const doRedo = () => { if (!redo.length) return; const nxt = redo[redo.length - 1]; setUndo(u => [...u, site]); setRedo(r => r.slice(0, -1)); websiteService.saveDraft(tenantId, nxt); setSite(nxt); setSavedAt(Date.now()); };

  const publish = () => { websiteService.publish(tenantId); setVersions(websiteService.listVersions(tenantId)); toast.success(L('تم النشر — مباشر الآن', 'Published — live now')); };
  const preview = () => { try { window.open(`/?site=${site.slug}&preview=1`, '_blank'); } catch { /* ignore */ } };
  const rollback = (v: number) => { websiteService.rollback(tenantId, v); loadTenant(tenantId); toast.success(L('تمت الاستعادة', 'Rolled back')); };

  const selectedPage = site.pages.find(p => p.id === pageId) || site.pages[0] || null;
  const selectedPost = site.blog.find(b => b.id === postId) || null;

  // Page/section mutations flow through commit (so undo/redo + autosave are unified).
  const setPage = (np: WebsitePage) => commit({ ...site, pages: site.pages.map(p => (p.id === np.id ? np : p)) });
  const setSections = (sections: WebsiteBlock[]) => { if (selectedPage) setPage({ ...selectedPage, sections }); };
  const addPage = () => {
    const id = `p_${Date.now().toString(36)}`;
    const np: WebsitePage = { id, path: `/page-${site.pages.length + 1}`, kind: 'custom', title: 'New page', nav: true, navOrder: 50, seo: {}, sections: [newBlock('hero')] };
    commit({ ...site, pages: [...site.pages, np] }); setPageId(id); setModule('pages'); setSelIdx(0);
  };
  const removePage = (id: string) => { commit({ ...site, pages: site.pages.filter(p => p.id !== id) }); setPageId(site.pages.find(p => p.id !== id)?.id || ''); setSelIdx(null); };

  const saveBrand = (patchObj: Record<string, any>) => {
    const next = { ...(brand || {}), ...patchObj };
    setBrand(next);
    setTenants(ts => ts.map(t => (String(t.id) === String(tenantId) ? { ...t, ...patchObj } : t)));
    tenantService.saveBranding(tenantId, patchObj).catch(() => { /* best-effort in sandbox */ });
  };
  const isFlagship = marketingService.isFlagship(site.slug) || marketingService.isFlagship(site.siteName);
  const user = 'admin';

  // AI Marketing Assistant — reuses the EXISTING Studio blocks (newBlock) + Theme/SEO; never duplicates structures.
  const handleGenerate = (recipe: string) => {
    if (!selectedPage) { toast.error(L('اختر صفحة أولاً', 'Select a page first')); return; }
    const add = (blocks: WebsiteBlock[], label: string) => { setSections([...selectedPage.sections, ...blocks]); setModule('pages'); setSelIdx(selectedPage.sections.length); marketingService.audit(tenantId, user, 'ai.generate', label); toast.success(label); };
    const heroLike = (title: string, subtitle: string, cta: string, href: string): WebsiteBlock => ({ type: 'hero', title, subtitle, layout: 'center', overlay: 0.5, ctas: [{ label: cta, href, style: 'primary' }] });
    switch (recipe) {
      case 'ramadan_home': return add([heroLike('Ramadan Kareem', 'Iftar delivered on time, every night — with special Ramadan offers.', 'Order iftar', '/restaurants'), { ...newBlock('deals'), heading: 'Ramadan offers' } as WebsiteBlock, newBlock('steps')], L('تم إنشاء أقسام رمضان', 'Ramadan sections added'));
      case 'black_friday': return add([heroLike('Black Friday — up to 50% off', 'One weekend only. Deals across restaurants, grocery and pharmacy.', 'Shop deals', '/offers'), { ...newBlock('deals'), heading: 'Black Friday deals' } as WebsiteBlock], L('تمت إضافة الجمعة البيضاء', 'Black Friday added'));
      case 'pharmacy_campaign': return add([heroLike('Pharmacy, delivered discreetly', 'Medicines and wellness to your door in minutes.', 'Order now', '/pharmacy'), { ...newBlock('merchants'), heading: 'Pharmacies near you' } as WebsiteBlock], L('تمت إضافة حملة الصيدلية', 'Pharmacy campaign added'));
      case 'rewrite_hero': {
        const i = selectedPage.sections.findIndex(s => s.type === 'hero');
        if (i < 0) return add([heroLike('Everything delivered, fast', 'Restaurants, grocery and pharmacy — one app, live tracking, cash on delivery.', 'Order now', '/menu')], L('تمت إضافة هيرو', 'Hero added'));
        const nb: WebsiteBlock = { ...(selectedPage.sections[i] as any), title: 'Your city, delivered', subtitle: 'Order in a few taps, pay cash at your door, and track every delivery live.' };
        setSections(selectedPage.sections.map((x, j) => j === i ? nb : x)); setSelIdx(i); setModule('pages'); marketingService.audit(tenantId, user, 'ai.generate', 'rewrite_hero'); return toast.success(L('أعيدت صياغة الهيرو', 'Hero rewritten'));
      }
      case 'improve_seo': { patch({ seoDefaults: { ...site.seoDefaults, title: `${site.siteName} — Food, grocery & pharmacy delivery`, description: `Order food, groceries and pharmacy from top local merchants with ${site.siteName}. Fast delivery, live tracking and cash on delivery.` } }); setModule('seostudio'); marketingService.audit(tenantId, user, 'ai.generate', 'improve_seo'); return toast.success(L('تم تحسين الـ SEO', 'SEO improved')); }
      case 'increase_conversions': { setModule('conversion'); return toast.success(L('افتح مركز التحويل لإضافة عنصر', 'Opened Conversion Center — add a widget')); }
      default: return;
    }
  };

  // ── AI Website Assistant — generates & transforms real CMS blocks (smart templates
  //    + deterministic text transforms). Everything it produces is Studio-editable. ──
  const handleAssist = (action: string) => {
    if (!selectedPage) { toast.error(L('اختر صفحة أولاً', 'Select a page first')); return; }
    const secs = selectedPage.sections;
    const append = (blocks: WebsiteBlock[], msg: string) => { setSections([...secs, ...blocks]); setModule('pages'); setSelIdx(secs.length); marketingService.audit(tenantId, user, 'ai.assist', action); toast.success(msg); };
    const replaceAt = (i: number, nb: WebsiteBlock, msg: string) => { setSections(secs.map((x, j) => j === i ? nb : x)); setModule('pages'); setSelIdx(i); marketingService.audit(tenantId, user, 'ai.assist', action); toast.success(msg); };
    // Pick the working text block: current selection, else first block with editable prose.
    const textIdx = (selIdx != null && secs[selIdx]) ? selIdx : secs.findIndex(s => typeof (s as any).body === 'string' || typeof (s as any).subtitle === 'string' || typeof (s as any).title === 'string');
    switch (action) {
      case 'hero': { const i = secs.findIndex(s => s.type === 'hero'); const nb = aiStudio.genHero(site, String(secs.length)); return i >= 0 ? replaceAt(i, { ...(secs[i] as any), ...nb }, L('أُعيدت صياغة الهيرو', 'Hero regenerated')) : append([nb], L('تمت إضافة هيرو', 'Hero added')); }
      case 'cta': return append([aiStudio.genCTA(site)], L('تمت إضافة دعوة لإجراء', 'CTA added'));
      case 'faq': return append([aiStudio.genFAQ()], L('تمت إضافة الأسئلة الشائعة', 'FAQ added'));
      case 'landing': return append(aiStudio.genLanding(site), L('تم إنشاء صفحة هبوط', 'Landing page generated'));
      case 'marketing': return append(aiStudio.genMarketing(), L('تمت إضافة أقسام تسويقية', 'Marketing sections added'));
      case 'seo': { const s = aiStudio.improveSEO(site); patch({ seoDefaults: { ...site.seoDefaults, ...s } }); marketingService.audit(tenantId, user, 'ai.assist', 'seo'); return toast.success(L('تم تحسين الـ SEO', 'SEO improved')); }
      case 'rewrite': {
        if (textIdx < 0) return toast.error(L('لا يوجد نص لإعادة صياغته', 'No text to rewrite'));
        const b: any = secs[textIdx]; const nb = { ...b };
        for (const k of ['title', 'subtitle', 'heading', 'body']) if (typeof b[k] === 'string') nb[k] = aiStudio.tightenText(b[k]);
        return replaceAt(textIdx, nb, L('أُعيدت الصياغة', 'Content rewritten'));
      }
      case 'readability': {
        if (textIdx < 0) return toast.error(L('لا يوجد نص', 'No text found'));
        const b: any = secs[textIdx]; const nb = { ...b };
        for (const k of ['subtitle', 'body']) if (typeof b[k] === 'string') nb[k] = aiStudio.improveReadability(b[k]);
        return replaceAt(textIdx, nb, L('تم تحسين القراءة', 'Readability improved'));
      }
      case 'conversion': { const cta = aiStudio.genCTA(site); return append([{ ...cta, style: aiStudio.CONVERSION_STYLE } as WebsiteBlock, newBlock('waitlist')], L('تمت إضافة عناصر رفع التحويل', 'Conversion boosters added')); }
      case 'translate': {
        // The public site is bilingual automatically (localizeSite). Audit this page's
        // Arabic coverage and report which strings still fall back to English.
        const walk = (o: any): string[] => Array.isArray(o) ? o.flatMap(walk) : (o && typeof o === 'object') ? Object.values(o).flatMap(walk) : (typeof o === 'string' ? [o] : []);
        const arPage = localizeSite({ ...site, pages: [selectedPage] } as any, 'ar').pages[0];
        const pending = walk(arPage.sections).filter(s => /[a-zA-Z]{3,}/.test(s) && !/^(\/|#|https?:)|\.(png|jpe?g|svg|webp|mp4)$/i.test(s)).length;
        marketingService.audit(tenantId, user, 'ai.assist', 'translate');
        return pending === 0
          ? toast.success(L('عربية كاملة لهذه الصفحة ✓', 'Arabic coverage complete for this page ✓'))
          : toast.success(L(`${pending} نص يعود للإنجليزية — حرّره ليظهر بالعربية`, `${pending} strings fall back to English — edit them to localise`));
      }
      default: return;
    }
  };

  const frameW = DEVICE_W[device][orient];
  const previewPage = selectedPage;
  // Environment content-parity: does this browser's published content match the compiled
  // single source of truth? A drift = local-only edits not shared with other environments.

  const dTab = (m: DeviceMode, Icon: any) => <button onClick={() => setDevice(m)} id={`studio_device_${m}`} title={m} style={{ ...iconBtn, width: 32, height: 30, background: device === m ? 'var(--color-primary-fixed)' : 'transparent', color: device === m ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}><Icon size={15} /></button>;

  return (
    <div id="website_center" dir={dir} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 90px)', minHeight: 560 }}>
      {/* ── Studio top bar ── */}
      <div className="flex items-center gap-2 flex-wrap" style={{ ...card, borderRadius: 12, padding: '8px 12px', marginBottom: 10 }}>
        <span className="inline-flex items-center gap-2 font-extrabold" style={{ color: 'var(--color-on-surface)', fontSize: 15 }}><Wand2 size={17} style={{ color: 'var(--color-primary-fixed)' }} />{L('استوديو الموقع', 'Website Studio')}</span>
        <select value={tenantId} onChange={e => setTenantId(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '6px 9px' }} id="website_tenant_select">
          {tenants.map(t => <option key={t.id} value={String(t.id)}>{t.brand_name || t.slug}</option>)}
        </select>

        {/* Environment parity validator — warns when this browser's published content
            has drifted from the compiled single source of truth (i.e., differs across envs). */}
        {parity && (
          <span id="studio_parity" title={parity.drifted
            ? L('نُشرت تعديلات محليّة لا توجد في الأساس المُجمَّع؛ قد تختلف عن بيئات أخرى حتى تُنشر في الكود.', 'Locally-published edits differ from the compiled baseline; other environments will differ until published in code.')
            : L(`متطابق مع كل البيئات · ${parity.codeVersion}`, `In sync across all environments · ${parity.codeVersion}`)}
            className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ padding: '4px 9px', borderRadius: 999,
              background: parity.drifted ? 'rgba(245,158,11,0.14)' : 'rgba(74,222,128,0.14)',
              color: parity.drifted ? '#f5a623' : '#4ade80', border: `1px solid ${parity.drifted ? 'rgba(245,158,11,0.3)' : 'rgba(74,222,128,0.3)'}` }}>
            {parity.drifted ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
            {parity.drifted ? L('تعديلات محليّة', 'Local drift') : L('متطابق', 'In sync')}
          </span>
        )}

        {/* Website Health Monitor — schema version + validation + last migration (Super Admin). */}
        {health && (
          <span id="studio_health" title={[
            L(`إصدار المخطط: v${health.schemaVersion} / v${health.latest}`, `Schema: v${health.schemaVersion} / latest v${health.latest}`),
            health.valid ? L('التحقق: صحيح', 'Validation: valid') : L(`مشاكل: ${health.issues.join(', ')}`, `Issues: ${health.issues.join(', ')}`),
            L(`الحجم: ${(health.storageBytes / 1024).toFixed(1)}KB`, `Storage: ${(health.storageBytes / 1024).toFixed(1)}KB`),
            health.lastReport ? L(`آخر ترقية: v${health.lastReport.fromVersion}→v${health.lastReport.toVersion} · أُنشئ ${health.lastReport.created.length} · أُصلح ${health.lastReport.repaired.length} · حُوِّل ${health.lastReport.renamed.length}${health.lastReport.recovered ? ' · مُستعاد' : ''}`, `Last migration: v${health.lastReport.fromVersion}→v${health.lastReport.toVersion} · created ${health.lastReport.created.length} · repaired ${health.lastReport.repaired.length} · renamed ${health.lastReport.renamed.length}${health.lastReport.recovered ? ' · recovered' : ''}`) : L('لا ترقيات', 'No migrations'),
          ].join(' · ')}
            className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ padding: '4px 9px', borderRadius: 999,
              background: health.valid && health.upToDate ? 'rgba(74,222,128,0.14)' : 'rgba(245,158,11,0.14)',
              color: health.valid && health.upToDate ? '#4ade80' : '#f5a623', border: `1px solid ${health.valid && health.upToDate ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
            <HeartPulse size={12} />{L('المخطط', 'Schema')} v{health.schemaVersion}{health.valid ? '' : ' ⚠'}
          </span>
        )}

        {/* Device switcher */}
        <div className="inline-flex items-center gap-1 ms-1" style={{ ...card, borderRadius: 999, padding: 3 }}>
          {dTab('desktop', Monitor)}{dTab('tablet', Tablet)}{dTab('mobile', Smartphone)}
          <button onClick={() => setOrient(o => (o === 'portrait' ? 'landscape' : 'portrait'))} id="studio_orientation" title={L('تدوير', 'Rotate')} disabled={device === 'desktop'}
            style={{ ...iconBtn, width: 32, height: 30, background: orient === 'landscape' && device !== 'desktop' ? 'var(--color-primary-fixed)' : 'transparent', color: orient === 'landscape' && device !== 'desktop' ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)', opacity: device === 'desktop' ? 0.4 : 1 }}><RotateCw size={14} /></button>
        </div>

        <div className="flex items-center gap-1.5 ms-auto">
          <button onClick={doUndo} disabled={!undo.length} id="studio_undo" title={L('تراجع', 'Undo')} style={{ ...iconBtn, opacity: undo.length ? 1 : 0.4 }}><Undo2 size={15} /></button>
          <button onClick={doRedo} disabled={!redo.length} id="studio_redo" title={L('إعادة', 'Redo')} style={{ ...iconBtn, opacity: redo.length ? 1 : 0.4 }}><Redo2 size={15} /></button>
          <span className="inline-flex items-center gap-1 text-[11px] px-2" style={{ color: 'var(--color-on-surface-variant)' }} id="studio_saved"><Check size={12} style={{ color: '#4ade80' }} />{savedAt ? L('تم الحفظ', 'Saved') : L('حفظ تلقائي', 'Autosave on')}</span>
          <Btn onClick={preview} id="website_preview_btn"><Eye size={14} />{L('معاينة', 'Preview')}</Btn>
          <Btn onClick={publish} primary id="website_publish_btn"><UploadCloud size={14} />{L('نشر', 'Publish')}</Btn>
        </div>
      </div>

      {/* ── Three-panel workspace ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '248px minmax(0,1fr) 340px', gap: 10 }}>
        {/* LEFT — Structure navigator */}
        <div style={{ ...card, padding: 8, overflow: 'auto' }} id="studio_left">
          {['Content', 'Design', 'System'].map(group => (
            <div key={group} className="mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wide px-2 mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{group}</p>
              {MODULES.filter(m => m.group === group).map(m => {
                const on = module === m.k;
                return (
                  <button key={m.k} id={`studio_mod_${m.k}`} onClick={() => { setModule(m.k); if (m.k !== 'pages') setSelIdx(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-start mb-0.5"
                    style={{ background: on ? 'var(--color-primary-fixed)' : 'transparent', color: on ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface)' }}>
                    <m.icon size={15} /><span className="text-[13px] font-semibold">{L(m.ar, m.en)}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <MarketingNav active={module} onSelect={(m) => { setModule(m); setSelIdx(null); }} L={L} />

          {/* Contextual list */}
          {module === 'pages' && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الصفحات', 'Pages')}</span>
                <button onClick={addPage} id="studio_add_page" style={{ ...iconBtn, width: 26, height: 26 }}><Plus size={14} /></button>
              </div>
              {site.pages.map(p => (
                <button key={p.id} onClick={() => { setPageId(p.id); setSelIdx(null); }} className="w-full text-start px-2 py-1.5 rounded-md text-[12px] cursor-pointer mb-0.5" style={{ background: pageId === p.id ? 'var(--color-surface-container-high)' : 'transparent', color: 'var(--color-on-surface)' }}>
                  <span className="font-semibold">{p.title}</span><span className="block text-[10px] opacity-70">{p.path}</span>
                </button>
              ))}
              {selectedPage && (
                <>
                  <div className="flex items-center justify-between px-1 mt-3 mb-1">
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الأقسام', 'Sections')}</span>
                    <button onClick={() => setShowAdd(v => !v)} id="studio_add_section" style={{ ...iconBtn, width: 26, height: 26, background: showAdd ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: showAdd ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}><Plus size={14} /></button>
                  </div>
                  {showAdd && (
                    <div id="section_palette" className="grid grid-cols-2 gap-1 p-1.5 rounded-lg mb-1.5" style={{ background: 'var(--color-surface-container-high)' }}>
                      {BLOCK_TYPES.map(t => <button key={t} id={`add_${t}`} onClick={() => { setSections([...selectedPage.sections, newBlock(t)]); setSelIdx(selectedPage.sections.length); setShowAdd(false); }} className="px-1.5 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer" style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>{BLOCK_LABEL[t]}</button>)}
                      <select value="" onChange={e => { const tpl = SECTION_TEMPLATES.find(x => x.key === e.target.value); if (tpl) { setSections([...selectedPage.sections, ...tpl.make().map(newBlock)]); setShowAdd(false); } }} className="col-span-2 mt-0.5" style={{ ...inputStyle, padding: '6px 8px', fontSize: 11 }} id="studio_template_add">
                        <option value="">{L('قالب أقسام…', 'Section template…')}</option>
                        {SECTION_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                    </div>
                  )}
                  <div id="section_list">
                    {selectedPage.sections.map((b, i) => (
                      <SectionRow key={i} idx={i} block={b} selected={selIdx === i} L={L}
                        onSelect={() => { setSelIdx(i); setModule('pages'); }}
                        onToggle={() => setSections(selectedPage.sections.map((x, j) => j === i ? { ...x, enabled: x.enabled === false ? true : false } : x))}
                        onDup={() => { const s = selectedPage.sections.slice(); s.splice(i + 1, 0, JSON.parse(JSON.stringify(b))); setSections(s); }}
                        onDel={() => { setSections(selectedPage.sections.filter((_, j) => j !== i)); setSelIdx(null); }}
                        onMove={(d) => { const to = i + d; if (to < 0 || to >= selectedPage.sections.length) return; setSections(swap(selectedPage.sections, i, to)); setSelIdx(to); }}
                        onDropReorder={(from) => { if (from === i) return; const s = selectedPage.sections.slice(); const [m] = s.splice(from, 1); s.splice(i, 0, m); setSections(s); }} />
                    ))}
                    {selectedPage.sections.length === 0 && <p className="text-[11px] text-center py-3" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا أقسام بعد', 'No sections yet')}</p>}
                  </div>
                </>
              )}
            </div>
          )}
          {module === 'blog' && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
              <div className="flex items-center justify-between px-1 mb-1"><span className="text-[10px] font-bold uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>{L('المقالات', 'Posts')}</span>
                <button id="studio_add_post" onClick={() => { const post: BlogPost = { id: `b_${Date.now().toString(36)}`, slug: `post-${site.blog.length + 1}`, title: 'New post', excerpt: '', body: [{ type: 'richtext', body: '' }], author: site.siteName, publishedAt: new Date().toISOString(), tags: [], seo: {} }; commit({ ...site, blog: [post, ...site.blog] }); setPostId(post.id); }} style={{ ...iconBtn, width: 26, height: 26 }}><Plus size={14} /></button></div>
              {site.blog.map(b => <button key={b.id} onClick={() => setPostId(b.id)} className="w-full text-start px-2 py-1.5 rounded-md text-[12px] cursor-pointer mb-0.5" style={{ background: postId === b.id ? 'var(--color-surface-container-high)' : 'transparent', color: 'var(--color-on-surface)' }}><span className="font-semibold">{b.title}</span><span className="block text-[10px] opacity-70">/blog/{b.slug}</span></button>)}
            </div>
          )}
        </div>

        {/* CENTER — live canvas */}
        <div style={{ ...card, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--color-background)' }} id="studio_center">
          <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
            <span className="text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#4ade80' }} />{L('معاينة مباشرة', 'Live preview')} · {device} {device !== 'desktop' ? orient : ''}</span>
            {module === 'pages' && <span className="text-[11px] ms-auto inline-flex items-center gap-1" style={{ color: 'var(--color-on-surface-variant)' }}><MousePointerClick size={12} />{L('انقر أي قسم للتحرير', 'Click any section to edit')}</span>}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', placeItems: 'start center' }} id="studio_canvas">
            {module === 'media'
              ? <MediaLibrary lang={lang} L={L} />
              : (
                <div style={{ width: device === 'desktop' ? '100%' : frameW, maxWidth: '100%', transition: 'width .25s ease' }}>
                  <div style={{ ...themeVars(brand), background: 'var(--color-background, #0a0f0c)', border: '1px solid var(--color-outline-variant)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px -30px rgba(0,0,0,.6)', position: 'relative' }} id="preview_frame">
                    <LivePreview site={site} page={previewPage} device={device} brand={brand} lang={lang}
                      selectedIdx={module === 'pages' ? selIdx : null}
                      onSelect={(i) => { setModule('pages'); setSelIdx(i); }}
                      onEdit={(idx, patch) => { if (previewPage) setSections(previewPage.sections.map((x, j) => j === idx ? { ...x, ...patch } as WebsiteBlock : x)); }}
                      onReorder={(from, to) => { if (previewPage) { const s = previewPage.sections.slice(); const [m] = s.splice(from, 1); s.splice(to, 0, m); setSections(s); setSelIdx(to); } }}
                      onAction={(idx, a) => {
                        if (!previewPage) return;
                        const s = previewPage.sections; const b = s[idx];
                        if (a === 'edit') { setModule('pages'); setSelIdx(idx); return; }
                        if (a === 'lock') { setSections(s.map((x, j) => j === idx ? { ...x, locked: !x.locked } : x)); return; }
                        if (b.locked && (a === 'up' || a === 'down' || a === 'del')) { toast.error(L('القسم مقفل', 'Section is locked')); return; }
                        if (a === 'up') { const to = Math.max(0, idx - 1); const n = s.slice(); const [m] = n.splice(idx, 1); n.splice(to, 0, m); setSections(n); setSelIdx(to); }
                        else if (a === 'down') { const to = Math.min(s.length - 1, idx + 1); const n = s.slice(); const [m] = n.splice(idx, 1); n.splice(to, 0, m); setSections(n); setSelIdx(to); }
                        else if (a === 'dup') { const n = s.slice(); n.splice(idx + 1, 0, JSON.parse(JSON.stringify(b))); setSections(n); setSelIdx(idx + 1); }
                        else if (a === 'hide') { setSections(s.map((x, j) => j === idx ? { ...x, enabled: x.enabled === false ? true : false } : x)); }
                        else if (a === 'del') { setSections(s.filter((_, j) => j !== idx)); setSelIdx(null); }
                      }} />
                    {campaignOverlayFor(module, tenantId, isFlagship)}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* RIGHT — properties */}
        <div style={{ ...card, padding: 14, overflow: 'auto' }} id="studio_right">
          {MARKETING_MODULES.includes(module as MarketingModule) ? (
            <MarketingPanel module={module as MarketingModule} tenantId={tenantId} user={user} site={site} brand={brand} lang={lang} L={L} isFlagship={isFlagship} onPatchSite={patch} onGenerate={handleGenerate} versions={versions} onRollback={rollback} />
          ) : module === 'pages' && selectedPage && selIdx != null && selectedPage.sections[selIdx] ? (
            <SectionProperties page={selectedPage} idx={selIdx} L={L} lang={lang}
              onChange={(nb) => setSections(selectedPage.sections.map((x, j) => j === selIdx ? nb : x))}
              onVis={(k, on) => setSections(selectedPage.sections.map((x, j) => j === selIdx ? { ...x, visibility: { ...x.visibility, [k]: on } } : x))}
              onClose={() => setSelIdx(null)} />
          ) : module === 'assistant' ? (
            <AIAssistant L={L} onAssist={handleAssist} />
          ) : module === 'pages' && selectedPage ? (
            <PageProps page={selectedPage} L={L} onChange={setPage} onRemove={() => removePage(selectedPage.id)} />
          ) : module === 'theme' ? (
            <ThemeStudio brand={brand} L={L} onSave={saveBrand} />
          ) : module === 'brand' ? (
            <BrandStudio brand={brand} L={L} lang={lang} onSave={saveBrand} />
          ) : module === 'media' ? (
            <MediaRightInfo L={L} />
          ) : module === 'nav' ? (
            <NavEditor site={site} L={L} patch={patch} />
          ) : module === 'footer' ? (
            <FooterEditor site={site} L={L} patch={patch} />
          ) : module === 'settings' ? (
            <SettingsEditor site={site} L={L} patch={patch} />
          ) : module === 'domain' ? (
            <DomainEditor site={site} L={L} patch={patch} />
          ) : module === 'blog' ? (
            selectedPost ? <PostEditor post={selectedPost} onChange={p => commit({ ...site, blog: site.blog.map(b => b.id === p.id ? p : b) })} onRemove={() => { commit({ ...site, blog: site.blog.filter(b => b.id !== selectedPost.id) }); setPostId(''); }} L={L} /> : <EmptyStateBox Icon={FileText} title={L('اختر مقالاً', 'Select a post')} />
          ) : module === 'history' ? (
            <HistoryPanel versions={versions} L={L} onRollback={rollback} />
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ── Left section-tree row (select · toggle · dup · delete · reorder · drag) ──
const SectionRow: React.FC<{ idx: number; block: WebsiteBlock; selected: boolean; L: (a: string, e: string) => string; onSelect: () => void; onToggle: () => void; onDup: () => void; onDel: () => void; onMove: (d: number) => void; onDropReorder: (from: number) => void }> = ({ idx, block, selected, L, onSelect, onToggle, onDup, onDel, onMove, onDropReorder }) => {
  const on = block.enabled !== false;
  return (
    <div draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(idx))} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); if (!Number.isNaN(from)) onDropReorder(from); }}
      id={`section_${idx}`} onClick={onSelect}
      className="flex items-center gap-1 px-1.5 py-1 rounded-md mb-0.5 cursor-pointer" style={{ background: selected ? 'color-mix(in srgb, var(--color-primary-fixed) 18%, transparent)' : 'var(--color-surface-container-high)', outline: selected ? '1px solid var(--color-primary-fixed)' : 'none', opacity: on ? 1 : 0.5 }}>
      <span style={{ cursor: 'grab', color: 'var(--color-on-surface-variant)' }}><GripVertical size={13} /></span>
      <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: 'var(--color-on-surface)' }}>{BLOCK_LABEL[block.type]}</span>
      <button onClick={e => { e.stopPropagation(); onToggle(); }} id={`toggle_${idx}`} title={on ? L('تعطيل', 'Disable') : L('تفعيل', 'Enable')} style={{ ...miniBtn, color: on ? '#4ade80' : 'var(--color-on-surface-variant)' }}><Power size={12} /></button>
      <button onClick={e => { e.stopPropagation(); onMove(-1); }} style={miniBtn}><ChevronUp size={12} /></button>
      <button onClick={e => { e.stopPropagation(); onMove(1); }} style={miniBtn}><ChevronDown size={12} /></button>
      <button onClick={e => { e.stopPropagation(); onDup(); }} id={`dup_${idx}`} title={L('تكرار', 'Duplicate')} style={miniBtn}><Copy size={12} /></button>
      <button onClick={e => { e.stopPropagation(); onDel(); }} id={`del_${idx}`} title={L('حذف', 'Delete')} style={{ ...miniBtn, color: '#f87171' }}><Trash2 size={12} /></button>
    </div>
  );
};
const miniBtn: React.CSSProperties = { width: 22, height: 22, borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--color-on-surface-variant)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };

// ── Live preview canvas (reuses the public BlockRenderer; click-to-select; floating
//    toolbar + right-click context menu; respects per-section lock; header+footer) ──
type SecAction = 'up' | 'down' | 'dup' | 'hide' | 'lock' | 'del' | 'edit';
const LivePreview: React.FC<{ site: WebsiteSite; page: WebsitePage | null; device: DeviceMode; brand: Record<string, any> | null; selectedIdx: number | null; lang: 'ar' | 'en'; onSelect: (i: number) => void; onReorder: (from: number, to: number) => void; onEdit: (idx: number, patch: Partial<WebsiteBlock>) => void; onAction: (idx: number, a: SecAction) => void }> = ({ site, page, device, brand, selectedIdx, lang, onSelect, onReorder, onEdit, onAction }) => {
  const [menu, setMenu] = useState<{ x: number; y: number; idx: number } | null>(null);
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  if (!page) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>No page</div>;
  const sections = page.sections;
  const visible = (b: WebsiteBlock) => b.enabled !== false && (!b.visibility || (device === 'desktop' ? b.visibility.desktop !== false : device === 'tablet' ? b.visibility.tablet !== false : b.visibility.mobile !== false));
  const openMenu = (e: React.MouseEvent, i: number) => { e.preventDefault(); e.stopPropagation(); const host = (e.currentTarget as HTMLElement).closest('#preview_frame') as HTMLElement | null; const r = host?.getBoundingClientRect(); setMenu({ x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0), idx: i }); onSelect(i); };
  const menuItems: { a: SecAction; icon: any; ar: string; en: string; danger?: boolean }[] = [
    { a: 'edit', icon: Pencil, ar: 'تحرير', en: 'Edit' },
    { a: 'up', icon: ChevronUp, ar: 'تحريك لأعلى', en: 'Move up' },
    { a: 'down', icon: ChevronDown, ar: 'تحريك لأسفل', en: 'Move down' },
    { a: 'dup', icon: Copy, ar: 'تكرار', en: 'Duplicate' },
    { a: 'hide', icon: Eye, ar: 'إخفاء/إظهار', en: 'Hide / show' },
    { a: 'lock', icon: Lock, ar: 'قفل/فتح', en: 'Lock / unlock' },
    { a: 'del', icon: Trash2, ar: 'حذف', en: 'Delete', danger: true },
  ];
  return (
    <div onClick={() => menu && setMenu(null)}>
      {/* Inject the SAME motion/interaction stylesheet the public site uses, so the Studio
          preview renders through the identical production pipeline (hover lifts, reveals,
          glass blur, micro-interactions) instead of a static canvas. Production == Preview. */}
      <BlockStyles />
      <style>{`#preview_frame .wsx-sec{position:relative;transition:box-shadow .12s ease}#preview_frame .wsx-sec:hover{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--color-primary-fixed) 55%,transparent)}#preview_frame .wsx-sec.sel{box-shadow:inset 0 0 0 2px var(--color-primary-fixed)}#preview_frame .wsx-sec.locked{box-shadow:inset 0 0 0 2px color-mix(in srgb,#f5a623 55%,transparent)}#preview_frame .wsx-bar{position:absolute;top:8px;inset-inline-end:8px;z-index:5;display:none;gap:4px}#preview_frame .wsx-sec:hover .wsx-bar,#preview_frame .wsx-sec.sel .wsx-bar{display:flex}#preview_frame .wsx-tag{position:absolute;top:8px;inset-inline-start:8px;z-index:5;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:var(--color-primary-fixed);color:var(--color-on-primary-fixed);display:none;align-items:center;gap:4px}#preview_frame .wsx-sec.sel .wsx-tag,#preview_frame .wsx-sec.locked .wsx-tag{display:inline-flex}`}</style>
      {/* Site header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid var(--color-outline-variant, #2a3330)', background: 'color-mix(in srgb, var(--color-background,#0a0f0c) 85%, transparent)' }}>
        {brand?.logo_url ? <img src={brand.logo_url} alt="" style={{ height: 22 }} /> : <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--color-primary-fixed)' }} />}
        <strong style={{ fontSize: 15, color: 'var(--color-on-surface, #e8ebe3)' }}>{site.siteName}</strong>
        {device !== 'mobile' && <nav style={{ marginInlineStart: 'auto', display: 'flex', gap: 12 }}>{site.navigation.slice(0, 6).map(n => <span key={n.path} style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant, #a7b0a6)' }}>{n.label}</span>)}</nav>}
        <span style={{ marginInlineStart: device === 'mobile' ? 'auto' : 12, padding: '6px 12px', borderRadius: 'var(--button-radius,12px)', background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: 12, fontWeight: 800 }}>Log in</span>
      </div>
      {/* Sections */}
      {sections.map((b, i) => visible(b) ? (
        <div key={i} className={`wsx-sec${selectedIdx === i ? ' sel' : ''}${b.locked ? ' locked' : ''}`} onClick={() => onSelect(i)} onContextMenu={e => openMenu(e, i)}
          draggable={!b.locked} onDragStart={e => { if (b.locked) { e.preventDefault(); return; } e.dataTransfer.setData('text/wsx', String(i)); }} onDragOver={e => { if (e.dataTransfer.types.includes('text/wsx')) e.preventDefault(); }} onDrop={e => { const from = Number(e.dataTransfer.getData('text/wsx')); if (!Number.isNaN(from)) onReorder(from, i); }}>
          <span className="wsx-tag">{b.locked && <Lock size={9} />}{BLOCK_LABEL[b.type]}</span>
          <div className="wsx-bar">
            <button title={L('تحرير', 'Edit')} onClick={e => { e.stopPropagation(); onAction(i, 'edit'); }} style={pvBtn}><Pencil size={12} /></button>
            <button title={L('أعلى', 'Up')} onClick={e => { e.stopPropagation(); if (!b.locked) onReorder(i, Math.max(0, i - 1)); }} style={{ ...pvBtn, opacity: b.locked ? 0.4 : 1 }}><ChevronUp size={13} /></button>
            <button title={L('أسفل', 'Down')} onClick={e => { e.stopPropagation(); if (!b.locked) onReorder(i, i + 1); }} style={{ ...pvBtn, opacity: b.locked ? 0.4 : 1 }}><ChevronDown size={13} /></button>
            <button title={L('تكرار', 'Duplicate')} onClick={e => { e.stopPropagation(); onAction(i, 'dup'); }} style={pvBtn}><Copy size={12} /></button>
            <button title={b.locked ? L('فتح', 'Unlock') : L('قفل', 'Lock')} onClick={e => { e.stopPropagation(); onAction(i, 'lock'); }} style={pvBtn}>{b.locked ? <Lock size={12} /> : <LockOpen size={12} />}</button>
            <button title={L('حذف', 'Delete')} onClick={e => { e.stopPropagation(); onAction(i, 'del'); }} style={{ ...pvBtn, opacity: b.locked ? 0.4 : 1 }}><Trash2 size={12} /></button>
          </div>
          {selectedIdx === i && !b.locked && <InlineEditor block={b} lang={lang} onEdit={(patch) => onEdit(i, patch)} />}
          <SectionShell block={b}><BlockRenderer block={b} onNav={() => {}} /></SectionShell>
        </div>
      ) : null)}
      {/* Right-click context menu */}
      {menu && (
        <div dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: menu.y, insetInlineStart: menu.x, zIndex: 40, minWidth: 176, padding: 6, borderRadius: 12, background: 'color-mix(in srgb, var(--color-surface-container-highest,#141a13) 96%, transparent)', border: '1px solid var(--color-outline-variant)', boxShadow: '0 16px 48px rgba(0,0,0,.55)', backdropFilter: 'blur(10px)' }}>
          {menuItems.map(m => (
            <button key={m.a} id={`ctx_${m.a}`} onClick={() => { onAction(menu.idx, m.a); setMenu(null); }} className="w-full flex items-center gap-2 text-[12px] font-semibold px-2.5 py-1.5 rounded-md cursor-pointer"
              style={{ color: m.danger ? '#f87171' : 'var(--color-on-surface)', background: 'transparent', textAlign: 'start' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-container-high)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <m.icon size={13} />{L(m.ar, m.en)}
            </button>
          ))}
        </div>
      )}
      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--color-outline-variant, #2a3330)', padding: '22px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant, #a7b0a6)' }}>{site.footer.copyright}</span>
        <div style={{ display: 'flex', gap: 12 }}>{site.footer.legalLinks.map(l => <span key={l.path} style={{ fontSize: 12, color: 'var(--color-on-surface-variant, #a7b0a6)' }}>{l.label}</span>)}</div>
      </div>
    </div>
  );
};
const pvBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 8, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

// ── In-canvas inline editor — click a section, edit its headline text & swap its
//    banner/video/logo/image directly on the live preview. Updates flow back through
//    the same setSections history (undo/redo/publish) as the right-rail editor. ──
const INLINE_TEXT: { field: string; ar: string; en: string; area?: boolean }[] = [
  { field: 'title', ar: 'العنوان', en: 'Title' },
  { field: 'heading', ar: 'العنوان', en: 'Heading' },
  { field: 'subtitle', ar: 'العنوان الفرعي', en: 'Subtitle', area: true },
  { field: 'body', ar: 'النص', en: 'Body', area: true },
];
const INLINE_MEDIA: { field: string; ar: string; en: string; kind: 'image' | 'video' }[] = [
  { field: 'bgImage', ar: 'صورة البانر', en: 'Banner image', kind: 'image' },
  { field: 'bgVideo', ar: 'فيديو الخلفية', en: 'Background video', kind: 'video' },
  { field: 'image', ar: 'الصورة', en: 'Image', kind: 'image' },
];
const InlineEditor: React.FC<{ block: WebsiteBlock; lang: 'ar' | 'en'; onEdit: (patch: Partial<WebsiteBlock>) => void }> = ({ block, lang, onEdit }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const b = block as any;
  const texts = INLINE_TEXT.filter(t => typeof b[t.field] === 'string');
  const media = INLINE_MEDIA.filter(m => m.field in b || (block.type === 'hero' && (m.field === 'bgImage' || m.field === 'bgVideo')));
  const cta = b.cta && typeof b.cta.label === 'string' ? b.cta : b.button && typeof b.button.label === 'string' ? b.button : null;
  const ctaKey = b.cta ? 'cta' : 'button';
  return (
    <div onClick={e => e.stopPropagation()} dir={lang === 'ar' ? 'rtl' : 'ltr'}
      style={{ position: 'absolute', top: 40, insetInlineStart: 8, zIndex: 6, width: 'min(340px, 82%)', maxHeight: '78%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: 'color-mix(in srgb, var(--color-surface-container-highest,#141a13) 92%, transparent)', border: '1px solid var(--color-primary-fixed)', boxShadow: '0 12px 40px rgba(0,0,0,.5)', backdropFilter: 'blur(10px)' }}>
      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--color-primary-fixed)' }}>{L('تحرير مباشر', 'Inline edit')} · {BLOCK_LABEL[block.type]}</span>
      {texts.map(t => t.area ? (
        <label key={t.field} style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>{L(t.ar, t.en)}
          <textarea id={`inline_${t.field}`} value={b[t.field]} onChange={e => onEdit({ [t.field]: e.target.value } as any)} rows={2} style={{ ...inputStyle, marginTop: 3, resize: 'vertical', width: '100%' }} />
        </label>
      ) : (
        <label key={t.field} style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>{L(t.ar, t.en)}
          <input id={`inline_${t.field}`} value={b[t.field]} onChange={e => onEdit({ [t.field]: e.target.value } as any)} style={{ ...inputStyle, marginTop: 3, width: '100%' }} />
        </label>
      ))}
      {cta && (
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>{L('زر الإجراء', 'Button label')}
          <input id="inline_cta" value={cta.label} onChange={e => onEdit({ [ctaKey]: { ...cta, label: e.target.value } } as any)} style={{ ...inputStyle, marginTop: 3, width: '100%' }} />
        </label>
      )}
      {media.map(m => (
        <MediaField key={m.field} label={L(m.ar, m.en)} value={b[m.field] || ''} kind={m.kind} onChange={u => onEdit({ [m.field]: u } as any)} lang={lang} />
      ))}
      {!texts.length && !media.length && !cta && <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{L('عدّل عناصر هذا القسم من اللوحة الجانبية.', 'Edit this section’s items from the side panel.')}</span>}
    </div>
  );
};

// ── Right: section properties (reuses BlockEditor) + section controls ──
const SectionProperties: React.FC<{ page: WebsitePage; idx: number; L: (a: string, e: string) => string; lang: 'ar' | 'en'; onChange: (b: WebsiteBlock) => void; onVis: (k: 'desktop' | 'tablet' | 'mobile', on: boolean) => void; onClose: () => void }> = ({ page, idx, L, lang, onChange, onVis }) => {
  const block = page.sections[idx];
  const v = block.visibility || {};
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold inline-flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)' }}><Pencil size={13} />{BLOCK_LABEL[block.type]}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{L('قسم', 'Section')} #{idx + 1}</span>
      </div>
      <div className="pt-1"><BlockEditor block={block} onChange={onChange} L={L} lang={lang} /></div>
      <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
        <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الظهور حسب الجهاز', 'Device visibility')}</span>
        <div className="flex gap-1.5">
          {(['desktop', 'tablet', 'mobile'] as const).map(k => { const on = (v as any)[k] !== false; return <button key={k} id={`vis_${idx}_${k}`} onClick={() => onVis(k, !on)} className="flex-1 text-[11px] py-1.5 rounded-md cursor-pointer" style={{ background: on ? 'rgba(74,222,128,0.14)' : 'var(--color-surface-container-high)', color: on ? '#4ade80' : 'var(--color-on-surface-variant)' }}>{k}</button>; })}
        </div>
        <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('التحكم بالجدولة والاستهداف يُدار من إعدادات الحملات.', 'Scheduling & audience targeting are managed from campaign settings.')}</p>
      </div>
      <StyleControls block={block} L={L} onChange={onChange} />
    </div>
  );
};

// ── Studio Pro: per-section visual controls (spacing / radius / shadow / align /
//    background / max-width / reveal animation / lock). Writes block.style. ──
const StyleControls: React.FC<{ block: WebsiteBlock; L: (a: string, e: string) => string; onChange: (b: WebsiteBlock) => void }> = ({ block, L, onChange }) => {
  const st = block.style || {};
  const setStyle = (patch: Partial<NonNullable<WebsiteBlock['style']>>) => onChange({ ...block, style: { ...st, ...patch } });
  const num = (label: string, key: keyof NonNullable<WebsiteBlock['style']>) => (
    <label className="block">
      <span className="text-[10px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <input type="number" value={(st[key] as number | undefined) ?? ''} placeholder="—" id={`style_${String(key)}`}
        onChange={e => setStyle({ [key]: e.target.value === '' ? undefined : Number(e.target.value) } as any)}
        style={{ ...inputStyle, marginTop: 2, padding: '5px 7px', fontSize: 11 }} />
    </label>
  );
  const seg = <T extends string>(label: string, key: keyof NonNullable<WebsiteBlock['style']>, opts: { v: T; t: string }[]) => (
    <div>
      <span className="text-[10px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <div className="flex gap-1 mt-1">
        {opts.map(o => { const on = (st[key] ?? opts[0].v) === o.v; return (
          <button key={o.v} id={`style_${String(key)}_${o.v}`} onClick={() => setStyle({ [key]: o.v } as any)} className="flex-1 text-[10px] py-1 rounded-md cursor-pointer"
            style={{ background: on ? 'rgba(163,249,91,0.16)' : 'var(--color-surface-container-high)', color: on ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)', fontWeight: on ? 800 : 600 }}>{o.t}</button>
        ); })}
      </div>
    </div>
  );
  return (
    <div className="pt-2 space-y-2.5" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold inline-flex items-center gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}><Sliders size={12} />{L('التنسيق', 'Style')}</span>
        <button id="style_lock" onClick={() => onChange({ ...block, locked: !block.locked })} title={L('قفل القسم', 'Lock section')}
          className="text-[10px] px-2 py-1 rounded-md cursor-pointer inline-flex items-center gap-1"
          style={{ background: block.locked ? 'rgba(163,249,91,0.16)' : 'var(--color-surface-container-high)', color: block.locked ? 'var(--color-primary-fixed)' : 'var(--color-on-surface-variant)', fontWeight: 700 }}>
          {block.locked ? <Lock size={11} /> : <LockOpen size={11} />}{block.locked ? L('مقفل', 'Locked') : L('مفتوح', 'Unlocked')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {num(L('حشو علوي', 'Pad top'), 'padTop')}
        {num(L('حشو سفلي', 'Pad bottom'), 'padBottom')}
        {num(L('هامش علوي', 'Margin top'), 'marginTop')}
        {num(L('هامش سفلي', 'Margin bottom'), 'marginBottom')}
        {num(L('استدارة', 'Radius'), 'radius')}
        {num(L('أقصى عرض', 'Max width'), 'maxWidth')}
      </div>
      {seg(L('الظل', 'Shadow'), 'shadow', [{ v: 'none', t: L('بلا', 'None') }, { v: 'sm', t: 'S' }, { v: 'md', t: 'M' }, { v: 'lg', t: 'L' }])}
      {seg(L('المحاذاة', 'Align'), 'align', [{ v: 'left', t: L('يسار', 'L') }, { v: 'center', t: L('وسط', 'C') }, { v: 'right', t: L('يمين', 'R') }])}
      {seg(L('الحركة', 'Animation'), 'animation', [{ v: 'none', t: L('بلا', 'None') }, { v: 'fade', t: L('تلاشي', 'Fade') }, { v: 'rise', t: L('صعود', 'Rise') }, { v: 'zoom', t: L('تكبير', 'Zoom') }])}
      <label className="block">
        <span className="text-[10px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لون الخلفية', 'Background')}</span>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(st.bg || '') ? st.bg! : '#0a0f0c'} onChange={e => setStyle({ bg: e.target.value })} style={{ width: 36, height: 30, border: '1px solid var(--color-outline-variant)', borderRadius: 8, background: 'transparent', cursor: 'pointer' }} />
          <input value={st.bg || ''} placeholder={L('افتراضي', 'default')} onChange={e => setStyle({ bg: e.target.value || undefined })} style={{ ...inputStyle, padding: '5px 7px', fontSize: 11 }} id="style_bg" />
          {st.bg && <button onClick={() => setStyle({ bg: undefined })} className="text-[10px] px-1.5 py-1 rounded cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}>✕</button>}
        </div>
      </label>
      {(block.style && Object.keys(block.style).length > 0) && (
        <button id="style_reset" onClick={() => onChange({ ...block, style: undefined })} className="w-full text-[10px] py-1.5 rounded-md cursor-pointer" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', fontWeight: 700 }}>{L('إعادة ضبط التنسيق', 'Reset style')}</button>
      )}
    </div>
  );
};

// ── AI Website Assistant panel — one-click generators & transforms, all writing to
//    the same CMS content model (Studio-editable results). Smart-template engine. ──
const ASSIST_ACTIONS: { a: string; icon: any; ar: string; en: string; descAr: string; descEn: string }[] = [
  { a: 'hero', icon: Wand2, ar: 'توليد هيرو', en: 'Generate Hero', descAr: 'قسم افتتاحي قوي بالبحث والدعوة للإجراء', descEn: 'Strong opening section with search & CTA' },
  { a: 'rewrite', icon: Pencil, ar: 'إعادة صياغة', en: 'Rewrite Content', descAr: 'شدّ النص وأزل الحشو في القسم المحدد', descEn: 'Tighten copy & remove filler in the selected section' },
  { a: 'faq', icon: FileText, ar: 'توليد الأسئلة', en: 'Generate FAQ', descAr: 'أسئلة شائعة جاهزة عن التوصيل والدفع', descEn: 'Ready FAQ about delivery & payment' },
  { a: 'landing', icon: Sparkles, ar: 'صفحة هبوط', en: 'Generate Landing Page', descAr: 'صفحة كاملة: هيرو، مزايا، عروض، آراء، دعوة', descEn: 'Full page: hero, features, offers, testimonials, CTA' },
  { a: 'cta', icon: MousePointerClick, ar: 'توليد دعوة لإجراء', en: 'Generate CTA', descAr: 'قسم ختامي يقود إلى التطبيق', descEn: 'Closing section that drives into the app' },
  { a: 'seo', icon: SearchIcon, ar: 'تحسين SEO', en: 'Improve SEO', descAr: 'عنوان ووصف محسّنان لمحركات البحث', descEn: 'Optimised meta title & description' },
  { a: 'readability', icon: FileText, ar: 'تحسين القراءة', en: 'Improve Readability', descAr: 'تقسيم الجمل الطويلة لتصبح أوضح', descEn: 'Split long sentences for clarity' },
  { a: 'marketing', icon: Wand2, ar: 'أقسام تسويقية', en: 'Generate Marketing', descAr: 'عروض + خطوات كيف تعمل', descEn: 'Offers + how-it-works steps' },
  { a: 'translate', icon: Languages, ar: 'فحص الترجمة', en: 'Translate / Audit', descAr: 'تدقيق تغطية العربية لهذه الصفحة', descEn: 'Audit Arabic coverage for this page' },
  { a: 'conversion', icon: Sparkles, ar: 'رفع التحويل', en: 'Optimize Conversion', descAr: 'دعوة بارزة + قائمة انتظار', descEn: 'Prominent CTA + waitlist capture' },
];
const AIAssistant: React.FC<{ L: (a: string, e: string) => string; onAssist: (a: string) => void }> = ({ L, onAssist }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: 'var(--color-on-surface)' }}><Sparkles size={14} style={{ color: 'var(--color-primary-fixed)' }} />{L('مساعد الموقع الذكي', 'AI Website Assistant')}</span>
    </div>
    <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('توليد وتحسين المحتوى مباشرة داخل نظام إدارة الموقع. كل نتيجة قابلة للتحرير.', 'Generate & refine content directly in the CMS. Every result is fully editable.')}</p>
    <div className="space-y-1.5">
      {ASSIST_ACTIONS.map(x => (
        <button key={x.a} id={`assist_${x.a}`} onClick={() => onAssist(x.a)} className="w-full flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer text-start"
          style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary-fixed)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}>
          <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, display: 'grid', placeItems: 'center', color: 'var(--color-primary-fixed)', background: 'color-mix(in srgb, var(--color-primary-fixed) 14%, transparent)' }}><x.icon size={15} /></span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold" style={{ color: 'var(--color-on-surface)' }}>{L(x.ar, x.en)}</span>
            <span className="block text-[10.5px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{L(x.descAr, x.descEn)}</span>
          </span>
        </button>
      ))}
    </div>
    <p className="text-[10px] pt-1" style={{ color: 'var(--color-on-surface-variant)', borderTop: '1px solid var(--color-outline-variant)' }}>{L('يعمل بمحرك قوالب ذكية وتحويلات نصية حتمية — بدون خدمة خارجية.', 'Powered by a smart-template + deterministic-transform engine — no external service.')}</p>
  </div>
);

const PageProps: React.FC<{ page: WebsitePage; L: (a: string, e: string) => string; onChange: (p: WebsitePage) => void; onRemove: () => void }> = ({ page, L, onChange, onRemove }) => {
  const up = (p: Partial<WebsitePage>) => onChange({ ...page, ...p });
  return (
    <div className="space-y-3">
      <SectionHeader title={L('إعدادات الصفحة', 'Page settings')} />
      <Field label={L('العنوان', 'Title')} value={page.title} onChange={v => up({ title: v })} id="ws_page_title" />
      <Field label={L('المسار', 'Path')} value={page.path} onChange={v => up({ path: v })} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={page.nav} onChange={e => up({ nav: e.target.checked })} /><span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('في شريط التنقل', 'Show in navigation')}</span></label>
      <Field label={L('عنوان SEO', 'SEO title')} value={page.seo.title || ''} onChange={v => up({ seo: { ...page.seo, title: v } })} />
      <Field label={L('وصف SEO', 'SEO description')} value={page.seo.description || ''} onChange={v => up({ seo: { ...page.seo, description: v } })} textarea />
      <Btn onClick={onRemove} danger id="ws_page_remove"><Trash2 size={14} />{L('حذف الصفحة', 'Delete page')}</Btn>
    </div>
  );
};

// ── Theme Studio (colors + radius; saved to the tenant brand → live everywhere) ──
const ThemeStudio: React.FC<{ brand: Record<string, any> | null; L: (a: string, e: string) => string; onSave: (p: Record<string, any>) => void }> = ({ brand, L, onSave }) => {
  const primary = brand?.primary_color || '#A3F95B';
  const accent = brand?.accent_color || brand?.primary_color || '#6EE7FF';
  const cardR = brand?.card_radius != null ? Number(brand.card_radius) : 20;
  const btnR = brand?.button_radius != null ? Number(brand.button_radius) : 14;
  const swatch = (label: string, field: string, val: string) => (
    <label className="block">
      <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <div className="flex items-center gap-2 mt-1">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(val) ? val : '#000000'} onChange={e => onSave({ [field]: e.target.value })} style={{ width: 40, height: 34, border: '1px solid var(--color-outline-variant)', borderRadius: 8, background: 'transparent', cursor: 'pointer' }} />
        <input value={val} onChange={e => onSave({ [field]: e.target.value })} style={{ ...inputStyle }} id={`theme_${field}`} />
      </div>
    </label>
  );
  return (
    <div className="space-y-3">
      <SectionHeader title={L('استوديو الثيم', 'Theme Studio')} />
      {swatch(L('اللون الأساسي', 'Primary color'), 'primary_color', primary)}
      {swatch(L('لون التمييز', 'Accent color'), 'accent_color', accent)}
      <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('استدارة البطاقات', 'Card radius')} · {cardR}px</span>
        <input type="range" min={0} max={32} value={cardR} onChange={e => onSave({ card_radius: Number(e.target.value) })} style={{ width: '100%', marginTop: 8 }} id="theme_card_radius" /></label>
      <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('استدارة الأزرار', 'Button radius')} · {btnR}px</span>
        <input type="range" min={0} max={28} value={btnR} onChange={e => onSave({ button_radius: Number(e.target.value) })} style={{ width: '100%', marginTop: 8 }} id="theme_button_radius" /></label>
      <div className="flex gap-2 flex-wrap pt-1">
        {['#A3F95B', '#6EE7FF', '#F97316', '#F43F5E', '#8B5CF6', '#22D3EE'].map(c => <button key={c} onClick={() => onSave({ primary_color: c })} title={c} style={{ width: 26, height: 26, borderRadius: 8, background: c, border: '1px solid var(--color-outline-variant)', cursor: 'pointer' }} />)}
      </div>
      <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('تُحفظ ألوان العلامة على المستأجر وتظهر فوراً في المعاينة وعلى الموقع الحيّ.', 'Brand tokens save to the tenant and apply instantly here and on the live site.')}</p>
    </div>
  );
};

// ── Brand Studio (reuses BRAND_SLOTS + the media library) ──
const BrandStudio: React.FC<{ brand: Record<string, any> | null; L: (a: string, e: string) => string; lang: 'ar' | 'en'; onSave: (p: Record<string, any>) => void }> = ({ brand, L, lang, onSave }) => (
  <div className="space-y-3">
    <SectionHeader title={L('استوديو الهوية', 'Brand Studio')} />
    <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('كل الأصول تُرفع عبر مكتبة الوسائط الواحدة.', 'Every asset uploads through the single media library.')}</p>
    {BRAND_SLOTS.map(s => (
      <MediaField key={s.key} label={L(s.ar, s.en)} value={brand?.[s.field] || ''} kind={s.category === 'video' ? 'video' : 'image'} onChange={u => onSave({ [s.field]: u })} lang={lang} />
    ))}
  </div>
);

// ── Media Library (center grid, reuses assetsService) ──
const MediaLibrary: React.FC<{ lang: 'ar' | 'en'; L: (a: string, e: string) => string }> = ({ lang, L }) => {
  const [items, setItems] = useState<AssetItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reload = () => assetsService.list().then(setItems);
  useEffect(() => { reload(); }, []);
  const onFile = async (f?: File) => { if (!f) return; setBusy(true); try { await assetsService.upload(f, f.type.startsWith('video') ? 'video' : 'image'); reload(); toast.success(L('تم الرفع', 'Uploaded')); } catch { toast.error(L('تعذّر الرفع', 'Upload failed')); } finally { setBusy(false); } };
  return (
    <div style={{ width: '100%', maxWidth: 1000 }} id="studio_media">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-extrabold" style={{ color: 'var(--color-on-surface)' }}>{L('مكتبة الوسائط', 'Media Library')} · {items.length}</span>
        <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0])} />
        <Btn onClick={() => fileRef.current?.click()} primary id="studio_media_upload"><UploadCloud size={14} />{busy ? L('جارٍ الرفع…', 'Uploading…') : L('رفع وسائط', 'Upload media')}</Btn>
      </div>
      {items.length === 0 ? <EmptyStateBox Icon={ImageIcon} title={L('لا وسائط بعد', 'No media yet')} description={L('ارفع صوراً وفيديوهات لاستخدامها في الأقسام.', 'Upload images and videos to use across sections.')} />
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 12 }}>
          {items.map(a => (
            <div key={a.id} style={{ ...card, overflow: 'hidden' }}>
              {a.category === 'video' ? <div style={{ aspectRatio: '4/3', background: '#000', display: 'grid', placeItems: 'center', color: '#fff' }}>▶</div> : <img src={a.url} alt={a.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />}
              <div className="px-2 py-1.5"><span className="block text-[11px] truncate" style={{ color: 'var(--color-on-surface)' }}>{a.name}</span><span className="block text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{a.category} · {(a.size / 1024).toFixed(0)}KB</span></div>
            </div>
          ))}
        </div>}
    </div>
  );
};
const MediaRightInfo: React.FC<{ L: (a: string, e: string) => string }> = ({ L }) => (
  <div className="space-y-2">
    <SectionHeader title={L('الوسائط', 'Media')} />
    <p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('مكتبة موحّدة للصور والفيديو والشعارات. تدعم الرفع، روابط CDN، والصور المصغّرة، والتحميل الكسول، والنص البديل عند الاستخدام في الأقسام.', 'One library for images, video and logos — upload, CDN URLs, thumbnails, lazy-loading and alt text when used in sections.')}</p>
    <ul className="text-[12px] space-y-1" style={{ color: 'var(--color-on-surface)' }}>
      {['Images', 'Video', 'SVG / Icons', 'Logos', 'Hero backgrounds'].map(x => <li key={x} className="flex items-center gap-2"><Check size={13} style={{ color: '#4ade80' }} />{x}</li>)}
    </ul>
  </div>
);

// ── Compact right-panel editors for nav / footer / settings / domain / history ──
const NavEditor: React.FC<{ site: WebsiteSite; L: (a: string, e: string) => string; patch: (p: Partial<WebsiteSite>) => void }> = ({ site, L, patch }) => (
  <div className="space-y-2">
    <SectionHeader title={L('روابط التنقل', 'Navigation')} action={<button id="ws_nav_add" onClick={() => patch({ navigation: [...site.navigation, { label: 'New', path: '/new' }] })} style={{ ...iconBtn, width: 28, height: 28 }}><Plus size={14} /></button>} />
    {site.navigation.map((n, i) => (
      <div key={i} className="flex items-center gap-1.5">
        <input value={n.label} onChange={e => patch({ navigation: site.navigation.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} style={{ ...inputStyle, padding: '7px 9px' }} />
        <input value={n.path} onChange={e => patch({ navigation: site.navigation.map((x, j) => j === i ? { ...x, path: e.target.value } : x) })} style={{ ...inputStyle, padding: '7px 9px' }} />
        <button onClick={() => i > 0 && patch({ navigation: swap(site.navigation, i, i - 1) })} style={{ ...iconBtn, width: 28, height: 28 }}><ChevronUp size={13} /></button>
        <button onClick={() => patch({ navigation: site.navigation.filter((_, j) => j !== i) })} style={{ ...iconBtn, width: 28, height: 28, color: '#f87171' }}><Trash2 size={13} /></button>
      </div>
    ))}
  </div>
);
const FooterEditor: React.FC<{ site: WebsiteSite; L: (a: string, e: string) => string; patch: (p: Partial<WebsiteSite>) => void }> = ({ site, L, patch }) => (
  <div className="space-y-3">
    <SectionHeader title={L('التذييل', 'Footer')} />
    <Field label={L('حقوق النشر', 'Copyright')} value={site.footer.copyright} onChange={v => patch({ footer: { ...site.footer, copyright: v } })} />
    {site.footer.columns.map((col, ci) => (
      <div key={ci} style={{ ...card, padding: 10 }} className="space-y-1.5">
        <div className="flex gap-1.5"><input value={col.title} onChange={e => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, title: e.target.value } : c) } })} style={{ ...inputStyle, padding: '7px 9px' }} /><button onClick={() => patch({ footer: { ...site.footer, columns: site.footer.columns.filter((_, j) => j !== ci) } })} style={{ ...iconBtn, width: 28, height: 28, color: '#f87171' }}><Trash2 size={13} /></button></div>
        {col.links.map((l, li) => (
          <div key={li} className="flex gap-1.5 ps-2"><input value={l.label} onChange={e => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, links: c.links.map((x, k) => k === li ? { ...x, label: e.target.value } : x) } : c) } })} style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }} /><input value={l.path} onChange={e => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, links: c.links.map((x, k) => k === li ? { ...x, path: e.target.value } : x) } : c) } })} style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }} /></div>
        ))}
        <Btn onClick={() => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, links: [...c.links, { label: 'Link', path: '/' }] } : c) } })}><Plus size={12} />{L('رابط', 'Link')}</Btn>
      </div>
    ))}
    <Btn onClick={() => patch({ footer: { ...site.footer, columns: [...site.footer.columns, { title: 'Column', links: [] }] } })} id="ws_footer_col_add"><Plus size={14} />{L('عمود', 'Column')}</Btn>
  </div>
);
const SettingsEditor: React.FC<{ site: WebsiteSite; L: (a: string, e: string) => string; patch: (p: Partial<WebsiteSite>) => void }> = ({ site, L, patch }) => (
  <div className="space-y-3">
    <SectionHeader title={L('الإعدادات', 'Settings')} />
    <Field label={L('اسم الموقع', 'Site name')} value={site.siteName} onChange={v => patch({ siteName: v })} id="ws_site_name" />
    <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الحالة', 'Status')}</span>
      <select value={site.status} onChange={e => patch({ status: e.target.value as WebsiteSite['status'] })} style={{ ...inputStyle, marginTop: 4 }} id="ws_status"><option value="published">{L('منشور', 'Published')}</option><option value="draft">{L('مسودة', 'Draft')}</option><option value="suspended">{L('موقوف', 'Suspended')}</option></select></label>
    <Toggle label={L('وضع الصيانة', 'Maintenance mode')} checked={site.maintenance} onChange={v => patch({ maintenance: v })} id="ws_maintenance" />
  </div>
);
const DomainEditor: React.FC<{ site: WebsiteSite; L: (a: string, e: string) => string; patch: (p: Partial<WebsiteSite>) => void }> = ({ site, L, patch }) => (
  <div className="space-y-3">
    <SectionHeader title={L('النطاق والحالة', 'Domain & SSL')} />
    <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('النطاق الفرعي', 'Managed subdomain')}</span><input value={`${site.slug}.haatnow.app`} readOnly style={{ ...inputStyle, marginTop: 4, opacity: 0.7 }} /></label>
    <Field label={L('نطاق مخصّص', 'Custom domain')} value={site.customDomain || ''} onChange={v => patch({ customDomain: v || undefined })} placeholder="www.example.com" id="ws_custom_domain" />
    <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('حالة SSL', 'SSL status')}</span>
      <select value={site.sslStatus || 'none'} onChange={e => patch({ sslStatus: e.target.value as WebsiteSite['sslStatus'] })} style={{ ...inputStyle, marginTop: 4 }} id="ws_ssl_status"><option value="none">{L('لا يوجد', 'None')}</option><option value="provisioning">{L('قيد الإصدار', 'Provisioning')}</option><option value="active">{L('نشط', 'Active')}</option></select></label>
  </div>
);
const HistoryPanel: React.FC<{ versions: { version: number; at: string }[]; L: (a: string, e: string) => string; onRollback: (v: number) => void }> = ({ versions, L, onRollback }) => (
  <div className="space-y-2">
    <SectionHeader title={L('سجل الإصدارات', 'Version history')} />
    {versions.length === 0 ? <EmptyStateBox Icon={HistoryIcon} title={L('لا سجل بعد', 'No history yet')} description={L('كل نشر ينشئ نسخة قابلة للاستعادة.', 'Each publish creates a restorable version.')} />
      : versions.map(v => (
        <div key={v.version} className="flex items-center justify-between" style={{ ...card, padding: '9px 11px' }}>
          <span className="text-[12px]" style={{ color: 'var(--color-on-surface)' }}>v{v.version} · <span style={{ color: 'var(--color-on-surface-variant)' }}>{new Date(v.at).toLocaleString()}</span></span>
          <Btn onClick={() => onRollback(v.version)} id={`ws_rollback_${v.version}`}><RotateCcw size={12} />{L('استعادة', 'Restore')}</Btn>
        </div>
      ))}
  </div>
);

const PostEditor: React.FC<{ post: BlogPost; onChange: (p: BlogPost) => void; onRemove: () => void; L: (a: string, e: string) => string }> = ({ post, onChange, onRemove, L }) => {
  const up = (patch: Partial<BlogPost>) => onChange({ ...post, ...patch });
  const body0 = post.body.find(b => b.type === 'richtext') as Extract<WebsiteBlock, { type: 'richtext' }> | undefined;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input value={post.title} onChange={e => up({ title: e.target.value })} style={inputStyle} id="ws_post_title" />
        <Btn onClick={onRemove} danger><Trash2 size={14} />{L('حذف', 'Delete')}</Btn>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Slug" value={post.slug} onChange={v => up({ slug: v })} />
        <Field label={L('الكاتب', 'Author')} value={post.author} onChange={v => up({ author: v })} />
      </div>
      <Field label={L('المقتطف', 'Excerpt')} value={post.excerpt} onChange={v => up({ excerpt: v })} textarea />
      <Field label={L('المحتوى', 'Body')} value={body0?.body || ''} onChange={v => up({ body: [{ type: 'richtext', body: v }] })} textarea />
    </div>
  );
};

function newBlock(t: WebsiteBlockType): WebsiteBlock {
  switch (t) {
    case 'hero': return { type: 'hero', title: 'Headline', subtitle: 'A short supporting subtitle.', layout: 'center', overlay: 0.5, ctas: [{ label: 'Get started', href: '/contact', style: 'primary' }] };
    case 'features': return { type: 'features', heading: 'Features', items: [{ title: 'Feature', body: 'Description' }] };
    case 'cards': return { type: 'cards', heading: 'Highlights', items: [{ title: 'Card', body: 'Description' }] };
    case 'stats': return { type: 'stats', heading: 'By the numbers', items: [{ value: '10k+', label: 'Customers' }] };
    case 'testimonials': return { type: 'testimonials', heading: 'What people say', items: [{ quote: 'Amazing service.', author: 'Jane Doe', role: 'Customer' }] };
    case 'partners': return { type: 'partners', heading: 'Trusted by', logos: [] };
    case 'gallery': return { type: 'gallery', heading: 'Gallery', images: [] };
    case 'app_download': return { type: 'app_download', heading: 'Get the app', subtitle: 'Order in one tap.', iosUrl: '', androidUrl: '', huaweiUrl: '', features: ['Faster one-tap ordering', 'Live map tracking', 'Wallet & rewards', 'Push notifications'], screenshots: [] };
    case 'faq': return { type: 'faq', heading: 'FAQ', items: [{ q: 'Question?', a: 'Answer.' }] };
    case 'contact': return { type: 'contact', heading: 'Contact', email: '' };
    case 'cta': return { type: 'cta', title: 'Call to action', button: { label: 'Get started', href: '/contact' } };
    case 'categories': return { type: 'categories', heading: 'Categories', subtitle: '', items: [{ label: 'Restaurants', emoji: '🍔', href: '/restaurants' }, { label: 'Grocery', emoji: '🛒', href: '/grocery' }] };
    case 'merchants': return { type: 'merchants', heading: 'Featured', subtitle: '', layout: 'rail', items: [{ name: 'Merchant', emoji: '🍴', cuisine: 'Cuisine', rating: 4.7, eta: '25–35 min', fee: 'Free delivery', href: '/menu' }] };
    case 'deals': return { type: 'deals', heading: 'Deals', subtitle: '', items: [{ title: 'Offer', merchant: 'Merchant', emoji: '🎁', discount: '-20%', href: '/offers' }] };
    case 'steps': return { type: 'steps', heading: 'How it works', subtitle: '', items: [{ title: 'Step', body: 'Description', icon: '①' }] };
    case 'waitlist': return { type: 'waitlist', badge: 'Launching soon', heading: 'Be the first to order', subtitle: 'Join the waitlist and we’ll notify you at launch.', placeholder: 'you@email.com', cta: 'Notify me', note: 'No spam — one email when we go live.' };
    default: return { type: 'richtext', heading: '', body: '' };
  }
}

const BlockEditor: React.FC<{ block: WebsiteBlock; onChange: (b: WebsiteBlock) => void; L: (a: string, e: string) => string; lang: 'ar' | 'en' }> = ({ block, onChange, L, lang }) => {
  switch (block.type) {
    case 'hero': {
      const ctas: WebsiteCta[] = block.ctas || (block.cta ? [{ label: block.cta.label, href: block.cta.href, style: 'primary' }] : []);
      const setCtas = (c: WebsiteCta[]) => onChange({ ...block, ctas: c, cta: undefined });
      return (<div className="space-y-2">
        <Field label={L('العنوان', 'Heading')} value={block.title} onChange={v => onChange({ ...block, title: v })} />
        <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v })} />
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('التخطيط', 'Layout')}</span>
            <select value={block.layout || 'center'} onChange={e => onChange({ ...block, layout: e.target.value as any })} style={{ ...inputStyle, marginTop: 4 }}><option value="center">{L('وسط', 'Centered')}</option><option value="left">{L('يسار', 'Left')}</option></select></label>
          <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('التعتيم', 'Overlay')} {Math.round((block.overlay ?? 0.5) * 100)}%</span>
            <input type="range" min={0} max={0.9} step={0.05} value={block.overlay ?? 0.5} onChange={e => onChange({ ...block, overlay: Number(e.target.value) })} style={{ width: '100%', marginTop: 8 }} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MediaField label={L('صورة الخلفية', 'Background image')} value={block.bgImage || ''} kind="image" onChange={u => onChange({ ...block, bgImage: u })} lang={lang} />
          <MediaField label={L('فيديو الخلفية', 'Background video')} value={block.bgVideo || ''} kind="video" onChange={u => onChange({ ...block, bgVideo: u })} lang={lang} />
        </div>
        <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('أزرار الحث', 'CTA buttons')}</span>
        {ctas.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
            <Field label={L('نص', 'Label')} value={c.label} onChange={v => setCtas(ctas.map((x, j) => j === i ? { ...x, label: v } : x))} />
            <Field label={L('رابط', 'Href')} value={c.href} onChange={v => setCtas(ctas.map((x, j) => j === i ? { ...x, href: v } : x))} />
            <button onClick={() => setCtas(ctas.map((x, j) => j === i ? { ...x, style: x.style === 'secondary' ? 'primary' : 'secondary' } : x))} className="text-[11px] px-2 py-2 rounded-md cursor-pointer" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', marginBottom: 2 }}>{c.style || 'primary'}</button>
            <ItemDel onClick={() => setCtas(ctas.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Btn onClick={() => setCtas([...ctas, { label: 'Button', href: '/', style: 'primary' }])}><Plus size={13} />{L('زر', 'Button')}</Btn>
      </div>);
    }
    case 'features': case 'cards': {
      const items = block.items as { title: string; body: string; image?: string; href?: string }[];
      const setItems = (it: any[]) => onChange({ ...block, items: it } as any);
      return (<div className="space-y-2">
        <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v } as any)} />
        {items.map((it, i) => (
          <div key={i} style={{ ...card, padding: 10 }} className="space-y-1.5">
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end"><Field label={L('العنوان', 'Title')} value={it.title} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, title: v } : x))} /><ItemDel onClick={() => setItems(items.filter((_, j) => j !== i))} /></div>
            <Field label={L('الوصف', 'Body')} value={it.body} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, body: v } : x))} />
            {block.type === 'cards' && <div className="grid grid-cols-2 gap-2"><MediaField label={L('صورة', 'Image')} value={it.image || ''} onChange={u => setItems(items.map((x, j) => j === i ? { ...x, image: u } : x))} lang={lang} /><Field label={L('رابط', 'Link')} value={it.href || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, href: v } : x))} /></div>}
          </div>
        ))}
        <Btn onClick={() => setItems([...items, { title: 'Item', body: 'Description' }])}><Plus size={13} />{L('عنصر', 'Item')}</Btn>
      </div>);
    }
    case 'stats': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Field label={L('القيمة', 'Value')} value={it.value} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, value: v } : x) })} />
          <Field label={L('التسمية', 'Label')} value={it.label} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, label: v } : x) })} />
          <ItemDel onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <Btn onClick={() => onChange({ ...block, items: [...block.items, { value: '100+', label: 'Metric' }] })}><Plus size={13} />{L('إحصائية', 'Stat')}</Btn>
    </div>);
    case 'testimonials': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <div key={i} style={{ ...card, padding: 10 }} className="space-y-1.5">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end"><Field label={L('اقتباس', 'Quote')} value={it.quote} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, quote: v } : x) })} textarea /><ItemDel onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })} /></div>
          <div className="grid grid-cols-2 gap-2"><Field label={L('الاسم', 'Author')} value={it.author} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, author: v } : x) })} /><Field label={L('الصفة', 'Role')} value={it.role || ''} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, role: v } : x) })} /></div>
          <MediaField label={L('الصورة الرمزية', 'Avatar')} value={it.avatar || ''} onChange={u => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, avatar: u } : x) })} lang={lang} />
        </div>
      ))}
      <Btn onClick={() => onChange({ ...block, items: [...block.items, { quote: 'Great!', author: 'Name', role: '' }] })}><Plus size={13} />{L('شهادة', 'Testimonial')}</Btn>
    </div>);
    case 'partners': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <MediaListField label={L('الشعارات', 'Logos')} values={block.logos} onChange={v => onChange({ ...block, logos: v })} lang={lang} />
    </div>);
    case 'gallery': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <MediaListField label={L('الصور', 'Images')} values={block.images} onChange={v => onChange({ ...block, images: v })} lang={lang} />
    </div>);
    case 'app_download': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading} onChange={v => onChange({ ...block, heading: v })} />
      <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v })} />
      <div className="grid grid-cols-2 gap-2"><Field label="iOS URL" value={block.iosUrl || ''} onChange={v => onChange({ ...block, iosUrl: v })} /><Field label="Android URL" value={block.androidUrl || ''} onChange={v => onChange({ ...block, androidUrl: v })} /></div>
      <Field label={L('رابط AppGallery (هواوي)', 'AppGallery URL (Huawei)')} value={block.huaweiUrl || ''} onChange={v => onChange({ ...block, huaweiUrl: v })} />
      <p className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('اترك الرابط فارغاً لعرض حالة «قريباً».', 'Leave a store URL empty to show a “Coming soon” state.')}</p>
      <div className="grid grid-cols-2 gap-2"><Field label={L('رقم SMS (اختياري)', 'SMS number (optional)')} value={block.sms || ''} onChange={v => onChange({ ...block, sms: v })} /><Field label={L('بريد (اختياري)', 'Email (optional)')} value={block.email || ''} onChange={v => onChange({ ...block, email: v })} /></div>
      <StringListField label={L('مزايا التطبيق', 'App feature highlights')} values={block.features || []} onChange={v => onChange({ ...block, features: v })} L={L} />
      <MediaListField label={L('لقطات شاشة التطبيق', 'App screenshots')} values={block.screenshots || []} onChange={v => onChange({ ...block, screenshots: v })} lang={lang} />
      <MediaField label={L('صورة', 'Image')} value={block.image || ''} onChange={u => onChange({ ...block, image: u })} lang={lang} />
    </div>);
    case 'faq': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Field label={L('سؤال', 'Question')} value={it.q} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, q: v } : x) })} />
          <Field label={L('إجابة', 'Answer')} value={it.a} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, a: v } : x) })} />
          <ItemDel onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <Btn onClick={() => onChange({ ...block, items: [...block.items, { q: 'Question?', a: 'Answer.' }] })}><Plus size={13} />{L('سؤال', 'Q&A')}</Btn>
    </div>);
    case 'contact': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <Field label="Email" value={block.email || ''} onChange={v => onChange({ ...block, email: v })} />
      <Field label={L('الهاتف', 'Phone')} value={block.phone || ''} onChange={v => onChange({ ...block, phone: v })} />
      <Field label={L('العنوان البريدي', 'Address')} value={block.address || ''} onChange={v => onChange({ ...block, address: v })} />
    </div>);
    case 'cta': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Title')} value={block.title} onChange={v => onChange({ ...block, title: v })} />
      <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v })} />
      <div className="grid grid-cols-2 gap-2"><Field label={L('زر: نص', 'Button label')} value={block.button.label} onChange={v => onChange({ ...block, button: { ...block.button, label: v } })} /><Field label={L('زر: رابط', 'Button href')} value={block.button.href} onChange={v => onChange({ ...block, button: { ...block.button, href: v } })} /></div>
    </div>);
    case 'richtext': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <Field label={L('النص', 'Body')} value={block.body} onChange={v => onChange({ ...block, body: v })} textarea />
    </div>);
    case 'categories': {
      const items = block.items; const setItems = (it: any[]) => onChange({ ...block, items: it } as any);
      return (<div className="space-y-2">
        <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v } as any)} />
        <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v } as any)} />
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
            <Field label={L('رمز', 'Emoji')} value={it.emoji || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, emoji: v } : x))} />
            <Field label={L('التسمية', 'Label')} value={it.label} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, label: v } : x))} />
            <Field label={L('رابط', 'Href')} value={it.href} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, href: v } : x))} />
            <ItemDel onClick={() => setItems(items.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Btn onClick={() => setItems([...items, { label: 'Category', emoji: '🍽️', href: '/' }])}><Plus size={13} />{L('فئة', 'Category')}</Btn>
      </div>);
    }
    case 'steps': {
      const items = block.items; const setItems = (it: any[]) => onChange({ ...block, items: it } as any);
      return (<div className="space-y-2">
        <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v } as any)} />
        <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v } as any)} />
        {items.map((it, i) => (
          <div key={i} style={{ ...card, padding: 10 }} className="space-y-1.5">
            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-end"><Field label={L('رمز', 'Icon')} value={it.icon || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, icon: v } : x))} /><Field label={L('العنوان', 'Title')} value={it.title} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, title: v } : x))} /><ItemDel onClick={() => setItems(items.filter((_, j) => j !== i))} /></div>
            <Field label={L('الوصف', 'Body')} value={it.body} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, body: v } : x))} />
          </div>
        ))}
        <Btn onClick={() => setItems([...items, { title: 'Step', body: 'Description', icon: '①' }])}><Plus size={13} />{L('خطوة', 'Step')}</Btn>
      </div>);
    }
    case 'deals': {
      const items = block.items; const setItems = (it: any[]) => onChange({ ...block, items: it } as any);
      return (<div className="space-y-2">
        <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v } as any)} />
        <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v } as any)} />
        {items.map((it, i) => (
          <div key={i} style={{ ...card, padding: 10 }} className="space-y-1.5">
            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-end"><Field label={L('رمز', 'Emoji')} value={it.emoji || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, emoji: v } : x))} /><Field label={L('العنوان', 'Title')} value={it.title} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, title: v } : x))} /><ItemDel onClick={() => setItems(items.filter((_, j) => j !== i))} /></div>
            <div className="grid grid-cols-2 gap-2"><Field label={L('المتجر', 'Merchant')} value={it.merchant || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, merchant: v } : x))} /><Field label={L('الخصم', 'Discount')} value={it.discount || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, discount: v } : x))} /></div>
            <div className="grid grid-cols-2 gap-2"><Field label={L('الكود', 'Code')} value={it.code || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, code: v } : x))} /><Field label={L('رابط', 'Href')} value={it.href || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, href: v } : x))} /></div>
          </div>
        ))}
        <Btn onClick={() => setItems([...items, { title: 'Offer', merchant: '', emoji: '🎁', discount: '-20%', href: '/offers' }])}><Plus size={13} />{L('عرض', 'Deal')}</Btn>
      </div>);
    }
    case 'merchants': {
      const items = block.items; const setItems = (it: any[]) => onChange({ ...block, items: it } as any);
      return (<div className="space-y-2">
        <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v } as any)} />
        <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v } as any)} />
        <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('التخطيط', 'Layout')}</span>
          <select value={block.layout || 'grid'} onChange={e => onChange({ ...block, layout: e.target.value as any })} style={{ ...inputStyle, marginTop: 4 }}><option value="grid">{L('شبكة', 'Grid')}</option><option value="rail">{L('شريط', 'Rail')}</option></select></label>
        {items.map((it, i) => (
          <div key={i} style={{ ...card, padding: 10 }} className="space-y-1.5">
            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-end"><Field label={L('رمز', 'Emoji')} value={it.emoji || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, emoji: v } : x))} /><Field label={L('الاسم', 'Name')} value={it.name} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, name: v } : x))} /><ItemDel onClick={() => setItems(items.filter((_, j) => j !== i))} /></div>
            <div className="grid grid-cols-2 gap-2"><Field label={L('المطبخ', 'Cuisine')} value={it.cuisine || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, cuisine: v } : x))} /><Field label={L('التقييم', 'Rating')} value={String(it.rating ?? '')} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, rating: Number(v) || undefined } : x))} /></div>
            <div className="grid grid-cols-2 gap-2"><Field label={L('الوقت', 'ETA')} value={it.eta || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, eta: v } : x))} /><Field label={L('الرسوم', 'Fee')} value={it.fee || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, fee: v } : x))} /></div>
            <div className="grid grid-cols-2 gap-2"><Field label={L('عرض', 'Promo')} value={it.promo || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, promo: v } : x))} /><Field label={L('رابط', 'Href')} value={it.href || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, href: v } : x))} /></div>
          </div>
        ))}
        <Btn onClick={() => setItems([...items, { name: 'Merchant', emoji: '🍴', cuisine: '', rating: 4.5, eta: '25–35 min', fee: 'Free delivery', href: '/menu' }])}><Plus size={13} />{L('متجر', 'Merchant')}</Btn>
      </div>);
    }
    case 'waitlist': return (<div className="space-y-2">
      <Field label={L('شارة', 'Badge')} value={block.badge || ''} onChange={v => onChange({ ...block, badge: v })} />
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label={L('النائب', 'Placeholder')} value={block.placeholder || ''} onChange={v => onChange({ ...block, placeholder: v })} />
        <Field label={L('زر', 'Button')} value={block.cta || ''} onChange={v => onChange({ ...block, cta: v })} />
      </div>
      <Field label={L('ملاحظة', 'Note')} value={block.note || ''} onChange={v => onChange({ ...block, note: v })} />
    </div>);
    default: return null;
  }
};
