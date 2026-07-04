import { useEffect, useState, useMemo } from 'react';
import { useHomeFeed } from '../../hooks/useHomeFeed';
import type { BranchWithMerchant, DBOffer } from '../../services/home.service';
import {
  Star, Clock, SearchX, Search, X, Zap, Bike, Shield, Tag,
  UtensilsCrossed, ShoppingCart, Pill, Coffee, CakeSlice, Gift, Flower2, Smartphone,
  ChevronLeft, LayoutGrid, LayoutList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CATEGORY_IMAGES, getCategoryCover, type CategoryKey } from '../../utils/categoryImages';
import { MarketplaceHero } from './MarketplaceHero';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { campaignService, Campaign } from '../../services/campaign.service';
import { useTranslation } from 'react-i18next';

// Map a marketplace category key to the on-screen category filter id.
const CAT_KEY_TO_ID: Record<CategoryKey, string> = {
  restaurant: 'cat-food', market: 'cat-market', pharmacy: 'cat-pharmacy', coffee: 'cat-coffee',
  sweets: 'cat-sweets', gifts: 'cat-perfume', perfume: 'cat-perfume', flowers: 'cat-flowers', electronics: 'cat-electronics',
};

/* ─── Types (BranchWithMerchant + DBOffer now owned by home.service) ─────────── */
interface Category { id: string; name: string; cat: CategoryKey; Icon: LucideIcon; tintFrom: string; tintTo: string; patterns: string[]; }

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

/* ─── Offer Banners ─────────────────────────────────────────── */
const STATIC_BANNERS = [
  { id: 'ob1', qualifier: 'عرض حصري',     title: 'خصم 50%',      subtitle: 'على البيتزا الطازجة',   bg: 'linear-gradient(135deg,#0d2a08 0%,#061403 100%)', accent: 'rgba(163,249,91,0.40)' },
  { id: 'ob2', qualifier: 'مجاني تماماً', title: 'توصيل مجاني',  subtitle: 'على أول 3 طلبات',        bg: 'linear-gradient(135deg,#0c1a2e 0%,#060e1c 100%)', accent: 'rgba(100,170,255,0.30)' },
  { id: 'ob3', qualifier: 'كومبو العائلة', title: 'خصم 30%',     subtitle: 'على طلبات الأسرة',      bg: 'linear-gradient(135deg,#2a1008 0%,#140500 100%)', accent: 'rgba(255,140,60,0.35)' },
];

/* ─── Mock Restaurants (always-visible fallback) ────────────── */
const MOCK_RESTAURANTS = [
  { id: 'm1', name: 'مطعم الباشا',    cuisine: 'مشاوي • كباب فاخر',           eta: '25-35', delivery: 'مجاني',   rating: '4.9', min: '50',  type: 'grills',  badge: 'مميز',            badgeLime: true  },
  { id: 'm2', name: 'بيتزا رومانو',   cuisine: 'إيطالي • بيتزا نابوليتانا',  eta: '30-45', delivery: '10', rating: '4.8', min: '40',  type: 'pizza',   badge: 'الأكثر طلباً',   badgeLime: false },
  { id: 'm3', name: 'كافيه لاتيه',    cuisine: 'كافيه • مشروبات فاخرة',      eta: '20-30', delivery: 'مجاني',   rating: '4.7', min: '30',  type: 'coffee',  badge: 'اختيار الذواقة', badgeLime: false },
  { id: 'm4', name: 'سوبر فريش',      cuisine: 'سوبر ماركت • مستلزمات يومية', eta: '45-60', delivery: '15', rating: '4.6', min: '80',  type: 'market',  badge: 'مميز',            badgeLime: true  },
];

const MOCK_FEATURED = [
  { id: 'f1', name: 'مطعم الباشا',   type: 'grills'  },
  { id: 'f2', name: 'بيتزا رومانو',  type: 'pizza'   },
  { id: 'f3', name: 'كافيه لاتيه',   type: 'coffee'  },
  { id: 'f4', name: 'سوبر فريش',     type: 'market'  },
  { id: 'f5', name: 'صيدلية الشفاء', type: 'pharmacy'},
  { id: 'f6', name: 'حلويات أصيل',   type: 'sweets'  },
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
}

/* ─── Main Component ─────────────────────────────────────────── */
export const HomeScreen = ({ onSelectRestaurant }: HomeScreenProps) => {
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
  const [selectedCat,    setSelectedCat]    = useState<string | null>(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [viewMode,       setViewMode]       = useState<'large' | 'compact'>(() => (typeof localStorage !== 'undefined' && localStorage.getItem('haat_view_mode') === 'large') ? 'large' : 'compact');
  const toggleViewMode = () => setViewMode(m => { const next = m === 'large' ? 'compact' : 'large'; try { localStorage.setItem('haat_view_mode', next); } catch { /* ignore */ } return next; });
  const [activeOfferIdx, setActiveOfferIdx] = useState(0);

  const filteredBranches = useMemo(() => {
    return branches.filter(branch => {
      const q  = searchQuery.toLowerCase().trim();
      const bn = (branch.merchants?.business_name || branch.name).toLowerCase();
      const nameMatch = !q || bn.includes(q) || branch.name.toLowerCase().includes(q);
      if (!selectedCat) return nameMatch;
      const cat = CATEGORIES.find(c => c.id === selectedCat);
      if (!cat) return nameMatch;
      return nameMatch && cat.patterns.some(p =>
        branch.name.toLowerCase().includes(p.toLowerCase()) ||
        (branch.merchants?.business_name || '').toLowerCase().includes(p.toLowerCase()),
      );
    });
  }, [branches, searchQuery, selectedCat]);

  const isFiltering = !!searchQuery.trim() || !!selectedCat;

  const offerBanners = offers.length > 0
    ? offers.slice(0, 3).map((o, i) => ({
        id:        o.id,
        qualifier: 'خصم',
        title:     o.discount_percent ? `خصم ${o.discount_percent}%` : o.title,
        subtitle:  o.title,
        bg:        STATIC_BANNERS[i % 3].bg,
        accent:    STATIC_BANNERS[i % 3].accent,
      }))
    : STATIC_BANNERS;

  /* Always show content — use mock data when real data empty */
  const displayBranches = filteredBranches.length > 0 ? filteredBranches : (isFiltering ? [] : null);
  const showMock = !isFiltering && filteredBranches.length === 0;

  const DELIVERY_FEES = ['مجاني', `15 ${cur}`, 'مجاني', `10 ${cur}`, `8 ${cur}`, 'مجاني'];
  const ETAS          = ['25-35', '45-30', '35-50', '20-30', '30-45', '25-40'];
  const RATINGS       = ['4.9', '4.7', '4.8', '4.6', '4.9', '4.7'];
  const MIN_ORDERS    = ['50', '80', '60', '40', '70', '50'];

  return (
    <div id="home_screen_portal" dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ position: 'relative' }}>

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
          ) : (
            <>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.20)', flexShrink: 0 }} />
              <button style={{ background: 'none', border: 'none', color: 'var(--color-primary-fixed)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '0 2px', flexShrink: 0, whiteSpace: 'nowrap' }}>{t('home.filters')}</button>
            </>
          )}
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
                onClick={() => setSelectedCat(isActive ? null : cat.id)}
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
      {!isFiltering && (
        <section className="mb-3" id="home_offers" style={{ position: 'relative', zIndex: 2 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
            <button type="button" style={{ color: 'var(--color-primary-fixed)', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{t('common.viewAll')}</button>
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
                  <button type="button" className="animate-pulse-glow" style={{ alignSelf: 'flex-start', marginTop: '5px', height: '36px', padding: '0 18px', borderRadius: '18px', background: 'var(--color-primary-fixed)', border: 'none', color: '#0c2000', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 0 18px rgba(163,249,91,0.50), 0 3px 10px rgba(0,0,0,0.40)' }}>
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
      <section className="mb-4" id="home_restaurants" style={{ position: 'relative', zIndex: 2 }}>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={toggleViewMode} id="view_mode_toggle" aria-label={t('home.toggleView')}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-primary-fixed)' }}>
            {viewMode === 'large' ? <LayoutGrid size={16} strokeWidth={2} /> : <LayoutList size={16} strokeWidth={2} />}
          </button>
          {!isFiltering && <button type="button" style={{ color: 'var(--color-primary-fixed)', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '2px', marginInlineStart: 'auto', marginInlineEnd: '8px' }}>
            {t('common.more')} <ChevronLeft size={14} strokeWidth={2.5} />
          </button>}
          <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#f2f4f6', letterSpacing: '-0.01em' }}>
            {isFiltering ? t('home.searchResults') : t('home.nearest')}
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl skeleton" style={{ height: '240px' }} />)}</div>
        ) : isFiltering && filteredBranches.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center glass rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <SearchX size={28} color="rgba(170,176,182,0.50)" strokeWidth={1.5} />
            <p style={{ color: '#f2f4f6', fontSize: '15px', fontWeight: 600 }}>{`${t('home.noResults')} "${searchQuery}"`}</p>
            <button onClick={() => { setSearchQuery(''); setSelectedCat(null); }} style={{ padding: '8px 20px', borderRadius: '999px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(170,176,182,0.80)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>{t('home.showAllStores')}</button>
          </div>
        ) : (
          <div className={viewMode === 'compact' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3' : 'space-y-3'} id="restaurants_list">
            {(showMock ? MOCK_RESTAURANTS : (isFiltering ? filteredBranches : filteredBranches.slice(0, 4))).map((item, idx) => {
              const isMock   = 'type' in item;
              const r        = isMock ? item as typeof MOCK_RESTAURANTS[0] : null;
              const branch   = isMock ? null : item as BranchWithMerchant;
              const name     = isMock ? r!.name : (branch!.merchants?.business_name || branch!.name);
              const cuisine  = isMock ? r!.cuisine : getCuisine(name);
              const eta      = isMock ? r!.eta      : ETAS[idx % 6];
              const delivery = isMock ? r!.delivery : DELIVERY_FEES[idx % 6];
              const rating   = isMock ? r!.rating   : RATINGS[idx % 6];
              const minOrd   = isMock ? r!.min      : MIN_ORDERS[idx % 6];
              const badgeLime = isMock ? r!.badgeLime : (idx % 3 === 0);
              const badge    = isMock ? r!.badge    : ['مميز','اختيار الذواقة','الأكثر طلباً'][idx % 3];
              const typeKey  = isMock ? r!.type     : undefined;
              const id       = isMock ? r!.id       : branch!.id;
              const logoUrl  = !isMock ? branch!.merchants?.logo_url : null;
              if (viewMode === 'compact') return (
                <div key={id} onClick={() => onSelectRestaurant(id, name)}
                  className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                  id={isMock ? undefined : `branch_${id}`}
                  style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg,#1c2026,#13171a)' }}>
                  <div className="relative" style={{ height: '92px', background: '#060a0e' }}>
                    {logoUrl ? <img src={logoUrl} alt={name} className="w-full h-full object-cover" /> : <RestaurantPhoto type={typeKey} name={name} />}
                    <div className="absolute top-2 start-2 flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(8,12,16,0.72)', backdropFilter: 'blur(12px)' }}>
                      <Star size={10} color="#f0c840" fill="#f0c840" strokeWidth={0} /><span style={{ fontSize: '10px', color: 'white', fontWeight: 800 }}>{rating}</span>
                    </div>
                  </div>
                  <div className="px-2.5 py-2">
                    <h3 className="truncate" style={{ color: '#f2f4f6', fontSize: '13px', fontWeight: 700, textAlign: 'right', margin: 0 }}>{name}</h3>
                    <p className="truncate" style={{ color: 'rgba(160,165,170,0.65)', fontSize: '10px', textAlign: 'right' }}>{cuisine}</p>
                    <div className="flex items-center justify-between mt-1" style={{ fontSize: '10px', color: 'rgba(170,176,182,0.8)' }}>
                      <span>{minOrd}</span><span>{eta}</span>
                    </div>
                  </div>
                </div>
              );
              return (
                <div key={id} onClick={() => onSelectRestaurant(id, name)}
                  className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-transform" id={isMock ? undefined : `branch_${id}`}
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
                    {/* Badge — top end (RTL = top left visually) */}
                    <div className="absolute top-3 end-3 px-2.5 py-1 rounded-full" style={{ background: badgeLime ? 'var(--color-primary-fixed)' : 'rgba(10,14,18,0.72)', border: badgeLime ? 'none' : '1px solid rgba(255,255,255,0.18)', color: badgeLime ? '#0a1c00' : 'rgba(255,255,255,0.88)', fontSize: '11px', fontWeight: 700, backdropFilter: 'blur(12px)', boxShadow: badgeLime ? '0 0 14px rgba(163,249,91,0.55)' : '0 2px 8px rgba(0,0,0,0.50)' }}>
                      {badge}
                    </div>
                    {/* Rating pill — top start */}
                    <div className="absolute top-3 start-3 flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: 'rgba(8,12,16,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 2px 8px rgba(0,0,0,0.50)' }}>
                      <Star size={11} color="#f0c840" fill="#f0c840" strokeWidth={0} />
                      <span style={{ fontSize: '11px', color: 'white', fontWeight: 800 }}>{rating}</span>
                    </div>
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
                    <div className="flex items-center justify-end gap-4">
                      <span className="flex items-center gap-1">
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)' }}>{t('home.minLabel')} {minOrd} {cur}</span>
                      </span>
                      <span className="flex items-center gap-1.5"><Bike size={12} color="rgba(163,249,91,0.55)" strokeWidth={2} /><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)' }}>{delivery}</span></span>
                      <span className="flex items-center gap-1.5"><Clock size={12} color="rgba(255,255,255,0.35)" strokeWidth={2} /><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)' }}>{eta} {t('common.minutesShort')}</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ══ 6. FEATURED STORES — horizontal circles ══ */}
      {!isFiltering && (
        <section className="mb-4" id="home_featured_circles" style={{ position: 'relative', zIndex: 2 }}>
          <div className="flex items-center justify-between mb-3">
            <button type="button" style={{ color: 'var(--color-primary-fixed)', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '2px' }}>
              {t('common.viewAll')} <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#f2f4f6', letterSpacing: '-0.01em' }}>{t('home.featured')}</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {(branches.length > 0 ? branches : MOCK_FEATURED).slice(0, 6).map(item => {
              const bn   = 'merchants' in item ? (item as BranchWithMerchant).merchants?.business_name || item.name : item.name;
              const tp   = 'type' in item ? (item as typeof MOCK_FEATURED[0]).type : undefined;
              const id   = item.id;
              return (
                <button key={`circle_${id}`}
                  onClick={() => onSelectRestaurant(id, bn)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 active:scale-[0.95] transition-transform cursor-pointer"
                  style={{ background: 'none', border: 'none', width: '72px', padding: 0 }}>
                  <div style={{ width: '66px', height: '66px', borderRadius: '50%', overflow: 'hidden', background: '#0c1014', border: '2px solid rgba(255,255,255,0.12)', boxShadow: '0 6px 20px rgba(0,0,0,0.55)', flexShrink: 0 }}>
                    {'merchants' in item && (item as BranchWithMerchant).merchants?.logo_url
                      ? <img src={(item as BranchWithMerchant).merchants.logo_url!} alt={bn} className="w-full h-full object-cover" />
                      : <RestaurantPhoto type={tp} name={bn} />
                    }
                  </div>
                  <span style={{ fontSize: '10px', color: 'rgba(242,244,246,0.60)', textAlign: 'center', lineHeight: 1.3, maxWidth: '72px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{bn}</span>
                </button>
              );
            })}
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

      <div style={{ height: '100px' }} />
    </div>
  );
};
