import { useEffect, useState } from 'react';
import { catalogRepository } from '../../repositories/catalog.repository';
import { Heart, ChevronLeft, Loader2, UtensilsCrossed, Plus, X, ShoppingCart } from 'lucide-react';
import { resolveCategory, getCategoryCover, getProductFallback, type CategoryKey } from '../../utils/categoryImages';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { useTranslation } from 'react-i18next';
import { cxService } from '../../services/cx.service';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  product_images?: { url: string }[];
  product_variants?: { id: string; name: string; price_modifier: number }[];
}

interface RestaurantScreenProps {
  branchId: string;
  restaurantName: string;
  customerId?: string;
  onBack: () => void;
  onAddToCart: (product: Product, selectedVariant: any | null) => void;
  cartItems: any[];
  onViewCart?: () => void;
}

// Cover + product fallbacks are now category-specific (see utils/categoryImages).
// A pharmacy shows pharmacy imagery, a flower shop shows flowers — never food.
const TABS = ['الوجبات', 'العروض', 'التقييمات', 'عن المطعم'];   // internal ids — see tabLabel() for display
/** Categories that serve meals; everything else sells products. */
const FOOD_SERVICE: CategoryKey[] = ['restaurant', 'coffee'];

// Self-contained demo menu (no backend) — the customer browse/order flow must work offline in sandbox.
// Each restaurant gets a DISTINCT menu (cuisine chosen deterministically by branch id) so browsing
// feels like a real catalogue rather than the same list everywhere.
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';
type MenuItem = { dish: string; desc: string; base: number; sizes?: [string, string] };

/**
 * Menus are keyed by the merchant's CATEGORY — resolved from its name, exactly the
 * way the imagery above already is. Selecting a menu by `hash(branchId)` alone let a
 * pharmacy serve pizza and a coffee shop sell rice. Categories with several variants
 * keep the per-branch variety, so two restaurants still differ.
 */
const MENUS_BY_CATEGORY: Partial<Record<CategoryKey, MenuItem[][]>> = {
  restaurant: [
    [ // مشاوي / grill
      { dish: 'مشاوي مشكّلة', desc: 'تشكيلة لحوم مشوية على الفحم مع أرز بخاري.', base: 78, sizes: ['فردي', 'عائلي'] },
      { dish: 'كبسة لحم', desc: 'أرز بسمتي مع لحم طري ومكسّرات.', base: 62 },
      { dish: 'مندي دجاج', desc: 'دجاج مدخّن على الطريقة اليمنية.', base: 48, sizes: ['ربع', 'نصف'] },
      { dish: 'شاورما لحم', desc: 'خبز صاج مع لحم وصلصة طحينة.', base: 28 },
      { dish: 'كباب مشوي', desc: 'كباب لحم متبّل مشوي.', base: 44 },
      { dish: 'سلطة فتوش', desc: 'خضار طازجة مع خبز محمّص.', base: 18 },
    ],
    [ // بيتزا / pizza & pasta
      { dish: 'بيتزا مارجريتا', desc: 'صلصة طماطم وجبنة موزاريلا.', base: 42, sizes: ['وسط', 'كبير'] },
      { dish: 'بيتزا بيبروني', desc: 'بيبروني مع جبن وفلفل.', base: 52, sizes: ['وسط', 'كبير'] },
      { dish: 'باستا ألفريدو', desc: 'باستا بصلصة كريمة الفطر.', base: 46 },
      { dish: 'لازانيا لحم', desc: 'طبقات باستا بلحم وجبن.', base: 54 },
      { dish: 'سلطة سيزر', desc: 'خس وصلصة سيزر مع دجاج.', base: 32 },
      { dish: 'خبز بالثوم', desc: 'خبز محمّص بزبدة الثوم.', base: 18 },
    ],
  ],
  coffee: [[
    { dish: 'قهوة سعودية', desc: 'قهوة عربية أصيلة بالهيل.', base: 14, sizes: ['صغير', 'كبير'] },
    { dish: 'لاتيه', desc: 'إسبريسو مع حليب مبخّر.', base: 19, sizes: ['وسط', 'كبير'] },
    { dish: 'شاي كرك', desc: 'شاي بالحليب والبهارات.', base: 12 },
    { dish: 'تشيز كيك', desc: 'تشيز كيك كريمي بصوص التوت.', base: 26 },
    { dish: 'كروسان زعتر', desc: 'كروسان طازج محشو بالزعتر.', base: 16 },
    { dish: 'موكا بارد', desc: 'قهوة مثلجة بالشوكولاتة.', base: 22 },
  ]],
  market: [[
    { dish: 'أرز بسمتي ٥كجم', desc: 'أرز فاخر طويل الحبة.', base: 65 },
    { dish: 'زيت زيتون ١لتر', desc: 'زيت زيتون بكر ممتاز.', base: 48 },
    { dish: 'حليب طازج ٢لتر', desc: 'حليب كامل الدسم.', base: 14 },
    { dish: 'بيض طازج ٣٠حبة', desc: 'بيض مزارع طازج.', base: 26 },
    { dish: 'معكرونة ٥٠٠غ', desc: 'معكرونة قمح صلب.', base: 9 },
    { dish: 'جبن شيدر ٤٠٠غ', desc: 'جبن شيدر مبشور.', base: 22 },
  ]],
  pharmacy: [[
    { dish: 'باراسيتامول ٥٠٠ملغ', desc: 'مسكّن وخافض للحرارة — ٢٠ قرص.', base: 12 },
    { dish: 'فيتامين سي ١٠٠٠', desc: 'أقراص فوّارة لدعم المناعة.', base: 38, sizes: ['٣٠ حبة', '٦٠ حبة'] },
    { dish: 'كمامات طبية ٥٠حبة', desc: 'كمامات ثلاث طبقات للاستعمال مرة واحدة.', base: 15 },
    { dish: 'معقّم يدين ٥٠٠مل', desc: 'جل كحولي معقّم بنسبة ٧٠٪.', base: 18 },
    { dish: 'جهاز قياس السكر', desc: 'جهاز منزلي مع ٢٥ شريط فحص.', base: 155 },
    { dish: 'مرهم للحروق', desc: 'كريم موضعي للحروق السطحية.', base: 24 },
  ]],
  sweets: [[
    { dish: 'كنافة نابلسية', desc: 'كنافة بالجبن مع قطر وفستق.', base: 32, sizes: ['وسط', 'كبير'] },
    { dish: 'بقلاوة مشكّلة ٥٠٠غ', desc: 'تشكيلة بقلاوة بالفستق والجوز.', base: 45 },
    { dish: 'تشيز كيك توت', desc: 'تشيز كيك كريمي بصوص التوت.', base: 28 },
    { dish: 'كيك شوكولاتة', desc: 'كيك بطبقات الشوكولاتة الغنية.', base: 38, sizes: ['٦ أشخاص', '١٢ شخص'] },
    { dish: 'معمول تمر ٥٠٠غ', desc: 'معمول محشو بعجوة التمر.', base: 30 },
    { dish: 'بسبوسة بالقشطة', desc: 'بسبوسة طرية محشوة بالقشطة.', base: 22 },
  ]],
  perfume: [[
    { dish: 'عود كمبودي ٣غ', desc: 'قطع عود طبيعي فاخر.', base: 180 },
    { dish: 'دهن العود', desc: 'دهن عود مركّز — ٣ مل.', base: 250 },
    { dish: 'بخور معطر ١٠٠غ', desc: 'بخور معمول بزيوت عطرية.', base: 65, sizes: ['١٠٠غ', '٢٥٠غ'] },
    { dish: 'عطر شرقي', desc: 'مزيج من العنبر والمسك والورد.', base: 145, sizes: ['٥٠ مل', '١٠٠ مل'] },
    { dish: 'مبخرة كهربائية', desc: 'مبخرة بتحكم في الحرارة.', base: 89 },
    { dish: 'معطر أجواء', desc: 'بخاخ معطر للمنزل والمجالس.', base: 35 },
  ]],
  flowers: [[
    { dish: 'بوكيه ورد جوري', desc: 'ورد جوري طازج مع تغليف فاخر.', base: 120, sizes: ['١٢ وردة', '٢٤ وردة'] },
    { dish: 'باقة توليب', desc: 'توليب ملوّن مستورد.', base: 95 },
    { dish: 'صندوق ورد فاخر', desc: 'صندوق مخملي منسّق بالورد.', base: 180 },
    { dish: 'ورد أبيض وشوكولاتة', desc: 'باقة ورد أبيض مع علبة شوكولاتة.', base: 145 },
    { dish: 'نبتة زينة داخلية', desc: 'نبتة طبيعية مع أصيص سيراميك.', base: 75 },
    { dish: 'بطاقة تهنئة', desc: 'بطاقة مكتوبة بخط اليد.', base: 15 },
  ]],
  electronics: [[
    { dish: 'سماعات لاسلكية', desc: 'سماعات بلوتوث مع عزل الضجيج.', base: 149, sizes: ['أبيض', 'أسود'] },
    { dish: 'شاحن سريع ٢٥واط', desc: 'شاحن جداري بمنفذ تايب-سي.', base: 65 },
    { dish: 'كفر جوال', desc: 'كفر واقٍ مقاوم للصدمات.', base: 35 },
    { dish: 'باور بانك ١٠٠٠٠', desc: 'بطارية متنقلة بشحن سريع.', base: 89 },
    { dish: 'كيبل تايب-سي', desc: 'كيبل مجدول بطول ٢ متر.', base: 25 },
    { dish: 'ساعة ذكية', desc: 'ساعة رياضية مع قياس النبض.', base: 320 },
  ]],
};

const sandboxMenu = (branchId: string, branchName: string) => {
  let h = 0; for (let i = 0; i < branchId.length; i++) h = (h * 31 + branchId.charCodeAt(i)) >>> 0;
  // Unmapped categories (e.g. gifts) fall back to neutral commerce — never food.
  const variants = MENUS_BY_CATEGORY[resolveCategory(branchName)] ?? MENUS_BY_CATEGORY.market!;
  const menu = variants[h % variants.length];
  const count = 5 + (h % 2); // 5–6 items
  return menu.slice(0, count).map((m, i) => ({
    id: `${branchId}-p${i + 1}`, name: m.dish, description: m.desc,
    price: m.base + ((h >> i) % 6), // small per-restaurant price variation
    product_images: [] as { url: string }[],
    product_variants: m.sizes ? [{ id: `${branchId}-v${i}a`, name: m.sizes[0], price_modifier: 0 }, { id: `${branchId}-v${i}b`, name: m.sizes[1], price_modifier: 8 + (i % 4) * 2 }] : [],
  }));
};

// Guard: HomeScreen renders mock fallback cards (ids "m1"–"m4", "f1"–"f6") when the
// catalog is empty/unreadable. Those non-UUID ids must never reach a uuid-typed
// branch_id query (Postgres 22P02). Real branch ids are always UUIDs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidBranchId = (id: string) => UUID_RE.test(id);

export const RestaurantScreen = ({
  branchId,
  restaurantName,
  customerId,
  onBack,
  onAddToCart,
  cartItems,
  onViewCart,
}: RestaurantScreenProps) => {
  const { country, price } = useAppConfig();
  const { t } = useTranslation();
  // "Meals" only reads correctly for places that serve them; every other store sells products.
  const tabLabel = (id: string) => id === 'الوجبات' ? t(FOOD_SERVICE.includes(branchCategory) ? 'restaurant.meals' : 'restaurant.products') : id === 'العروض' ? t('restaurant.offers') : id === 'التقييمات' ? t('restaurant.reviews') : t('restaurant.aboutStore');
  const cur = country.currency.symbolAr;
  const [products,        setProducts]        = useState<Product[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [activeTab,       setActiveTab]       = useState(TABS[0]);
  const [favorite,        setFavorite]        = useState(false);
  const [favProductIds,   setFavProductIds]   = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!customerId) return;
    cxService.favoriteBranches(customerId).then(({ data }) => setFavorite(data.some((f: any) => f.branch_id === branchId)));
    cxService.favoriteProductIds(customerId).then(ids => setFavProductIds(new Set(ids)));
  }, [branchId, customerId]);

  // Favorite merchant (DB-backed)
  const toggleFavorite = async () => {
    if (!customerId) return;
    const prev = favorite; setFavorite(!prev);
    const { active, error } = await cxService.toggleFavoriteBranch(customerId, branchId);
    if (error) setFavorite(prev); else setFavorite(active);
  };

  // Favorite product (DB-backed)
  const toggleFavProduct = async (productId: string) => {
    if (!customerId) return;
    const { active, error } = await cxService.toggleFavoriteProduct(customerId, productId);
    if (error) return;
    setFavProductIds(prev => { const n = new Set(prev); if (active) n.add(productId); else n.delete(productId); return n; });
  };

  useEffect(() => { fetchBranchMenu(); }, [branchId]);

  const fetchBranchMenu = async () => {
    try {
      setLoading(true);
      if (SANDBOX) { setProducts(sandboxMenu(branchId, restaurantName) as any); return; }
      if (!isValidBranchId(branchId)) {
        // Mock/placeholder branch (catalog empty) — skip the broken uuid query.
        console.warn('fetchBranchMenu: non-UUID branchId, skipping product fetch:', branchId);
        setProducts([]);
        return;
      }
      const { data, error } = await catalogRepository.listBranchMenu(branchId);
      if (error) console.error('fetchBranchMenu:', error);
      else setProducts(data || []);
    } catch (e) {
      console.error('fetchBranchMenu exception:', e);
    } finally {
      setLoading(false);
    }
  };

  const getQtyInCart = (prodId: string) =>
    cartItems.filter(i => i.product.id === prodId).reduce((s: number, i: any) => s + i.quantity, 0);

  const cartTotal = cartItems.reduce((s: number, i: any) => {
    const p = i.product.price + (i.variant ? i.variant.price_modifier : 0);
    return s + p * i.quantity;
  }, 0);

  const totalCartQty   = cartItems.reduce((s: number, i: any) => s + i.quantity, 0);
  const branchCategory = resolveCategory(restaurantName);
  const coverImage     = getCategoryCover(restaurantName);

  return (
    <div id="restaurant_screen" style={{ marginTop: '-24px' }}>

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{ height: '340px', marginLeft: '-16px', marginRight: '-16px' }}
        id="restaurant_hero"
      >
        <img src={coverImage} alt={restaurantName} className="w-full h-full object-cover" id="cover_img" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #111417 0%, rgba(17,20,23,0.4) 50%, transparent 100%)' }} />

        {/* Top actions */}
        <div className="absolute inset-x-4 top-4 flex justify-between items-center" id="hero_actions">
          <button
            onClick={toggleFavorite}
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}
            id="fav_btn"
          >
            <Heart
              size={20}
              fill={favorite ? '#fb7185' : 'none'}
              stroke={favorite ? '#fb7185' : 'white'}
              strokeWidth={2}
            />
          </button>

          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 h-9 rounded-full cursor-pointer hover:opacity-90 transition-all text-white"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
            id="back_btn"
          >
            <span>{t('nav.home')}</span>
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Info overlay — seamless gradient panel, no card border */}
        <div
          className="absolute"
          style={{ bottom: 0, left: 0, right: 0, padding: '20px 20px 24px' }}
          id="info_card"
        >
          {/* Restaurant name + open badge */}
          <div className="flex items-center justify-between mb-2">
            <span
              className="px-3 py-1 rounded-full font-bold"
              style={{ background: 'var(--color-primary-fixed)', color: '#0c2000', fontSize: '11px', letterSpacing: '0.01em', flexShrink: 0 }}
            >{t('restaurant.openNow')}</span>
            <h2
              className="font-bold text-white"
              style={{ fontSize: '20px', textTransform: 'none', letterSpacing: '-0.02em', lineHeight: 1.2 }}
            >{restaurantName}</h2>
          </div>

          {/* Rating row */}
          <div className="flex items-center justify-end gap-3 mb-3" style={{ fontSize: '13px' }}>
            {/* The store's real category — every merchant used to be labelled a restaurant. */}
            <span style={{ color: 'rgba(242,244,246,0.60)', textTransform: 'none', letterSpacing: 0 }}>{t('cats.' + branchCategory)}</span>
            {/* Real review count and rating are not computed yet — showing a fabricated
                "500+ · 4.8" on a real store is a false consumer-protection claim. Hidden
                until real ratings land (reviews already exist server-side via submit_review). */}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: t('restaurant.delivery'), value: `10 ${cur}` },
              { label: t('restaurant.deliveryTime'), value: '25-35 د' },
              { label: t('restaurant.minOrder'), value: `30 ${cur}` },
            ].map(stat => (
              <div key={stat.label}>
                <p className="font-bold text-white" style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}>{stat.value}</p>
                <p style={{ fontSize: '11px', color: 'rgba(242,244,246,0.50)', textTransform: 'none', letterSpacing: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          STICKY TABS
      ════════════════════════════════════════════ */}
      <div
        className="sticky z-40 glass-strong flex gap-2 overflow-x-auto py-4 no-scrollbar"
        style={{
          top: '0',
          marginLeft: '-16px',
          marginRight: '-16px',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
        id="category_tabs"
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-6 py-2 rounded-full transition-all cursor-pointer ${isActive ? 'neon-glow' : ''}`}
              style={{
                background: isActive ? 'var(--color-primary-fixed)' : 'transparent',
                color: isActive ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)',
                fontSize: '14px', fontWeight: isActive ? 700 : 500,
                textTransform: 'none', letterSpacing: '0.01em', border: 'none',
              }}
              id={`tab_${tab}`}
            >{tabLabel(tab)}</button>
          );
        })}
      </div>

      {/* ═══ OFFERS TAB ═══ */}
      {activeTab === 'العروض' && (<>
      <div className="flex items-center justify-between mb-4 mt-6">
        <span style={{ color: 'var(--color-primary-fixed)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'none' }}>{t('common.viewAll')}</span>
        <h3 className="text-headline-sm font-semibold" style={{ color: 'white', textTransform: 'none', letterSpacing: 0 }}>{t('restaurant.featuredOffers')}</h3>
      </div>
      <div
        className="glass glass-shine rounded-2xl overflow-hidden relative"
        style={{ height: '160px', marginBottom: '64px' }}
        id="promo_card"
      >
        <div className="absolute inset-0 flex">
          <div className="w-1/2 p-6 flex flex-col justify-center gap-1 z-10 text-right">
            <span className="text-display-md text-[var(--color-primary-fixed)] font-bold" style={{ letterSpacing: '-0.02em', lineHeight: 1, textTransform: 'none' }}>{t('restaurant.offerSampleTitle')}</span>
            <p style={{ fontSize: '16px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{t('restaurant.offerSampleSub')}</p>
            <button
              type="button"
              onClick={() => document.getElementById('menu_list')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-2 active:scale-90 transition-transform cursor-pointer"
              style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', width: 'max-content', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'none', border: 'none' }}
            >{t('restaurant.orderNow')}</button>
          </div>
          <div className="w-1/2 h-full overflow-hidden group">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBhVyd91MMkKTgxAL7aXvtJYD1TMam5n1s1_A7pvG_dABt_kH-0_f20hNC8FWP6jorGsd8FcAIFMzaIj1kx4uZ1hNnRDlTuO2CiOUDwjXUcDNR8FqDodXoGn3lWYDsxtdbCgkY_MYUed2CsPOJRvL7P9Gvvp3SJgyPQk0SAs0x7gH4KAfR0t_N-ICRJWj-4XgkK3KrVaynJjy3cntePVp1qTy6WgLLGks6ZL7tPzp7ee9tQY9Jbj7lVpN2WN8Fn7ImARwilRuD2fpS9"
              alt="" aria-hidden="true"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              style={{ filter: 'grayscale(0.2)' }}
            />
          </div>
        </div>
      </div>

      </>)}

      {/* ═══ MEALS TAB ═══ */}
      {activeTab === 'الوجبات' && (
      <div className="mt-6 space-y-3" id="menu_list" style={{ paddingBottom: '160px' }}>
        <h3 className="text-headline-sm font-semibold text-right" style={{ color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}>{t('restaurant.mostOrderedMeals')}</h3>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 size={28} className="text-[var(--color-primary-fixed)] animate-spin" />
            <span style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{t('restaurant.loadingMenu')}</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <UtensilsCrossed size={48} color="var(--color-on-surface-variant)" strokeWidth={1} style={{ opacity: 0.3 }} />
            <p style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>{t('restaurant.menuUnavailable')}</p>
          </div>
        ) : (
          /* PHASE B — compact responsive product grid (image / name / price / rating / add) */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((product, pIdx) => {
              const image = product.product_images?.[0]?.url || getProductFallback(product.name, branchCategory, pIdx);
              const qty   = getQtyInCart(product.id);
              return (
                <div
                  key={product.id}
                  onClick={() => { setSelectedProduct(product); setSelectedVariant(product.product_variants?.[0] ?? null); }}
                  className="glass glass-hover rounded-2xl overflow-hidden cursor-pointer group transition-all"
                  id={`product_${product.id}`}
                >
                  <div className="relative" style={{ height: '108px', background: '#060a0e' }} id={`product_img_${product.id}`}>
                    <img src={image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {/* Per-product ratings are not computed yet — no fabricated star pill. */}
                    {qty > 0 && (
                      <span className="absolute top-1.5 end-1.5 w-6 h-6 rounded-full flex items-center justify-center font-bold" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '11px' }} id={`qty_badge_${product.id}`}>{qty}</span>
                    )}
                    {customerId && (
                      <button onClick={(e) => { e.stopPropagation(); toggleFavProduct(product.id); }}
                        className="absolute bottom-1.5 end-1.5 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer" id={`fav_btn_${product.id}`}
                        style={{ background: 'rgba(8,12,16,0.72)', backdropFilter: 'blur(8px)' }} aria-label="favorite">
                        <Heart size={14} color={favProductIds.has(product.id) ? '#ff5a7a' : 'white'} fill={favProductIds.has(product.id) ? '#ff5a7a' : 'none'} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <div className="p-2.5 text-right">
                    <h4 className="font-bold truncate" style={{ fontSize: '13px', color: 'var(--color-on-surface)', letterSpacing: '-0.01em' }}>{product.name}</h4>
                    <div className="flex items-center justify-between mt-1.5">
                      <button className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', boxShadow: '0 0 10px rgba(163,249,91,0.3)' }} id={`add_btn_${product.id}`}>
                        <Plus size={15} strokeWidth={2.5} />
                      </button>
                      <span className="font-bold" style={{ fontSize: '14px', color: 'var(--color-primary-fixed)' }}>{price(product.price)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ═══ REVIEWS TAB ═══ */}
      {activeTab === 'التقييمات' && (
        <div className="mt-6 space-y-3" style={{ paddingBottom: '160px' }}>
          <h3 className="text-headline-sm font-semibold text-right" style={{ color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}>{t('restaurant.customerReviews')}</h3>
          <div className="glass rounded-2xl p-6 text-center" style={{ color: 'var(--color-on-surface-variant)' }}>
            <p style={{ fontSize: '14px' }}>{t('restaurant.noReviews')}</p>
          </div>
        </div>
      )}

      {/* ═══ ABOUT TAB ═══ */}
      {activeTab === 'عن المطعم' && (
        <div className="mt-6 space-y-3 text-right" style={{ paddingBottom: '160px' }}>
          <h3 className="text-headline-sm font-semibold" style={{ color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}>{t('restaurant.about')}</h3>
          <div className="glass rounded-2xl p-5 space-y-3">
            {[
              [t('restaurant.name'), restaurantName],
              [t('restaurant.category'), branchCategory || '—'],
              [t('restaurant.delivery'), '٢٥–٤٠ دقيقة'],
              [t('restaurant.minOrderFull'), price(20)],
              [t('restaurant.status'), t('restaurant.openNow')],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between" style={{ fontSize: '14px' }}>
                <span style={{ color: 'var(--color-on-surface)', fontWeight: 600 }}>{v as string}</span>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>{k as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          FLOATING CART PILL
      ════════════════════════════════════════════ */}
      {/* Sticky cart CTA — always visible, morphs by cart state */}
      <button
        onClick={totalCartQty > 0 ? onViewCart : undefined}
        className="fixed left-1/2 -translate-x-1/2 h-14 rounded-full flex items-center justify-between px-5 transition-all active:scale-[0.98] z-40"
        style={{
          bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))', width: '90%', maxWidth: '420px',
          cursor: totalCartQty > 0 ? 'pointer' : 'default',
          background: totalCartQty > 0 ? 'var(--color-primary-fixed)' : 'rgba(163,249,91,0.10)',
          color: totalCartQty > 0 ? 'var(--color-on-primary-fixed)' : 'rgba(163,249,91,0.55)',
          border: totalCartQty > 0 ? 'none' : '1px solid rgba(163,249,91,0.25)',
          boxShadow: totalCartQty > 0 ? '0 0 32px rgba(163,249,91,0.45)' : 'none',
        }}
        id="floating_cart_pill"
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center font-bold"
          style={{
            background: totalCartQty > 0 ? 'var(--color-on-primary-fixed)' : 'rgba(163,249,91,0.15)',
            color: totalCartQty > 0 ? 'var(--color-primary-fixed)' : 'rgba(163,249,91,0.60)',
            fontSize: '12px',
          }}
        >{totalCartQty}</span>
        <span className="font-bold" style={{ fontSize: '16px', textTransform: 'none', letterSpacing: 0 }}>
          {totalCartQty > 0 ? t('restaurant.viewCart') : t('restaurant.addToYourCart')}
        </span>
        <span className="font-bold" style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}>
          {totalCartQty > 0 ? price(cartTotal) : ''}
        </span>
      </button>

      {/* ════════════════════════════════════════════
          PRODUCT DETAIL MODAL
      ════════════════════════════════════════════ */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}
          id="product_modal_overlay"
        >
          <div
            className="w-full max-w-md animate-slide-up safe-sheet-action"
            style={{ background: 'rgba(17,20,23,0.92)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', borderRadius: '24px 24px 0 0', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none' }}
            id="product_modal"
          >
            <div className="h-56 relative overflow-hidden">
              <img
                src={selectedProduct.product_images?.[0]?.url || getProductFallback(selectedProduct.name, branchCategory)}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(29,32,35,1) 0%, transparent 60%)' }} />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 end-4 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: 'white' }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="p-6 text-right">
              <h3 className="text-headline-sm font-bold" style={{ color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}>{selectedProduct.name}</h3>
              <p className="mt-2" style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
                {selectedProduct.description || t('restaurant.premiumItem')}
              </p>

              {selectedProduct.product_variants && selectedProduct.product_variants.length > 0 && (
                <div className="mt-4">
                  <p className="font-bold mb-3" style={{ fontSize: '14px', color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}>{t('restaurant.chooseSize')}</p>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {selectedProduct.product_variants.map(v => (
                      <button
                        key={v.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedVariant(v); }}
                        className="px-4 py-2 rounded-full transition-all cursor-pointer"
                        style={{
                          background: selectedVariant?.id === v.id ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)',
                          color: selectedVariant?.id === v.id ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface)',
                          border: selectedVariant?.id === v.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                          fontSize: '13px', textTransform: 'none', letterSpacing: 0,
                        }}
                      >
                        {v.name} {v.price_modifier !== 0 && `(${v.price_modifier > 0 ? '+' : ''}${v.price_modifier} ${cur})`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => { onAddToCart(selectedProduct, selectedVariant); setSelectedProduct(null); }}
                  className="h-14 px-8 rounded-full font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95 neon-glow-btn"
                  style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)', fontSize: '16px', textTransform: 'none', letterSpacing: 0 }}
                  id="add_to_cart_confirm"
                >
                  <ShoppingCart size={20} strokeWidth={2} />
                  {t('restaurant.addToCart')}
                </button>
                <span className="font-bold text-[var(--color-primary-fixed)] neon-text-glow" style={{ fontSize: '22px', textTransform: 'none', letterSpacing: 0 }}>
                  {price(selectedProduct.price + (selectedVariant?.price_modifier ?? 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
