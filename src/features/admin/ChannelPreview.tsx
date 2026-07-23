// ─────────────────────────────────────────────────────────────────────────────
// Channel Preview — the Experience Studio AUTHORING canvas for the Customer, Merchant
// and Driver channels.
//
// It mounts the REAL experience surfaces (ExperienceBanner / ExperienceHint from
// components/experience) driven by the ONE Runtime (`decideFor`) and the ONE
// Personalization (`personalizeExperiences`) — the same components and decision the
// live apps render. Their copy comes from `resolveMergedContent`, the single source
// of truth the live screens ALSO read, so editing here changes the live app.
//
// No mock scaffolding, no duplicated strings, no fabricated content. On top of the
// real surfaces it layers Webflow-style visual authoring: hover + selection outlines,
// a floating toolbar, breadcrumbs, and INLINE editing of the real rendered title/body.
// The website channel keeps its existing block editor and does NOT use this file.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Home, ShoppingBag, Wallet, User, Search, Bike, Map as MapIcon, Navigation2, Package,
  LayoutDashboard, BarChart3, Store, Settings2, Pencil, EyeOff, Lock, LockOpen,
  ChevronUp, ChevronDown, ChevronRight,
  Inbox, WifiOff, Clock, Flame, PackageX, TicketPercent, UserX, XCircle, CheckCircle2, Loader2,
} from 'lucide-react';
import { ExperienceKeyframes, ExperienceBanner, ExperienceHint } from '../../components/experience/ExperienceSurfaces';
import { resolveExperienceIcon } from '../../components/experience/experienceIcons';
import { decideFor, personalizeExperiences, type Surface } from '../../services/experience-platform.service';
import { resolveMergedContent } from '../../services/experience-content.service';
import { contentTitle, contentBody, type ExperienceContentOverride } from '../../experience-content/content';
import type { ExperienceCandidate } from '../../experience-engine';
import { getChannel, getScreen, type ChannelId } from '../../experience-channels/channels';
import { StudioInteractionStyles, studioOverlayBtn } from './studioUI';

// Structural navigation chrome only (real app shell), never fabricated data.
// Exported so the Component Tree (ChannelTree) reads the SAME chrome definition — one
// source for the app shell, no duplicated nav model.
export interface ChromeItem { icon: typeof Home; ar: string; en: string; screen: string }
export const CUSTOMER_TABS: ChromeItem[] = [
  { icon: Home, ar: 'الرئيسية', en: 'Home', screen: 'home' }, { icon: Search, ar: 'البحث', en: 'Search', screen: 'search' },
  { icon: ShoppingBag, ar: 'الطلبات', en: 'Orders', screen: 'orders' }, { icon: Wallet, ar: 'المحفظة', en: 'Wallet', screen: 'wallet' },
  { icon: User, ar: 'حسابي', en: 'Profile', screen: 'profile' },
];
export const DRIVER_TABS: ChromeItem[] = [
  { icon: Home, ar: 'الرئيسية', en: 'Home', screen: 'home' }, { icon: Package, ar: 'الطلبات', en: 'Orders', screen: 'orders' },
  { icon: MapIcon, ar: 'الخريطة', en: 'Map', screen: 'map' }, { icon: Navigation2, ar: 'الملاحة', en: 'Nav', screen: 'navigation' },
  { icon: Wallet, ar: 'المحفظة', en: 'Wallet', screen: 'wallet' },
];
export const MERCHANT_NAV: ChromeItem[] = [
  { icon: LayoutDashboard, ar: 'لوحة التحكم', en: 'Dashboard', screen: 'dashboard' }, { icon: Package, ar: 'الطلبات', en: 'Orders', screen: 'orders' },
  { icon: Store, ar: 'المنتجات', en: 'Products', screen: 'products' }, { icon: BarChart3, ar: 'التحليلات', en: 'Analytics', screen: 'analytics' },
  { icon: Wallet, ar: 'المالية', en: 'Finance', screen: 'finance' }, { icon: Settings2, ar: 'الإعدادات', en: 'Settings', screen: 'settings' },
];
export function chromeFor(channel: ChannelId): ChromeItem[] {
  return channel === 'customer' ? CUSTOMER_TABS : channel === 'driver' ? DRIVER_TABS : channel === 'merchant' ? MERCHANT_NAV : [];
}

export interface ChannelAuthoring {
  selectedId: string | null;
  hidden: string[];
  locked: string[];
  order: Record<string, string[]>;
}

// UX states the phone can preview — neutral interface states only, never fabricated
// business data (no fake merchants/prices). "default" shows the real engine surfaces.
export type PreviewState =
  | 'default' | 'empty' | 'loading' | 'offline' | 'closed' | 'busy'
  | 'out_of_stock' | 'coupon' | 'no_driver' | 'cancelled' | 'delivered';

// App-shell overrides authored in the App Studio (Theme / App Bar / Bottom Nav editors).
// Applied live to the phone canvas. These are user-authored labels & tokens, not fabricated
// data; they persist client-side and drive the preview immediately.
export interface AppShellOverride {
  theme?: { primary?: string; accent?: string; radius?: number };
  brand?: { ar?: string; en?: string };
  navLabels?: Record<string, { ar?: string; en?: string }>;
}

// Minimal luminance → readable on-color for an authored primary.
function onColor(hex?: string): string | undefined {
  if (!hex) return undefined;
  const h = hex.replace('#', ''); if (h.length < 6) return undefined;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0c2000' : '#ffffff';
}

export const PREVIEW_STATES: { id: PreviewState; ar: string; en: string }[] = [
  { id: 'default', ar: 'الحالة الطبيعية', en: 'Default' },
  { id: 'empty', ar: 'فارغ', en: 'Empty' },
  { id: 'loading', ar: 'تحميل', en: 'Loading' },
  { id: 'offline', ar: 'دون اتصال', en: 'Offline' },
  { id: 'closed', ar: 'مغلق', en: 'Closed' },
  { id: 'busy', ar: 'مزدحم', en: 'Busy' },
  { id: 'out_of_stock', ar: 'نفد المخزون', en: 'Out of stock' },
  { id: 'coupon', ar: 'كوبون مُطبّق', en: 'Coupon applied' },
  { id: 'no_driver', ar: 'لا يوجد سائق', en: 'No driver' },
  { id: 'cancelled', ar: 'ملغى', en: 'Cancelled' },
  { id: 'delivered', ar: 'تم التوصيل', en: 'Delivered' },
];

export interface ChannelPreviewProps {
  channel: ChannelId;
  screenId: string;
  device: 'desktop' | 'tablet' | 'mobile';
  lang: 'ar' | 'en';
  locale: 'ar' | 'en';
  country: string;
  authoring: ChannelAuthoring;
  /** Bumped when content is authored; a prop change re-renders so surfaces re-read content. */
  contentVersion?: number;
  /** Neutral UI state to preview (empty/loading/offline…). Defaults to 'default'. */
  previewState?: PreviewState;
  /** Live app-shell overrides authored in the App Studio (theme / app bar / bottom nav). */
  shell?: AppShellOverride;
  onSelect: (id: string | null) => void;
  onInlineEdit: (id: string, patch: ExperienceContentOverride) => void;
  onAction: (id: string, action: 'hide' | 'lock' | 'up' | 'down') => void;
  onDecision?: (info: { selected: string[]; eligible: string[]; all: string[] }) => void;
  /** Tap chrome (bottom nav / side nav) to navigate to that screen — makes the shell live. */
  onNavigate?: (screenId: string) => void;
}

export const ChannelPreview: React.FC<ChannelPreviewProps> = ({ channel, screenId, device, lang, locale, country, authoring, contentVersion, previewState = 'default', shell, onSelect, onInlineEdit, onAction, onDecision, onNavigate }) => {
  void contentVersion; // referenced so a content edit re-renders the canvas (surfaces re-read content)
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const def = getChannel(channel);
  const screen = getScreen(channel, screenId) ?? def?.screens[0];
  const surface = (def?.surface ?? 'customer') as Surface;

  // THE ONE RUNTIME — same call the live app makes.
  const decision = useMemo(
    () => decideFor({ surface, locale, country, experienceId: `${channel}:${screen?.id ?? ''}` }),
    [surface, locale, country, channel, screen?.id],
  );

  // THE ONE PERSONALIZATION — the engine RANKS this screen's candidates; the Studio
  // presents them in that order. Studio-local reorder (authoring.order) overrides it.
  //
  // Deliberate difference from the live app: the runtime applies frequency caps/fatigue
  // and may show NOTHING (a banner seen minutes ago is suppressed). The Studio must
  // still show a capped experience so it can be edited — you cannot author what you
  // cannot see. So the Studio ranks with the same engine but does not let impression
  // caps hide a surface from its own editor. The live screens keep the full capping.
  const chosen = useMemo(() => {
    const ids = screen?.experiences ?? [];
    const ordered = orderIds(ids, authoring.order[screen?.id ?? ''] ?? []);
    const eligible = ordered.filter(id => decision.isOn(id) && !authoring.hidden.includes(id));
    const candidates: ExperienceCandidate[] = eligible.map((experienceId, i) => ({ experienceId, priority: eligible.length - i }));
    const limit = channel === 'customer' ? 1 : 2;
    // `displayed` = every eligible experience, ranked by the engine — the Studio shows
    // them ALL so each can be selected and authored. `runtimeSelected` = what the live
    // app would actually surface (engine ranking + frequency caps + display limit); the
    // inspector uses it to mark which experiences are "shown" vs merely "eligible".
    const rankedIds = candidates.length ? personalizeExperiences(candidates, {}).ranked.map(r => r.experienceId) : [];
    const displayed = orderIds(rankedIds.filter(id => eligible.includes(id)), authoring.order[screen?.id ?? ''] ?? []);
    const runtimeSelected = candidates.length ? personalizeExperiences(candidates, { limit }).selected.map(r => r.experienceId) : [];
    return { all: ids, eligible, displayed, runtimeSelected };
  }, [screen?.experiences, screen?.id, decision, channel, authoring.order, authoring.hidden]);

  useEffect(() => { onDecision?.({ selected: chosen.runtimeSelected, eligible: chosen.eligible, all: chosen.all }); }, [chosen, onDecision]);

  const renderSurface = (id: string) => {
    const content = resolveMergedContent(id);
    if (!content) return null;
    const arm = content.variantExp ? decision.variantOf(content.variantExp) : null;
    const title = contentTitle(content, lang === 'ar' ? 'ar' : 'en', arm);
    const body = contentBody(content, lang === 'ar' ? 'ar' : 'en');
    const Icon = resolveExperienceIcon(content.icon);
    const inner = content.kind === 'hint'
      ? <ExperienceHint text={title} decision={decision.context} experienceId={id} surface={surface} />
      : <ExperienceBanner Icon={Icon} title={title} body={body} variant={content.variant ?? arm} decision={decision.context} experienceId={id} surface={surface} />;
    return (
      <AuthoringSurface key={id} id={id} kind={content.kind} lang={lang}
        selected={authoring.selectedId === id} locked={authoring.locked.includes(id)}
        onSelect={() => onSelect(id)}
        onInlineEdit={(patch) => onInlineEdit(id, patch)}
        onAction={(a) => onAction(id, a)}>
        {inner}
      </AuthoringSurface>
    );
  };

  const surfaces = chosen.displayed.map(renderSurface).filter(Boolean);
  const isMobile = def?.form === 'mobile';
  const tabs = channel === 'customer' ? CUSTOMER_TABS : channel === 'driver' ? DRIVER_TABS : [];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  // Navigate to a chrome target only if it is a real screen of this channel.
  const navTo = (screen: string) => { if (onNavigate && (def?.screens.some(s => s.id === screen))) onNavigate(screen); };
  // Shell overrides — authored labels/theme applied live.
  const navLabel = (screen: string, ar: string, en: string): string => {
    const o = shell?.navLabels?.[screen]; const v = lang === 'ar' ? o?.ar : o?.en;
    return (v && v.trim()) ? v : L(ar, en);
  };
  const defaultBrand = def?.en === 'Driver App' ? 'HAAT Captain' : channel === 'merchant' ? L('بوابة التاجر', 'Merchant Portal') : 'HAAT NOW';
  const brandText = (() => { const v = lang === 'ar' ? shell?.brand?.ar : shell?.brand?.en; return (v && v.trim()) ? v : defaultBrand; })();
  const shellThemeVars: React.CSSProperties = shell?.theme ? {
    ...(shell.theme.primary ? { ['--color-primary-fixed' as string]: shell.theme.primary, ['--color-on-primary-fixed' as string]: onColor(shell.theme.primary) } : {}),
    ...(shell.theme.accent ? { ['--color-tertiary-fixed' as string]: shell.theme.accent } : {}),
    ...(shell.theme.radius != null ? { ['--card-radius' as string]: `${shell.theme.radius}px` } : {}),
  } as React.CSSProperties : {};

  const emptyNote = (
    <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
      <p style={{ fontSize: 12.5, margin: 0 }}>{L('لا توجد تجربة يضعها المحرّك على هذه الشاشة.', 'The engine places no experience on this screen.')}</p>
      <p style={{ fontSize: 11, margin: '6px 0 0', opacity: 0.75 }}>{L('فعّل علماً لهذه الشاشة من مركز التجربة.', 'Enable a flag for this screen in the Experience Center.')}</p>
    </div>
  );

  const body = previewState !== 'default'
    ? <StatePreview state={previewState} lang={lang} />
    : (
    <div style={{ display: 'grid', gap: 10 }} id="channel_surfaces" onClick={() => onSelect(null)}>
      {surfaces.length > 0
        ? <div style={{ display: 'grid', gap: 10 }} onClick={e => e.stopPropagation()}>{surfaces}</div>
        : (screen?.experiences.length ? emptyNote : emptyNote)}
    </div>
  );

  return (
    <div dir={dir} id="channel_preview" data-channel={channel} data-screen={screen?.id} style={{ width: '100%', display: 'grid', gap: 8, ['--wsx-sec-radius' as string]: '14px', ...shellThemeVars } as React.CSSProperties}>
      <ExperienceKeyframes />
      <StudioInteractionStyles scope="#channel_preview" />
      {/* Breadcrumbs — Channel › Screen › (Experience) */}
      <div id="channel_breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>
        <span style={{ fontWeight: 700, color: 'var(--color-on-surface)' }}>{L(def?.ar ?? '', def?.en ?? '')}</span>
        <ChevronRight size={12} />
        <span style={{ fontWeight: 700, color: 'var(--color-on-surface)' }}>{L(screen?.ar ?? '', screen?.en ?? '')}</span>
        {authoring.selectedId && (<>
          <ChevronRight size={12} />
          <span style={{ fontWeight: 700, color: 'var(--color-primary-fixed,#a3f95b)' }}>{authoring.selectedId.replace('flag.', '')}</span>
        </>)}
      </div>

      {isMobile ? (
        <div style={{ width: device === 'desktop' ? 390 : undefined, maxWidth: '100%', justifySelf: 'center' }}>
          <div style={{ borderRadius: 28, overflow: 'hidden', border: '1px solid var(--color-outline-variant)', background: 'var(--color-background,#0a0f0c)', boxShadow: '0 24px 70px -34px rgba(0,0,0,.7)' }}>
            <div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontSize: 10, color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container)' }}>
              <span>9:41</span><span id="app_bar_brand" style={{ fontWeight: 700 }}>{brandText}</span><span>▚ ▂ 100%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)' }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--color-primary-fixed,#a3f95b)', display: 'grid', placeItems: 'center' }}>
                {channel === 'driver' ? <Bike size={15} color="#0c2000" /> : <Home size={15} color="#0c2000" />}
              </span>
              <strong style={{ fontSize: 14, color: 'var(--color-on-surface)' }}>{L(screen?.ar ?? '', screen?.en ?? '')}</strong>
            </div>
            <div style={{ minHeight: 340, padding: 14 }}>{body}</div>
            {tabs.length > 0 && (
              <div id="channel_bottom_nav" style={{ display: 'flex', borderTop: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container)' }}>
                {tabs.map(t => {
                  const on = t.screen === screen?.id;
                  return (
                    <button key={t.screen} id={`nav_${t.screen}`} onClick={(e) => { e.stopPropagation(); navTo(t.screen); }}
                      title={L(t.ar, t.en)} className="cursor-pointer"
                      style={{ flex: 1, display: 'grid', placeItems: 'center', gap: 2, padding: '8px 0', background: 'transparent', border: 'none', color: on ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant)' }}>
                      <t.icon size={17} /><span style={{ fontSize: 9, fontWeight: on ? 800 : 500 }}>{navLabel(t.screen, t.ar, t.en)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--color-outline-variant)', background: 'var(--color-background,#0a0f0c)', display: 'grid', gridTemplateColumns: '190px 1fr', minHeight: 420 }}>
          <div style={{ borderInlineEnd: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container)', padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 12px' }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--color-primary-fixed,#a3f95b)', display: 'grid', placeItems: 'center' }}><Store size={14} color="#0c2000" /></span>
              <strong id="app_bar_brand" style={{ fontSize: 12.5, color: 'var(--color-on-surface)' }}>{brandText}</strong>
            </div>
            {MERCHANT_NAV.map(n => {
              const on = n.screen === screen?.id;
              return (
                <button key={n.screen} id={`nav_${n.screen}`} onClick={(e) => { e.stopPropagation(); navTo(n.screen); }}
                  title={L(n.ar, n.en)} className="w-full cursor-pointer text-start"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 9, marginBottom: 2, border: 'none', background: on ? 'var(--color-primary-fixed,#a3f95b)' : 'transparent', color: on ? 'var(--color-on-primary-fixed,#0c2000)' : 'var(--color-on-surface-variant)' }}>
                  <n.icon size={15} /><span style={{ fontSize: 12, fontWeight: on ? 800 : 600 }}>{navLabel(n.screen, n.ar, n.en)}</span>
                </button>
              );
            })}
          </div>
          <div style={{ padding: 18 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: 'var(--color-on-surface)' }}>{L(screen?.ar ?? '', screen?.en ?? '')}</h2>
            {body}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Authoring surface wrapper ─────────────────────────────────────────────────────
// Wraps a REAL experience surface with selection/hover outline, a floating toolbar and
// inline editing. It edits the actual rendered <h3>/<p>/<span> the production component
// output — not a copy — so what is edited is exactly what ships.
type SurfaceAction = 'hide' | 'lock' | 'up' | 'down';
const AuthoringSurface: React.FC<{
  id: string; kind: 'banner' | 'hint'; lang: 'ar' | 'en';
  selected: boolean; locked: boolean;
  onSelect: () => void; onInlineEdit: (patch: ExperienceContentOverride) => void; onAction: (a: SurfaceAction) => void;
  children: React.ReactNode;
}> = ({ id, kind, lang, selected, locked, onSelect, onInlineEdit, onAction, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const locKey: 'ar' | 'en' = lang === 'ar' ? 'ar' : 'en';

  // Make the real rendered title/body editable in place while selected & unlocked.
  useEffect(() => {
    const root = ref.current; if (!root) return;
    const titleEl = kind === 'hint' ? root.querySelector('span') : root.querySelector('h3');
    const bodyEl = kind === 'hint' ? null : root.querySelector('p');
    const editable = selected && !locked;
    const bind = (el: Element | null, field: 'title' | 'body') => {
      if (!el) return () => {};
      const node = el as HTMLElement;
      node.contentEditable = editable ? 'true' : 'false';
      node.style.outline = 'none';
      node.style.cursor = editable ? 'text' : 'inherit';
      const commit = () => {
        const text = (node.textContent ?? '').trim();
        onInlineEdit({ [field]: { [locKey]: text } } as ExperienceContentOverride);
      };
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && field === 'title') { e.preventDefault(); node.blur(); } if (e.key === 'Escape') node.blur(); };
      if (editable) { node.addEventListener('blur', commit); node.addEventListener('keydown', onKey); }
      return () => { node.removeEventListener('blur', commit); node.removeEventListener('keydown', onKey); };
    };
    const off1 = bind(titleEl, 'title');
    const off2 = bind(bodyEl, 'body');
    return () => { off1(); off2(); };
  }, [selected, locked, kind, id, locKey, onInlineEdit]);

  const cls = `wsx-sec${selected ? ' sel' : ''}${locked ? ' locked' : ''}`;
  return (
    <div ref={ref} className={cls} data-exp={id}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <div className="wsx-bar" onClick={e => e.stopPropagation()}>
          <button title={L('تحرير', 'Edit')} onClick={onSelect} style={barBtn}><Pencil size={12} /></button>
          <button title={L('لأعلى', 'Move up')} onClick={() => onAction('up')} style={barBtn}><ChevronUp size={12} /></button>
          <button title={L('لأسفل', 'Move down')} onClick={() => onAction('down')} style={barBtn}><ChevronDown size={12} /></button>
          <button title={L('إخفاء', 'Hide')} onClick={() => onAction('hide')} style={barBtn}><EyeOff size={12} /></button>
          <button title={locked ? L('فتح', 'Unlock') : L('قفل', 'Lock')} onClick={() => onAction('lock')} style={barBtn}>{locked ? <LockOpen size={12} /> : <Lock size={12} />}</button>
        </div>
      <span className="wsx-tag">{selected && (locked ? <Lock size={10} /> : <Pencil size={10} />)}{id.replace('flag.', '')}</span>
      {children}
    </div>
  );
};

const barBtn: React.CSSProperties = studioOverlayBtn;

// ── State preview ─────────────────────────────────────────────────────────────────
// Renders a neutral, representative UI state so the app can be reviewed in every
// condition WITHOUT a backend. These are interface states (skeletons, status banners,
// empty views) with generic copy — never fabricated business data (no fake merchants,
// prices or orders). The Experience Engine and services are untouched.
const STATE_VIEW: Record<Exclude<PreviewState, 'default'>, { icon: typeof Inbox; tone: string; ar: string; en: string; arSub: string; enSub: string }> = {
  empty:        { icon: Inbox,        tone: 'var(--color-on-surface-variant)', ar: 'لا يوجد شيء بعد', en: 'Nothing here yet', arSub: 'ستظهر العناصر هنا عند توفّرها.', enSub: 'Items will appear here once available.' },
  loading:      { icon: Loader2,      tone: 'var(--color-primary-fixed,#a3f95b)', ar: 'جارٍ التحميل', en: 'Loading', arSub: 'يتم جلب المحتوى…', enSub: 'Fetching content…' },
  offline:      { icon: WifiOff,      tone: '#f5a623', ar: 'لا يوجد اتصال', en: 'You are offline', arSub: 'تحقّق من الاتصال وأعد المحاولة.', enSub: 'Check your connection and retry.' },
  closed:       { icon: Clock,        tone: '#f5a623', ar: 'مغلق حالياً', en: 'Currently closed', arSub: 'يفتح المتجر لاحقاً — يمكنك التصفّح.', enSub: 'Opens later — you can still browse.' },
  busy:         { icon: Flame,        tone: '#f97316', ar: 'ازدحام مرتفع', en: 'High demand', arSub: 'قد يستغرق التحضير وقتاً أطول.', enSub: 'Preparation may take longer than usual.' },
  out_of_stock: { icon: PackageX,     tone: '#f87171', ar: 'نفد المخزون', en: 'Out of stock', arSub: 'هذا العنصر غير متوفّر مؤقتاً.', enSub: 'This item is temporarily unavailable.' },
  coupon:       { icon: TicketPercent,tone: '#4ade80', ar: 'تم تطبيق الكوبون', en: 'Coupon applied', arSub: 'تم تحديث الإجمالي بعد الخصم.', enSub: 'Your total was updated with the discount.' },
  no_driver:    { icon: UserX,        tone: '#f5a623', ar: 'جارٍ البحث عن سائق', en: 'Finding a driver', arSub: 'لم يُعيَّن سائق بعد.', enSub: 'No driver assigned yet — hang tight.' },
  cancelled:    { icon: XCircle,      tone: '#f87171', ar: 'تم الإلغاء', en: 'Order cancelled', arSub: 'تمت إعادة أي مبلغ محجوز.', enSub: 'Any held amount has been released.' },
  delivered:    { icon: CheckCircle2, tone: '#4ade80', ar: 'تم التوصيل', en: 'Delivered', arSub: 'نتمنّى لك تجربة رائعة!', enSub: 'Enjoy — thanks for ordering!' },
};

const StatePreview: React.FC<{ state: Exclude<PreviewState, 'default'>; lang: 'ar' | 'en' }> = ({ state, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const v = STATE_VIEW[state];
  const Icon = v.icon;
  return (
    <div id="channel_state_preview" data-state={state} style={{ display: 'grid', gap: 12, padding: '18px 6px' }}>
      {/* Skeleton rows for the loading state; a status card for the rest. */}
      {state === 'loading' ? (
        <div style={{ display: 'grid', gap: 10 }} aria-hidden>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 14, background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' }}>
              <span style={{ height: 12, width: `${70 - i * 12}%`, borderRadius: 6, background: 'var(--color-surface-container-high)', opacity: 0.9 }} className="wsx-skeleton" />
              <span style={{ height: 10, width: '90%', borderRadius: 6, background: 'var(--color-surface-container-high)', opacity: 0.6 }} className="wsx-skeleton" />
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'grid', placeItems: 'center', gap: 8, textAlign: 'center', padding: '20px 14px', borderRadius: 16, background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--color-surface-container-high) 90%, transparent)', color: v.tone }}>
          <Icon size={22} className={state === 'loading' ? 'wsx-spin' : undefined} />
        </span>
        <strong style={{ fontSize: 14, color: 'var(--color-on-surface)' }}>{L(v.ar, v.en)}</strong>
        <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', maxWidth: 260 }}>{L(v.arSub, v.enSub)}</span>
      </div>
      <style>{`@keyframes wsx-spin{to{transform:rotate(360deg)}}.wsx-spin{animation:wsx-spin 1s linear infinite}@keyframes wsx-pulse{0%,100%{opacity:.5}50%{opacity:1}}.wsx-skeleton{animation:wsx-pulse 1.3s ease-in-out infinite}`}</style>
    </div>
  );
};


/** Order `ids` by a preferred sequence, keeping unlisted ids in their original order. */
function orderIds(ids: string[], preferred: string[]): string[] {
  if (!preferred.length) return ids;
  const rank = new Map(preferred.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999));
}

export default ChannelPreview;
