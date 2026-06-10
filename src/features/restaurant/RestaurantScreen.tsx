import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

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
  onBack: () => void;
  onAddToCart: (product: Product, selectedVariant: any | null) => void;
  cartItems: any[];
  onViewCart?: () => void;
}

const COVER_IMAGES: Record<string, string> = {
  'جليلة':   'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=800',
  'مايسترو': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=800',
  'التميمي': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800',
  'الدواء':  'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&q=80&w=800',
};
const DEFAULT_COVER   = 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=800';
const DEFAULT_PRODUCT = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400';

function getCoverImage(name: string) {
  for (const [k, v] of Object.entries(COVER_IMAGES)) if (name.includes(k)) return v;
  return DEFAULT_COVER;
}

// Static category tabs — visual only
const TABS = ['الوجبات', 'العروض', 'التقييمات', 'عن المطعم'];

export const RestaurantScreen = ({
  branchId,
  restaurantName,
  onBack,
  onAddToCart,
  cartItems,
  onViewCart,
}: RestaurantScreenProps) => {
  const [products,        setProducts]        = useState<Product[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [activeTab,       setActiveTab]       = useState('الكل');
  const [favorite,        setFavorite]        = useState(false);

  useEffect(() => { fetchBranchMenu(); }, [branchId]);

  const fetchBranchMenu = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id,name,description,price,product_images(url),product_variants(id,name,price_modifier)')
        .eq('branch_id', branchId);
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

  const totalCartQty = cartItems.reduce((s: number, i: any) => s + i.quantity, 0);

  const coverImage = getCoverImage(restaurantName);

  return (
    <div id="restaurant_screen" style={{ marginTop: '-24px' }}>

      {/* ════════════════════════════════════════════
          HERO — full-bleed restaurant photo h-[340px]
      ════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{ height: '340px', marginLeft: '-16px', marginRight: '-16px' }}
        id="restaurant_hero"
      >
        <img
          src={coverImage}
          alt={restaurantName}
          className="w-full h-full object-cover"
          id="cover_img"
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, #111417 0%, rgba(17,20,23,0.4) 50%, transparent 100%)' }}
        />

        {/* Top actions row */}
        <div className="absolute inset-x-4 top-4 flex justify-between items-center" id="hero_actions">
          <button
            onClick={() => setFavorite(f => !f)}
            className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', color: favorite ? '#fb7185' : 'white' }}
            id="fav_btn"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '20px', fontVariationSettings: `'FILL' ${favorite ? 1 : 0}` }}
            >favorite</span>
          </button>

          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 h-9 rounded-full cursor-pointer hover:opacity-90 transition-all text-white"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
            id="back_btn"
          >
            <span>الرئيسية</span>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
          </button>
        </div>

        {/* Info glass card — overlaid at bottom */}
        <div
          className="absolute glass-panel rounded-xl"
          style={{
            bottom: '24px',
            left: '16px',
            right: '16px',
            padding: '24px',
          }}
          id="info_card"
        >
          {/* Open badge + name */}
          <div className="flex items-center justify-between mb-3">
            <span
              className="px-3 py-1 rounded-full text-[var(--color-primary-fixed)]"
              style={{
                background: 'rgba(163,249,91,0.2)',
                border: '1px solid rgba(163,249,91,0.3)',
                fontSize: '12px',
                textTransform: 'none',
                letterSpacing: 0,
              }}
            >مفتوح الآن</span>
            <h2
              className="text-headline-lg-mobile font-bold text-white"
              style={{ textTransform: 'none', letterSpacing: 0 }}
            >{restaurantName}</h2>
          </div>

          {/* Rating + meta */}
          <div className="flex items-center justify-end gap-3 mb-4" style={{ fontSize: '13px' }}>
            <span style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
              مطعم فاخر
            </span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>500+</span>
            <div className="flex items-center gap-1" style={{ color: 'var(--color-primary-fixed)' }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}
              >star</span>
              <span style={{ fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}>4.8</span>
            </div>
          </div>

          {/* Delivery stats — 3 cols */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'التوصيل', value: '10 ر.س' },
              { label: 'وقت التوصيل', value: '25-35 د' },
              { label: 'الحد الأدنى', value: '30 ر.س' },
            ].map(stat => (
              <div key={stat.label}>
                <p
                  className="font-bold text-white"
                  style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                >{stat.value}</p>
                <p
                  style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}
                >{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          STICKY CATEGORY TABS
      ════════════════════════════════════════════ */}
      <div
        className="sticky z-40 flex gap-2 overflow-x-auto py-4 no-scrollbar"
        style={{
          top: '100px',
          background: 'rgba(17,20,23,0.95)',
          backdropFilter: 'blur(12px)',
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
                fontSize: '14px',
                fontWeight: isActive ? 700 : 500,
                textTransform: 'none',
                letterSpacing: '0.01em',
                border: 'none',
              }}
              id={`tab_${tab}`}
            >{tab}</button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════
          PROMO CARD
      ════════════════════════════════════════════ */}
      {/* Section heading — matches Stitch "العروض المميزة" */}
      <div className="flex items-center justify-between mb-4 mt-6">
        <span style={{ color: 'var(--color-primary-fixed)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'none' }}>عرض الكل</span>
        <h3 className="text-headline-sm font-semibold" style={{ color: 'white', textTransform: 'none', letterSpacing: 0 }}>العروض المميزة</h3>
      </div>
      <div
        className="glass-panel rounded-xl overflow-hidden relative"
        style={{ height: '160px', marginBottom: '64px' }}
        id="promo_card"
      >
        <div className="absolute inset-0 flex">
          {/* Text side */}
          <div className="w-1/2 p-6 flex flex-col justify-center gap-1 z-10 text-right">
            <span
              className="text-display-md text-[var(--color-primary-fixed)] font-bold"
              style={{ letterSpacing: '-0.02em', lineHeight: 1, textTransform: 'none' }}
            >30% خصم</span>
            <p
              style={{ fontSize: '16px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}
            >على جميع وجبات كومبو العائلية</p>
            <button
              className="mt-2 active:scale-90 transition-transform cursor-pointer"
              style={{
                background: 'var(--color-primary-fixed)',
                color: 'var(--color-on-primary-fixed)',
                width: 'max-content',
                padding: '6px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'none',
                border: 'none',
              }}
            >اطلب الآن</button>
          </div>
          {/* Visual side — food photography */}
          <div className="w-1/2 h-full overflow-hidden group">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBhVyd91MMkKTgxAL7aXvtJYD1TMam5n1s1_A7pvG_dABt_kH-0_f20hNC8FWP6jorGsd8FcAIFMzaIj1kx4uZ1hNnRDlTuO2CiOUDwjXUcDNR8FqDodXoGn3lWYDsxtdbCgkY_MYUed2CsPOJRvL7P9Gvvp3SJgyPQk0SAs0x7gH4KAfR0t_N-ICRJWj-4XgkK3KrVaynJjy3cntePVp1qTy6WgLLGks6ZL7tPzp7ee9tQY9Jbj7lVpN2WN8Fn7ImARwilRuD2fpS9"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              style={{ filter: 'grayscale(0.2)' }}
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MENU ITEMS
      ════════════════════════════════════════════ */}
      <div className="mt-6 space-y-3" id="menu_list">
        <h3
          className="text-headline-sm font-semibold text-right"
          style={{ color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}
        >الوجبات الأكثر طلباً</h3>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <span
              className="material-symbols-outlined text-[var(--color-primary-fixed)] animate-spin-slow"
              style={{ fontSize: '28px' }}
            >refresh</span>
            <span style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>جاري جلب القائمة...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '48px', color: 'var(--color-on-surface-variant)', opacity: 0.3 }}
            >restaurant_menu</span>
            <p style={{ color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}>
              قائمة هذا الفرع غير متوفرة حالياً
            </p>
          </div>
        ) : (
          products.map(product => {
            const image = product.product_images?.[0]?.url || DEFAULT_PRODUCT;
            const qty   = getQtyInCart(product.id);

            return (
              <div
                key={product.id}
                onClick={() => { setSelectedProduct(product); setSelectedVariant(product.product_variants?.[0] ?? null); }}
                className="glass-panel glass-hover flex gap-4 p-4 rounded-xl cursor-pointer group transition-all"
                id={`product_${product.id}`}
              >
                {/* Text info — RTL: text on right */}
                <div className="flex-1 min-w-0 text-right">
                  <h4
                    className="font-bold"
                    style={{ fontSize: '15px', color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}
                  >{product.name}</h4>
                  <p
                    className="mt-1 line-clamp-2"
                    style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}
                  >{product.description || 'صنف عالي الجودة يحضر فورياً عند طلبكم.'}</p>
                  <div className="flex items-center justify-end gap-3 mt-3">
                    <button
                      className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all group-hover:bg-[var(--color-primary-fixed)] group-hover:text-[var(--color-on-primary-fixed)]"
                      style={{
                        background: 'var(--color-surface-container-highest)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--color-primary-fixed)',
                      }}
                      id={`add_btn_${product.id}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                    </button>
                    <span
                      className="font-bold"
                      style={{ fontSize: '16px', color: 'var(--color-primary-fixed)', textTransform: 'none', letterSpacing: 0 }}
                    >{product.price.toFixed(2)} ر.س</span>
                  </div>
                </div>

                {/* Product image — 96×96 on left in RTL */}
                <div
                  className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 relative"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  id={`product_img_${product.id}`}
                >
                  <img
                    src={image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {qty > 0 && (
                    <span
                      className="absolute top-1 start-1 w-6 h-6 rounded-full flex items-center justify-center font-bold"
                      style={{
                        background: 'var(--color-primary-fixed)',
                        color: 'var(--color-on-primary-fixed)',
                        fontSize: '11px',
                      }}
                      id={`qty_badge_${product.id}`}
                    >{qty}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ════════════════════════════════════════════
          FLOATING CART PILL
      ════════════════════════════════════════════ */}
      {totalCartQty > 0 && (
        <button
          onClick={onViewCart}
          className="fixed left-1/2 -translate-x-1/2 h-14 rounded-full flex items-center justify-between px-5 cursor-pointer transition-all active:scale-[0.98] z-40"
          style={{
            bottom: '96px',
            width: '90%',
            maxWidth: '420px',
            background: 'var(--color-primary-fixed)',
            color: 'var(--color-on-primary-fixed)',
            boxShadow: '0 0 30px rgba(163,249,91,0.4)',
          }}
          id="floating_cart_pill"
        >
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center font-bold"
            style={{ background: 'var(--color-on-primary-fixed)', color: 'var(--color-primary-fixed)', fontSize: '12px' }}
          >{totalCartQty}</span>
          <span
            className="font-bold"
            style={{ fontSize: '16px', textTransform: 'none', letterSpacing: 0 }}
          >عرض السلة</span>
          <span
            className="font-bold"
            style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
          >{cartTotal.toFixed(2)} ر.س</span>
        </button>
      )}

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
            className="w-full max-w-md animate-slide-up"
            style={{
              background: 'var(--color-surface-container)',
              borderRadius: '24px 24px 0 0',
              overflow: 'hidden',
            }}
            id="product_modal"
          >
            {/* Product image */}
            <div className="h-56 relative overflow-hidden">
              <img
                src={selectedProduct.product_images?.[0]?.url || DEFAULT_PRODUCT}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(29,32,35,1) 0%, transparent 60%)' }}
              />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 end-4 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: 'white' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>

            {/* Product info */}
            <div className="p-6 text-right">
              <h3
                className="text-headline-sm font-bold"
                style={{ color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}
              >{selectedProduct.name}</h3>
              <p
                className="mt-2"
                style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', textTransform: 'none', letterSpacing: 0 }}
              >{selectedProduct.description || 'صنف عالي الجودة يحضر فورياً عند طلبكم.'}</p>

              {/* Variants */}
              {selectedProduct.product_variants && selectedProduct.product_variants.length > 0 && (
                <div className="mt-4">
                  <p
                    className="font-bold mb-3"
                    style={{ fontSize: '14px', color: 'var(--color-on-surface)', textTransform: 'none', letterSpacing: 0 }}
                  >اختر الحجم:</p>
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
                          fontSize: '13px',
                          textTransform: 'none',
                          letterSpacing: 0,
                        }}
                      >
                        {v.name} {v.price_modifier !== 0 && `(${v.price_modifier > 0 ? '+' : ''}${v.price_modifier} ر.س)`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price + Add to cart */}
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => { onAddToCart(selectedProduct, selectedVariant); setSelectedProduct(null); }}
                  className="h-14 px-8 rounded-full font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95 neon-glow-btn"
                  style={{
                    background: 'var(--color-primary-fixed)',
                    color: 'var(--color-on-primary-fixed)',
                    fontSize: '16px',
                    textTransform: 'none',
                    letterSpacing: 0,
                  }}
                  id="add_to_cart_confirm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add_shopping_cart</span>
                  إضافة للسلة
                </button>
                <span
                  className="font-bold text-[var(--color-primary-fixed)] neon-text-glow"
                  style={{ fontSize: '22px', textTransform: 'none', letterSpacing: 0 }}
                >
                  {(selectedProduct.price + (selectedVariant?.price_modifier ?? 0)).toFixed(2)} ر.س
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
