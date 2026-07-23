import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useHomeFeed } from '../../hooks/useHomeFeed';
import {
  Star, Clock, SearchX, Search, X, Zap, Bike, Shield, Tag,
  UtensilsCrossed, ShoppingCart, Pill, Coffee, CakeSlice, Gift, Flower2, Smartphone,
  ChevronLeft, LayoutGrid, LayoutList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CATEGORY_IMAGES, getCategoryCover, type CategoryKey } from '../../utils/categoryImages';
import { DEMO_CONTENT_ENABLED } from '../../config/runtime';
import { MarketplaceHero } from './MarketplaceHero';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { campaignService, Campaign } from '../../services/campaign.service';
import { useTranslation } from 'react-i18next';
// Experience Runtime (Waves 1–18) — this screen asks the ONE engine what to show.
import { useExperience, usePersonalizedExperiences, trackInteraction } from '../../services/experience-platform.service';
import type { ExperienceCandidate } from '../../experience-engine';
import { ExperienceBanner, ExperienceHint, ExperienceKeyframes } from '../../components/experience/ExperienceSurfaces';
import { resolveMergedContent, hydrateExperienceContent } from '../../services/experience-content.service';
import { resolveExperienceIcon } from '../../components/experience/experienceIcons';
import { contentTitle, contentBody } from '../../experience-content/content';

// Map a marketplace category key to the on-screen category filter id.
const CAT_KEY_TO_ID: Record<CategoryKey, string> = {
  restaurant: 'cat-food', market: 'cat-market', pharmacy: 'cat-pharmacy', coffee: 'cat-coffee',
  sweets: 'cat-sweets', gifts: 'cat-perfume', perfume: 'cat-perfume', flowers: 'cat-flowers', electronics: 'cat-electronics',
};

/* ─── Types (the branch/offer wire types stay owned by home.service) ─────────── */
interface Category { id: string; name: string; cat: CategoryKey; Icon: LucideIcon; tintFrom: string; tintTo: string; patterns: string[]; }

/**
 * The ONE shape Home renders. A real branch and a fallback merchant both normalize
 * to this, so categories, search, the merchant list and Featured all read the same
 * dataset. Home used to render one dataset while filtering another — which is why
 * every category and every search returned "no results".
 */
interface HomeMerchant {
  id: string; name: string; cuisine: string; eta: string; delivery: string;
  rating: string; min: string; badge: string; badgeLime: boolean;
  /** Category key for fallback imagery; real branches use their logo. */
  type?: string;
  logoUrl?: string | null;
  /** True for demo rows — they carry no real branch id, so they get no `branch_*` anchor. */
  isFallback: boolean;
}

/* ─── Category Data — §5 Lovable ────────────────────────────── */
const CATEGORIES: Category[] = [
  { id: 'cat-food',        name: 'المطاعم',       cat: 'restaurant',  Icon: UtensilsCrossed, tintFrom: 'rgba(163,249,91,0.32)',  tintTo: 'rgba(163,249,91,0.08)',  patterns: ['جليلة','مايسترو','pizza','burger','مطعم','باشا','رومانو'] },
  { id: 'cat-market',      name: 'السوبر ماركت',  cat: 'market',      Icon: ShoppingCart,    tintFrom: 'rgba(26,180,120,0.32)',  tintTo: 'rgba(26,180,120,0.08)',  patterns: ['التميمي','بقالة','سوبر','market','فريش'] },
  { id: 'cat-pharmacy',    name: 'الصيدلية',      cat: 'pharmacy',    Icon: Pill,            tintFrom: 'rgba(220,60,60,0.28)',   tintTo: 'rgba(220,60,60,0.07)',   patterns: ['الدواء','صيدلية','pharmacy'] },
  { id: 'cat-coffee',      name: 'القهوة',        cat: 'coffee',      Icon: Coffee,          tintFrom: 'rgba(210,165,40,0.32)',  tintTo: 'rgba(210,165,40,0.08)',  patterns: ['قهو','coffee','مليون','لاتيه'] },
  { id: 'cat-sweets',      name: 'الحلويات',      cat: 'sweets',      Icon: CakeSlice,       tintFrom: 'rgba(210,165,40,0.28)',  tintTo: 'rgba(163,249,91,0.06)',  patterns: ['حلو','dessert','كيك'] },
  { id: 'cat-perfume',     name: 'العطور',        cat: 'perfume',     Icon: Gift,            tintFrom: 'rgba(190,120,220,0.28)', tintTo: 'rgba(190,120,220,0.06)', patterns: ['عطر','عطور','بخور','عود','perfume','fragrance'] },
  { id: 'cat-flowers',     name: 'الزهور',        cat: 'flowers',     Icon: Flower2,         tintFrom: 'rgba(26,180,120,0.28)',  tintTo: 'rgba(163,249,91,0.06)',  patterns: ['زهور','flowers'] },
  { id: 'cat-electronics', name: 'إلكترونيات',    cat: 'electronics', Icon: Smartphone,      tintFrom: 'rgba(163,249,91,0.28)',  tintTo: 'rgba(26,180,120,0.06)',  patterns: ['إلكترون','electronics','جوال'] },
];

/* Feature gates for controls whose destination does not exist yet. The markup is
   kept intact and simply not rendered — a visible control that does nothing is worse
   than no control. Flip to true in the same commit that lands the destination.
     · SHOW_FILTERS   — needs a filter sheet (sort / price / rating / distance).
     · SHOW_ALL_OFFERS — needs a dedicated offers screen; Home has no route to one. */
const SHOW_FILTERS = false;
const SHOW_ALL_OFFERS = false;

/** Merchants shown before "More" lifts the cap. */
const PREVIEW_COUNT = 4;

/* ─── Offer banner palette — VISUAL STYLING ONLY ──────────────────────────────
   Gradients + accent glows. REAL offers are rendered with these: a live offer brings
   its own title and subtitle from the database and borrows only its colours here.
   This is design, not content — which is why it is not gated. */
const BANNER_PALETTE = [
  { bg: 'linear-gradient(135deg,#0d2a08 0%,#061403 100%)', accent: 'rgba(163,249,91,0.40)' },
  { bg: 'linear-gradient(135deg,#0c1a2e 0%,#060e1c 100%)', accent: 'rgba(100,170,255,0.30)' },
  { bg: 'linear-gradient(135deg,#2a1008 0%,#140500 100%)', accent: 'rgba(255,140,60,0.35)' },
];

/* ─── Demo offer banners — FABRICATED CONTENT, sandbox only ───────────────────
   Invented offers for the demo. Never rendered in production: a marketplace with no
   live offers shows no offers section at all. Gated by DEMO_CONTENT_ENABLED and
   enforced by scripts/check-demo-isolation.cjs. */
const STATIC_BANNERS = [
  { id: 'ob1', qualifier: 'عرض حصري',      title: 'خصم 50%',     subtitle: 'على البيتزا الطازجة', ...BANNER_PALETTE[0] },
  { id: 'ob2', qualifier: 'مجاني تماماً',  title: 'توصيل مجاني', subtitle: 'على أول 3 طلبات',      ...BANNER_PALETTE[1] },
  { id: 'ob3', qualifier: 'كومبو العائلة', title: 'خصم 30%',     subtitle: 'على طلبات الأسرة',    ...BANNER_PALETTE[2] },
];

/* ─── Fallback merchants — the demo dataset (always-visible) ──────────────────
   The ONE dataset Home falls back to when the backend returns no branches.
   It must cover every category in CATEGORIES below (the category `patterns` match
   these names) — otherwise selecting a category dead-ends on an empty result. */
const FALLBACK_MERCHANTS = [
  { id: 'm1', name: 'مطعم الباشا',         cuisine: 'مشاوي • كباب فاخر',            eta: '25-35', delivery: 'مجاني', rating: '4.9', min: '50',  type: 'grills',      badge: 'مميز',            badgeLime: true  },
  { id: 'm2', name: 'بيتزا رومانو',        cuisine: 'إيطالي • بيتزا نابوليتانا',    eta: '30-45', delivery: '10',    rating: '4.8', min: '40',  type: 'pizza',       badge: 'الأكثر طلباً',    badgeLime: false },
  { id: 'm3', name: 'كافيه لاتيه',         cuisine: 'كافيه • مشروبات فاخرة',        eta: '20-30', delivery: 'مجاني', rating: '4.7', min: '30',  type: 'coffee',      badge: 'اختيار الذواقة', badgeLime: false },
  { id: 'm4', name: 'سوبر فريش',           cuisine: 'سوبر ماركت • مستلزمات يومية',  eta: '45-60', delivery: '15',    rating: '4.6', min: '80',  type: 'market',      badge: 'مميز',            badgeLime: true  },
  { id: 'm5', name: 'صيدلية الشفاء',       cuisine: 'صيدلية • أدوية وصحة',          eta: '20-30', delivery: 'مجاني', rating: '4.8', min: '25',  type: 'pharmacy',    badge: 'مميز',            badgeLime: false },
  { id: 'm6', name: 'حلويات أصيل',         cuisine: 'حلويات • كيك وشوكولاتة',       eta: '30-40', delivery: '10',    rating: '4.7', min: '35',  type: 'sweets',      badge: 'اختيار الذواقة', badgeLime: false },
  { id: 'm7', name: 'عطور الشرق',          cuisine: 'عطور • عود وبخور',             eta: '35-50', delivery: '15',    rating: '4.6', min: '60',  type: 'perfume',     badge: 'مميز',            badgeLime: true  },
  { id: 'm8', name: 'زهور المدينة',        cuisine: 'زهور • باقات وهدايا',          eta: '40-55', delivery: '12',    rating: '4.5', min: '45',  type: 'flowers',     badge: 'جديد',            badgeLime: false },
  { id: 'm9', name: 'إلكترونيات المستقبل', cuisine: 'إلكترونيات • أجهزة وجوالات',   eta: '45-60', delivery: '20',    rating: '4.4', min: '100', type: 'electronics', badge: 'جديد',            badgeLime: false },
];

/* ─── Banner Illustration — multi-vertical marketplace promo imagery ───────── */
function BannerIllustration({ id }: { id: string }) {
  // Offers span the whole marketplace, so banners rotate across verticals
  // (not food-only) — deterministic per banner id.
  const ROTATION: CategoryKey[] = ['restaurant', 'market', 'coffee', 'flowers', 'gifts', 'sweets'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % ROTATION.length;
  return (
    <img src={CATEGORY_IMAGES[ROTATION[h]].cover} alt="" aria-hidden="true" loading="lazy" decoding="async"
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} />
  );
}


/* ─── Restaurant Photo Fallback — real photography ──────────── */
function RestaurantPhoto({ type, name }: { type?: string; name: string }) {
  // Category-specific cover — pharmacies/flowers/electronics never get food imagery.
  return <img src={getCategoryCover(name, type)} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}

function getCuisine(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('قهو') || n.includes('coffee') || n.includes('لاتيه')) return 'كافيه • مشروبات فاخرة';
  if (n.includes('بيتزا') || n.includes('pizza') || n.includes('رومانو')) return 'إيطالي • بيتزا نابوليتانا';
  if (n.includes('صيدل') || n.includes('دواء')) return 'صيدلية • أدوية وصحة';
  if (n.includes('تميمي') || n.includes('سوبر') || n.includes('فريش')) return 'سوبر ماركت • مستلزمات';
  if (n.includes('باشا') || n.includes('مشاوي') || n.includes('كباب')) return 'مشاوي • كباب فاخر';
  return 'مطعم • متنوع';
}

/* ─── Props ──────────────────────────────────────────────────── */
interface HomeScreenProps {
  onSelectRestaurant: (branchId: string, restaurantName: string) => void;
  onNavigateToWallet?: () => void;
  customerId: string;
  /** Filter state is owned by App (Home unmounts on navigation) so Back can restore it. */
  selectedCat: string | null;
  onSelectCat: (id: string | null) => void;
  searchQuery: string;
  onSearchQuery: (q: string) => void;
}

/* ─── Main Component ─────────────────────────────────────────── */
export const HomeScreen = ({
  onSelectRestaurant,
  selectedCat,
  onSelectCat: setSelectedCat,
  searchQuery,
  onSearchQuery: setSearchQuery,
}: HomeScreenProps) => {
  const { country, lang } = useAppConfig();
  // PHASE G/H — active hero campaign for this country + impression tracking.
  const [heroCampaign, setHeroCampaign] = useState<Campaign | null>(null);
  useEffect(() => {
    campaignService.getActiveByPlacement('hero', country.code).then(cs => {
      const c = cs[0] || null; setHeroCampaign(c);
      if (c) campaignService.track(c.id, 'impression');
    }).catch(() => { /* ignore */ });
  }, [country.code]);
  const { t } = useTranslation();
  const cur = country.currency.symbolAr;
  // Home feed (branches + active offers) via the hook → service → repository chain.
  const { branches, offers, loading } = useHomeFeed();
  const [viewMode,       setViewMode]       = useState<'large' | 'compact'>(() => (typeof localStorage !== 'undefined' && localStorage.getItem('haat_view_mode') === 'large') ? 'large' : 'compact');
  const toggleViewMode = () => setViewMode(m => { const next = m === 'large' ? 'compact' : 'large'; try { localStorage.setItem('haat_view_mode', next); } catch { /* ignore */ } return next; });
  const [activeOfferIdx, setActiveOfferIdx] = useState(0);

  const [expanded, setExpanded] = useState(false);
  const restaurantsRef = useRef<HTMLElement | null>(null);

  const isFiltering = !!searchQuery.trim() || !!selectedCat;

  const offerBanners = offers.length > 0
    ? offers.slice(0, 3).map((o, i) => ({
        id:        o.id,
        qualifier: 'خصم',
        title:     o.discount_percent ? `خصم ${o.discount_percent}%` : o.title,
        subtitle:  o.title,
        bg:        BANNER_PALETTE[i % BANNER_PALETTE.length].bg,
        accent:    BANNER_PALETTE[i % BANNER_PALETTE.length].accent,
      }))
    // Demo banners are sandbox-only; production with no live offers shows no offers.
    : DEMO_CONTENT_ENABLED ? STATIC_BANNERS : [];


  /* ── THE one logical dataset ────────────────────────────────────────────────
     Real branches when the backend returns any, else the fallback demo dataset.
     Categories, search, the merchant list and Featured all derive from THIS —
     there is no second list to drift out of sync with. */
  const sourceList = useMemo<HomeMerchant[]>(() => (
    branches.length > 0
      ? branches.map((b) => {
          const name = b.merchants?.business_name || b.name;
          // REAL merchants carry no rating/ETA/fee/minimum in the catalogue yet, so these
          // are left EMPTY — never invented. Fabricating a 4.9 rating or a "free delivery"
          // claim on a real store is a consumer-protection and pricing-representation risk.
          // The card hides an empty field. Populate these from real branch data when it lands.
          return {
            id: b.id,
            name,
            cuisine: getCuisine(name),
            eta:      '',
            delivery: '',
            rating:   '',
            min:      '',
            badge:     '',
            badgeLime: false,
            logoUrl: b.merchants?.logo_url ?? null,
            isFallback: false,
          };
        })
      // Demo merchants exist for the sandbox demo ONLY. An empty catalogue in
      // production is an empty state — never invented merchants.
      : DEMO_CONTENT_ENABLED
        ? FALLBACK_MERCHANTS.map(m => ({ ...m, logoUrl: null, isFallback: true }))
        : []
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the arrays above derive purely from `cur`
  ), [branches, cur]);

  /* The single filter, applied to the single dataset. */
  const visible = useMemo(() => {
    const q   = searchQuery.toLowerCase().trim();
    const cat = selectedCat ? CATEGORIES.find(c => c.id === selectedCat) : null;
    return sourceList.filter(m => {
      const name = m.name.toLowerCase();
      if (q && !name.includes(q) && !m.cuisine.toLowerCase().includes(q)) return false;
      if (!cat) return true;
      return cat.patterns.some(p => name.includes(p.toLowerCase()));
    });
  }, [sourceList, searchQuery, selectedCat]);

  /** Clear every filter and bring the merchant list into view, fully expanded. */
  const revealMerchants = useCallback(() => {
    setSearchQuery(''); setSelectedCat(null); setExpanded(true);
    restaurantsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /* An offer carries no merchant id in the schema, so resolve it the way categories
     already do — by matching its text against the same dataset. A marketplace-wide
     offer ("free delivery on your first 3 orders") matches nothing and instead reveals
     the merchant list, where it actually gets applied. Either way: never a dead CTA. */
  const merchantForOffer = useCallback((offer: { title: string; subtitle: string }): HomeMerchant | null => {
    const words = `${offer.title} ${offer.subtitle}`
      .toLowerCase()
      .split(/[\s،,.\-•%\d]+/)
      .map(w => (w.startsWith('ال') ? w.slice(2) : w))   // strip the Arabic definite article
      .filter(w => w.length >= 3);
    return sourceList.find(m => {
      const hay = `${m.name} ${m.cuisine}`.toLowerCase();
      return words.some(w => hay.includes(w));
    }) ?? null;
  }, [sourceList]);

  const openOffer = useCallback((offer: { title: string; subtitle: string }) => {
    const m = merchantForOffer(offer);
    if (m) onSelectRestaurant(m.id, m.name);
    else revealMerchants();
  }, [merchantForOffer, onSelectRestaurant, revealMerchants]);

  // Dismissal state is keyed by short name; the engine speaks in flag ids.
  const SURFACE_KEY: { [id: string]: 'welcome' | 'offers' | 'tour' } = {
    'flag.customer_welcome': 'welcome', 'flag.customer_offers': 'offers', 'flag.customer_feature_tour': 'tour',
  };

  // ── Experience Runtime decision for this visitor (audiences → flags → experiments) ──
  const xp = useExperience({ surface: 'customer', locale: lang === 'ar' ? 'ar' : 'en', experienceId: 'home' });
  // Load authored content overrides once; useExperience re-renders this screen when they land.
  useEffect(() => { void hydrateExperienceContent(); }, []);
  const [xpDismissed, setXpDismissed] = useState<{ welcome?: boolean; offers?: boolean; tour?: boolean }>({});
  // Exactly ONE surface is shown at a time. Which one is no longer a fixed priority chain — the
  // Personalization Engine (Wave 20) ranks the eligible candidates for THIS visitor from their own
  // behaviour, then applies frequency caps and fatigue. A visitor who keeps dismissing the welcome
  // banner stops seeing it; a coupon seeker gets offers first. Stacking several would push the
  // marketplace rails below the fold — the product content stays the hero of this screen.
  const xpCandidates: ExperienceCandidate[] = [
    { experienceId: 'flag.customer_welcome', priority: 30 },
    { experienceId: 'flag.customer_offers', priority: 20 },
    { experienceId: 'flag.customer_feature_tour', priority: 10 },
  ].filter(c => xp.isOn(c.experienceId) && !xpDismissed[SURFACE_KEY[c.experienceId]]);
  const xpChoice = usePersonalizedExperiences(xpCandidates, 1)[0] ?? '';

  // Wave 20.1 · every marketplace interaction feeds the visitor profile. Opening a merchant is the
  // strongest interest signal the customer app has, so it carries merchant, cuisine and store type.
  const openMerchant = useCallback((id: string, name: string, cuisine?: string, storeType?: string) => {
    trackInteraction(xp.context, 'merchant.open', { merchant: name, cuisine, storeType }, 'customer');
    onSelectRestaurant(id, name);
  }, [xp.context, onSelectRestaurant]);

  const chooseCategory = useCallback((catId: string | null, catName?: string) => {
    if (catId) trackInteraction(xp.context, 'category.select', { category: catName ?? catId }, 'customer');
    setSelectedCat(catId);
  }, [xp.context, setSelectedCat]);

  const xpWelcome = xpChoice === 'flag.customer_welcome';
  const xpOffers = xpChoice === 'flag.customer_offers';
  const xpTour = xpChoice === 'flag.customer_feature_tour';

  return (
    <div id="home_screen_portal" dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ position: 'relative' }}>
      <ExperienceKeyframes />

      {/* ══ 1. MARKETPLACE HERO — rotating multi-vertical carousel ══ */}
      {!isFiltering && (<>
        <MarketplaceHero onShop={(c) => setSelectedCat(CAT_KEY_TO_ID[c] ?? null)} />

        {/* PHASE G — dynamic hero campaign banner (Super-Admin managed) */}
        {heroCampaign && (
          <section className="mb-3" id="home_campaign_hero" style={{ position: 'relative', zIndex: 2 }}>
            <div id="campaign_hero_banner" onClick={() => { campaignService.track(heroCampaign.id, 'click'); if (heroCampaign.destination_url) window.open(heroCampaign.destination_url, '_blank'); }}
              className="glass glass-shine rounded-2xl overflow-hidden cursor-pointer relative active:scale-[0.99] transition-transform" style={{ minHeight: '116px', border: '1px solid rgba(163,249,91,0.2)' }}>
              {heroCampaign.image_url && <img src={heroCampaign.image_url} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }} />}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, rgba(8,11,14,0.92), rgba(8,11,14,0.55))' }} />
              <div className="relative p-5 text-right">
                <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.01em' }}>{heroCampaign.title}</h3>
                {heroCampaign.subtitle && <p style={{ color: 'rgba(225,226,231,0.85)', fontSize: '13px', marginTop: '4px' }}>{heroCampaign.subtitle}</p>}
                {heroCampaign.cta_label && <button style={{ marginTop: '10px', background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', padding: '7px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer' }}>{heroCampaign.cta_label}</button>}
              </div>
            </div>
          </section>
        )}
      </>)}

      {/* ══ 2. SEARCH — polished silver §4 ══ */}
      <section className="mb-4" id="home_search" style={{ position: 'relative', zIndex: 2 }}>
        <div
          className="glass glass-shine"
          style={{
            height: '52px', borderRadius: '16px',
            paddingLeft: '6px', paddingRight: '16px',
            direction: 'ltr', display: 'flex', alignItems: 'center', gap: '10px',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div className="flex-shrink-0" style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--color-primary-fixed)', boxShadow: '0 0 18px rgba(163,249,91,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={18} color="#0c2000" strokeWidth={2.5} />
          </div>
          <input
            type="text" placeholder={t('common.search')}
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            id="home_search_input" dir={lang === 'ar' ? 'rtl' : 'ltr'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f2f4f6', fontSize: '13px', caretColor: 'var(--color-primary-fixed)', minWidth: 0 }}
          />
          {searchQuery ? (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
              <X size={15} color="rgba(242,244,246,0.5)" strokeWidth={2.5} />
            </button>
          ) : SHOW_FILTERS ? (
            <>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.20)', flexShrink: 0 }} />
              <button style={{ background: 'none', border: 'none', color: 'var(--color-primary-fixed)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '0 2px', flexShrink: 0, whiteSpace: 'nowrap' }}>{t('home.filters')}</button>
            </>
          ) : null}
        </div>
      </section>

      {/* ══ 3. CATEGORIES — ultra-compact 4×2 glass photo shortcuts (8-in-a-row on desktop) ══ */}
      <section className="mb-3" id="home_categories" style={{ position: 'relative', zIndex: 2 }}>
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-1.5">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCat === cat.id;
            const img = CATEGORY_IMAGES[cat.cat].cover;
            return (
              <button
                key={cat.id}
                onClick={() => chooseCategory(isActive ? null : cat.id, cat.name)}
                className="category-card group active:scale-[0.95] transition-transform cursor-pointer"
                aria-pressed={isActive}
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 0.72',
                  width: '100%',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  padding: 0,
                  background: 'linear-gradient(180deg, #1a1e22 0%, #0d1013 100%)',
                  border: isActive ? '1.5px solid var(--color-primary-fixed)' : '1px solid rgba(255,255,255,0.10)',
                  boxShadow: isActive
                    ? '0 0 0 2px rgba(163,249,91,0.25), 0 0 20px rgba(163,249,91,0.45), 0 8px 20px rgba(0,0,0,0.5)'
                    : '0 6px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                {/* Category photo */}
                <img
                  src={img}
                  alt={cat.name}
                  loading="lazy"
                  decoding="async"
                  className="category-card__img w-full h-full object-cover"
                  style={{ opacity: isActive ? 1 : 0.82, transition: 'opacity 200ms ease, transform 300ms ease' }}
                />
                {/* Legibility scrim */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,9,11,0.96) 0%, rgba(6,9,11,0.38) 52%, rgba(6,9,11,0.08) 100%)', pointerEvents: 'none' }} />
                {/* Subtle glass reflection — top sheen */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '46%', background: 'linear-gradient(180deg, rgba(255,255,255,0.16), transparent)', pointerEvents: 'none' }} />
                {/* Green hover/active glow */}
                <div className="category-card__glow" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 118%, rgba(163,249,91,0.34), transparent 62%)', opacity: isActive ? 1 : 0, transition: 'opacity 220ms ease', pointerEvents: 'none' }} />
                {/* Label */}
                <span style={{
                  position: 'absolute', left: '3px', right: '3px', bottom: '5px',
                  textAlign: 'center', fontSize: '10px', fontWeight: 700, lineHeight: 1.1,
                  color: isActive ? 'var(--color-primary-fixed)' : '#f2f4f6',
                  textShadow: '0 1px 6px rgba(0,0,0,0.85)', letterSpacing: '-0.02em',
                }}>
                  {t('cats.' + cat.cat)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ══ 4. OFFER BANNERS — focal point §10 ══ */}
      {/* No offers → no offers section. An empty carousel under a heading is worse
          than no heading, and inventing banners to fill it is worse still. */}
      {!isFiltering && offerBanners.length > 0 && (
        <section className="mb-3" id="home_offers" style={{ position: 'relative', zIndex: 2 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
            {SHOW_ALL_OFFERS && <button type="button" style={{ color: 'var(--color-primary-fixed)', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{t('common.viewAll')}</button>}
            <h2 className="flex items-center gap-2" style={{ fontSize: '17px', fontWeight: 800, color: '#f2f4f6', letterSpacing: '-0.01em' }}>
              <Zap size={16} color="var(--color-primary-fixed)" strokeWidth={2.5} style={{ filter: 'drop-shadow(0 0 8px rgba(163,249,91,0.60))' }} />
              {t('home.exclusiveOffers')}
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1" style={{ direction: 'ltr' }}
            onScroll={e => setActiveOfferIdx(Math.round(e.currentTarget.scrollLeft / (300 + 12)))}>
            {offerBanners.map(offer => (
              <div
                key={offer.id}
                id={`offer_card_${offer.id}`}
                onClick={() => openOffer(offer)}
                className="flex-shrink-0 cursor-pointer active:scale-[0.97] transition-transform"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                style={{
                  width: '300px', height: '178px', borderRadius: '22px', overflow: 'hidden',
                  position: 'relative', flexShrink: 0,
                  boxShadow: '0 22px 55px rgba(0,0,0,0.70), 0 8px 20px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.16)',
                  borderTop: '1px solid rgba(255,255,255,0.16)',
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                  borderRight: '1px solid rgba(255,255,255,0.08)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, background: offer.bg }} />
                {/* Accent glow — stronger, centered on illustration */}
                <div style={{ position: 'absolute', top: '-40px', right: '-20px', width: '220px', height: '220px', borderRadius: '50%', background: offer.accent, filter: 'blur(65px)', opacity: 0.90, pointerEvents: 'none' }} />
                {/* Bottom accent depth */}
                <div style={{ position: 'absolute', bottom: '-20px', left: '10%', width: '120px', height: '120px', borderRadius: '50%', background: offer.accent, filter: 'blur(45px)', opacity: 0.35, pointerEvents: 'none' }} />
                {/* Illustration — expanded to fill left 56% */}
                <div style={{ position: 'absolute', left: '-8px', top: '-8px', bottom: '-8px', width: '58%' }}>
                  <BannerIllustration id={offer.id} />
                </div>
                {/* Scrim — preserves text legibility */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 0%, rgba(6,8,10,0.45) 36%, rgba(6,8,10,0.92) 58%, rgba(6,8,10,1) 72%)' }} />
                {/* Top specular */}
                <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)', pointerEvents: 'none' }} />
                {/* Text column */}
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '55%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', padding: '14px 16px 12px' }}>
                  <p style={{ fontSize: '10px', color: 'var(--color-primary-fixed)', fontWeight: 700, letterSpacing: '0.08em', textShadow: '0 0 14px rgba(163,249,91,0.65)', margin: 0, textTransform: 'uppercase' }}>
                    {'qualifier' in offer ? (offer as typeof STATIC_BANNERS[0]).qualifier : 'خصم'}
                  </p>
                  <p style={{ fontSize: '32px', fontWeight: 900, color: '#f2f4f6', letterSpacing: '-0.04em', lineHeight: 0.95, margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.60)' }}>{offer.title}</p>
                  {'subtitle' in offer && (offer as typeof STATIC_BANNERS[0]).subtitle && (
                    <p style={{ fontSize: '11px', color: 'rgba(180,184,188,0.90)', lineHeight: 1.3, margin: 0 }}>{(offer as typeof STATIC_BANNERS[0]).subtitle}</p>
                  )}
                  <button type="button" id={`offer_cta_${offer.id}`} className="animate-pulse-glow"
                    onClick={e => { e.stopPropagation(); openOffer(offer); }}
                    style={{ alignSelf: 'flex-start', marginTop: '5px', height: '36px', padding: '0 18px', borderRadius: '18px', background: 'var(--color-primary-fixed)', border: 'none', color: '#0c2000', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 0 18px rgba(163,249,91,0.50), 0 3px 10px rgba(0,0,0,0.40)' }}>
                    {t('restaurant.orderNow')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center items-center gap-1.5 mt-2">
            {offerBanners.map((_, i) => (
              <div key={i} style={{ width: i === activeOfferIdx ? '22px' : '6px', height: '5px', borderRadius: '3px', background: i === activeOfferIdx ? 'var(--color-primary-fixed)' : 'rgba(255,255,255,0.18)', transition: 'all 0.3s ease', boxShadow: i === activeOfferIdx ? '0 0 10px rgba(163,249,91,0.60)' : 'none' }} />
            ))}
          </div>
        </section>
      )}

      {/* ══ 5. RESTAURANTS ══ */}
      <section className="mb-4" id="home_restaurants" ref={restaurantsRef} style={{ position: 'relative', zIndex: 2 }}>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={toggleViewMode} id="view_mode_toggle" aria-label={t('home.toggleView')}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-primary-fixed)' }}>
            {viewMode === 'large' ? <LayoutGrid size={16} strokeWidth={2} /> : <LayoutList size={16} strokeWidth={2} />}
          </button>
          {/* "More" lifts the 4-merchant cap — shown only while there is more to reveal. */}
          {!isFiltering && !expanded && visible.length > PREVIEW_COUNT && <button type="button" id="home_more_merchants" onClick={() => setExpanded(true)} style={{ color: 'var(--color-primary-fixed)', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '2px', marginInlineStart: 'auto', marginInlineEnd: '8px' }}>
            {t('common.more')} <ChevronLeft size={14} strokeWidth={2.5} />
          </button>}
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#f2f4f6', letterSpacing: '-0.01em' }}>
            {isFiltering ? t('home.searchResults') : t('home.nearest')}
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl skeleton" style={{ height: '240px' }} />)}</div>
        ) : visible.length === 0 ? (
          /* Two different empty states. Filtering → "nothing matched, clear it".
             Not filtering → the catalogue itself is empty (production, no merchants
             onboarded yet). Neither one may invent content to fill the space. */
          <div className="flex flex-col items-center gap-3 py-8 text-center glass rounded-2xl" id={isFiltering ? 'home_no_results' : 'home_no_merchants'} style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <SearchX size={28} color="rgba(170,176,182,0.50)" strokeWidth={1.5} />
            <p style={{ color: '#f2f4f6', fontSize: '15px', fontWeight: 600 }}>
              {!isFiltering ? t('home.noMerchants') : searchQuery.trim() ? `${t('home.noResults')} "${searchQuery}"` : t('home.noResults')}
            </p>
            {!isFiltering
              ? <p style={{ color: 'rgba(170,176,182,0.70)', fontSize: '13px', maxWidth: '260px' }}>{t('home.noMerchantsSub')}</p>
              : <button onClick={() => { setSearchQuery(''); setSelectedCat(null); }} style={{ padding: '8px 20px', borderRadius: '999px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(170,176,182,0.80)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{t('home.showAllStores')}</button>}
          </div>
        ) : (
          <div className={viewMode === 'compact' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3' : 'space-y-3'} id="restaurants_list">
            {(isFiltering || expanded ? visible : visible.slice(0, PREVIEW_COUNT)).map((m) => {
              const { id, name, cuisine, eta, delivery, rating, min: minOrd, badge, badgeLime, type: typeKey, logoUrl } = m;
              if (viewMode === 'compact') return (
                <div key={id} onClick={() => openMerchant(id, name, cuisine, typeKey)}
                  className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                  id={m.isFallback ? undefined : `branch_${id}`}
                  style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg,#1c2026,#13171a)' }}>
                  <div className="relative" style={{ height: '92px', background: '#060a0e' }}>
                    {logoUrl ? <img src={logoUrl} alt={name} className="w-full h-full object-cover" /> : <RestaurantPhoto type={typeKey} name={name} />}
                    {rating && (
                      <div className="absolute top-2 start-2 flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(8,12,16,0.72)', backdropFilter: 'blur(12px)' }}>
                        <Star size={10} color="#f0c840" fill="#f0c840" strokeWidth={0} /><span style={{ fontSize: '10px', color: 'white', fontWeight: 800 }}>{rating}</span>
                      </div>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <h3 className="truncate" style={{ color: '#f2f4f6', fontSize: '13px', fontWeight: 700, textAlign: 'right', margin: 0 }}>{name}</h3>
                    <p className="truncate" style={{ color: 'rgba(160,165,170,0.65)', fontSize: '10px', textAlign: 'right' }}>{cuisine}</p>
                    {(minOrd || eta) && (
                      <div className="flex items-center justify-between mt-1" style={{ fontSize: '10px', color: 'rgba(170,176,182,0.8)' }}>
                        <span>{minOrd}</span><span>{eta}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
              return (
                <div key={id} onClick={() => openMerchant(id, name, cuisine, typeKey)}
                  className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-transform" id={m.isFallback ? undefined : `branch_${id}`}
                  style={{
                    boxShadow: '0 14px 40px rgba(0,0,0,0.60), 0 4px 12px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)',
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: '1px solid rgba(0,0,0,0.40)',
                  }}>
                  {/* Food image — 168px tall for more visual impact */}
                  <div className="relative overflow-hidden" style={{ height: '168px', background: '#060a0e' }}>
                    {logoUrl
                      ? <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
                      : <RestaurantPhoto type={typeKey} name={name} />
                    }
                    {/* Stronger gradient overlay for depth */}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,11,14,0.98) 0%, rgba(8,11,14,0.50) 38%, rgba(8,11,14,0.08) 65%, transparent 80%)' }} />
                    {/* Top vignette */}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 30%)' }} />
                    {/* Badge — top end (RTL = top left visually). Hidden when not a real badge. */}
                    {badge && (
                      <div className="absolute top-3 end-3 px-2.5 py-1 rounded-full" style={{ background: badgeLime ? 'var(--color-primary-fixed)' : 'rgba(10,14,18,0.72)', border: badgeLime ? 'none' : '1px solid rgba(255,255,255,0.18)', color: badgeLime ? '#0a1c00' : 'rgba(255,255,255,0.88)', fontSize: '11px', fontWeight: 700, backdropFilter: 'blur(12px)', boxShadow: badgeLime ? '0 0 14px rgba(163,249,91,0.55)' : '0 2px 8px rgba(0,0,0,0.50)' }}>
                        {badge}
                      </div>
                    )}
                    {/* Rating pill — top start. Hidden until a real rating exists. */}
                    {rating && (
                      <div className="absolute top-3 start-3 flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: 'rgba(8,12,16,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 2px 8px rgba(0,0,0,0.50)' }}>
                        <Star size={11} color="#f0c840" fill="#f0c840" strokeWidth={0} />
                        <span style={{ fontSize: '11px', color: 'white', fontWeight: 800 }}>{rating}</span>
                      </div>
                    )}
                  </div>
                  {/* Card body */}
                  <div className="px-4 py-3" style={{ background: 'linear-gradient(180deg, #1c2026 0%, #13171a 100%)' }}>
                    <div className="flex items-start justify-between mb-1">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(163,249,91,0.70)', fontWeight: 600 }}>{t('common.openNow')}</span>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(163,249,91,0.55)', display: 'inline-block', boxShadow: '0 0 6px rgba(163,249,91,0.55)' }} />
                      </div>
                      <h3 style={{ color: '#f2f4f6', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>{name}</h3>
                    </div>
                    <p style={{ color: 'rgba(160,165,170,0.65)', fontSize: '12px', marginBottom: '10px', textAlign: 'right' }}>{cuisine}</p>
                    {(minOrd || delivery || eta) && (
                      <div className="flex items-center justify-end gap-4">
                        {minOrd && (
                          <span className="flex items-center gap-1">
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)' }}>{t('home.minLabel')} {minOrd} {cur}</span>
                          </span>
                        )}
                        {delivery && <span className="flex items-center gap-1.5"><Bike size={12} color="rgba(163,249,91,0.55)" strokeWidth={2} /><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)' }}>{delivery}</span></span>}
                        {eta && <span className="flex items-center gap-1.5"><Clock size={12} color="rgba(255,255,255,0.35)" strokeWidth={2} /><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)' }}>{eta} {t('common.minutesShort')}</span></span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ══ 6. FEATURED STORES — horizontal circles ══ */}
      {!isFiltering && sourceList.length > 0 && (
        <section className="mb-4" id="home_featured_circles" style={{ position: 'relative', zIndex: 2 }}>
          <div className="flex items-center justify-between mb-3">
            <button type="button" id="home_featured_view_all" onClick={revealMerchants} style={{ color: 'var(--color-primary-fixed)', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '2px' }}>
              {t('common.viewAll')} <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#f2f4f6', letterSpacing: '-0.01em' }}>{t('home.featured')}</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {/* Same dataset as the list above — Featured is a view of it, not a copy. */}
            {sourceList.slice(0, 6).map(({ id, name: bn, type: tp, logoUrl }) => (
                <button key={`circle_${id}`}
                  onClick={() => openMerchant(id, bn, undefined, tp)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 active:scale-[0.95] transition-transform cursor-pointer"
                  style={{ background: 'none', border: 'none', width: '72px', padding: 0 }}>
                  <div style={{ width: '66px', height: '66px', borderRadius: '50%', overflow: 'hidden', background: '#0c1014', border: '2px solid rgba(255,255,255,0.12)', boxShadow: '0 6px 20px rgba(0,0,0,0.55)', flexShrink: 0 }}>
                    {logoUrl
                      ? <img src={logoUrl} alt={bn} className="w-full h-full object-cover" />
                      : <RestaurantPhoto type={tp} name={bn} />
                    }
                  </div>
                  <span style={{ fontSize: '10px', color: 'rgba(242,244,246,0.60)', textAlign: 'center', lineHeight: 1.3, maxWidth: '72px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{bn}</span>
                </button>
            ))}
          </div>
        </section>
      )}

      {/* ══ 7. BENEFITS — §7 metallic icon cards ══ */}
      {!isFiltering && (
        <section className="mb-8" id="home_benefits" style={{ position: 'relative', zIndex: 2 }}>
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#f2f4f6', letterSpacing: '-0.01em', marginBottom: '14px', textAlign: 'right' }}>{t('home.why')}</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { Icon: Bike,   title: 'توصيل سريع',    sub: 'في 30 دقيقة'      },
              { Icon: Shield, title: 'جودة مضمونة',   sub: 'أفضل المطاعم'      },
              { Icon: Tag,    title: 'أسعار مميزة',   sub: 'عروض حصرية دائماً' },
            ].map(({ Icon, title, sub }) => (
              <div key={title}
                className="glass-shine"
                style={{
                  borderRadius: '18px', padding: '16px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  background: 'linear-gradient(180deg, #24282c 0%, #15181b 100%)',
                  borderTop:    '1px solid rgba(255,255,255,0.14)',
                  borderLeft:   '1px solid rgba(255,255,255,0.07)',
                  borderRight:  '1px solid rgba(255,255,255,0.07)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}>
                {/* Metallic icon badge §7 */}
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'radial-gradient(ellipse at 35% 28%, #3d4144, #1b2024)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 4px 14px rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} strokeWidth={1.75} style={{ color: '#c8cacc', filter: 'drop-shadow(0 -1px 1px rgba(255,255,255,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.80))' }} />
                </div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#f2f4f6', textAlign: 'center', margin: 0, lineHeight: 1.2 }}>{title}</p>
                <p style={{ fontSize: '10px', color: 'rgba(170,176,182,0.65)', textAlign: 'center', margin: 0, lineHeight: 1.3 }}>{sub}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══ EXPERIENCE RUNTIME — audience/flag/experiment driven surface ══
          Decided by the ONE Experience Engine (Waves 1–18) via useExperience(); this screen only
          renders what the runtime already decided. Placed BELOW the marketplace rails on purpose:
          the home screen renders its rails from what is initially in view, so anything inserted
          above them changes what the product surfaces — the merchandising content stays first. */}
      {!isFiltering && (xpWelcome || xpOffers || xpTour) && (
        <section id="home_experience_surfaces" style={{ display: 'grid', gap: 10, margin: '4px 0 16px' }}>
          {xpWelcome && (() => {
            // Content resolves through the ONE shared source; an edit in the Experience
            // Studio changes this banner because both read resolveMergedContent.
            const c = resolveMergedContent('flag.customer_welcome'); if (!c) return null;
            const arm = xp.variantOf('exp.welcome_tone');
            return (
              <ExperienceBanner
                Icon={resolveExperienceIcon(c.icon)}
                title={contentTitle(c, lang === 'ar' ? 'ar' : 'en', arm)}
                body={contentBody(c, lang === 'ar' ? 'ar' : 'en')}
                variant={arm}
                decision={xp.context} experienceId="flag.customer_welcome" surface="customer"
                onDismiss={() => setXpDismissed(d => ({ ...d, welcome: true }))}
              />
            );
          })()}
          {xpOffers && (() => {
            const c = resolveMergedContent('flag.customer_offers'); if (!c) return null;
            return (
              <ExperienceBanner
                Icon={resolveExperienceIcon(c.icon)}
                title={contentTitle(c, lang === 'ar' ? 'ar' : 'en')}
                body={contentBody(c, lang === 'ar' ? 'ar' : 'en')}
                variant={xp.variantOf('exp.offer_emphasis')}
                decision={xp.context} experienceId="flag.customer_offers" surface="customer"
                signals={c.signals}
                onDismiss={() => setXpDismissed(d => ({ ...d, offers: true }))}
              />
            );
          })()}
          {xpTour && (() => {
            const c = resolveMergedContent('flag.customer_feature_tour'); if (!c) return null;
            return (
              <ExperienceHint
                text={contentTitle(c, lang === 'ar' ? 'ar' : 'en')}
                decision={xp.context} experienceId="flag.customer_feature_tour" surface="customer"
                onDismiss={() => setXpDismissed(d => ({ ...d, tour: true }))}
              />
            );
          })()}
        </section>
      )}

      <div style={{ height: '100px' }} />
    </div>
  );
};
