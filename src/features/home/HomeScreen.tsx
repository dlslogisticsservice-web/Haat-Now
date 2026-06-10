import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface BranchWithMerchant {
  id: string;
  name: string;
  merchant_id: string;
  zone_id: string;
  is_active: boolean;
  merchants: { business_name: string; logo_url?: string };
  zones: { name: string };
}

interface HomeScreenProps {
  onSelectRestaurant: (branchId: string, restaurantName: string) => void;
  customerId: string;
}

// Static Stitch service categories
const STITCH_SERVICES = [
  { id: 'restaurants', icon: 'restaurant',                   label: 'المطاعم',     sub: 'طعام فاخر',          patterns: ['جليلة', 'مايسترو', 'pizza', 'burger'] },
  { id: 'pharmacy',    icon: 'medical_services',             label: 'الصيدلية',    sub: 'خدمة صحية',          patterns: ['الدواء', 'صيدلية', 'pharmacy'] },
  { id: 'grocery',     icon: 'local_grocery_store',          label: 'البقالة',     sub: 'احتياجاتك اليومية', patterns: ['التميمي', 'بقالة', 'سوبر'] },
  { id: 'shipping',    icon: 'local_shipping',               label: 'الشحن',       sub: 'توصيل سريع',         patterns: [] },
  { id: 'gifts',       icon: 'featured_seasonal_and_gifts',  label: 'الهدايا',     sub: 'لكل مناسبة',         patterns: [] },
  { id: 'lifestyle',   icon: 'diamond',                      label: 'لايف ستايل',  sub: 'نمط حياة راقٍ',      patterns: [] },
] as const;

// Food photography from Stitch (Aida/Google AI images)
const IMG = {
  foodHero:  'https://lh3.googleusercontent.com/aida-public/AB6AXuBqhISBia3EhqtgcWHq5mdSZ6pg2_WF5pG8kl7MsDsY_z2X6yJwfhfsLhFHCPFiPQTDZbeZreWpkhj68Y4WYn_aAKurL3Dv02IUsi7zI4AihP01-iwVEhGxwMtmcjkhHgrT4zuSbSGQcTiFBroxSnr93odhoaFFDZ5CQZSHYiDsKPeyKOBYpgpRU2HWk93Ah9BRJ9E5aHHBXtHvF_rdzeDUTcPh8Qx2Xbf97CjH9CL7eT3ceC4ocXPyj1ZdO2KhqyQEqJOGkwVoZ1k4',
  grocery:   'https://lh3.googleusercontent.com/aida-public/AB6AXuCu6V9PQdA18NYGt7HvMIzRgI1OQWKviwJcGYgPuXbwMXJSdO335HANaIeGCeCKkguoVfXyNhgpIYW_khZqiMJhYckhzqeOcZBne46qyZROZ-z4gyN6Ezlwrd12Q24MncE2jsQViK1PrIgUbwjLtz0TB6tk4-HLWiOb_ZpthTitgbCCRoIPAb_Dq89k5mQ3hYOSNHOXAwhYxK4rGOPBVBIP9jTuPRctdq37ruXnNDOAz9KorqXp6q0ZviWBIO9XUjwXTwt9WBvwL1aq',
  coffee:    'https://lh3.googleusercontent.com/aida-public/AB6AXuA47itg_9tKYoRbiXmwjheGkhStNXuWUf5ioKUpupZ8Jfqaqkbr_dc9x6TOVQAyYGLsFHRZaXEiwStL-BtuJL1sQcTA6cKtSCPRrB47iSLA_t7RnZASBLli8hunMGh4Rnspc__6tPf4aXGVAogu7EMfxRK_0JsR1ctrZQygaxmREoUuklmXokzIAnprwMlV6Tb_LzWiQnujXC2H2oPZkKGs-XYm868nHzHa5BOef5QL2keHRdYJc67YVyfdjeOajYzSRgZbCdqphoF0',
  pizza:     'https://lh3.googleusercontent.com/aida-public/AB6AXuAn8ewo2cStsQ6anzYniJFDp-gGbMZHj42ZL2xyq50um_XQkpptI6kjX7z2yhHq6HqoyBGTOH38Y73h0JGL4nNiKAFT3EFBCW3zAd8sSNE6xNTjygmnT_PCfheL2CpCWMZXX0NrOylG0avQx2UlWzLfe816Or9weSYMaCvYMUkqSOniB9CPbVu5wKMiN-v7_aTCaBJQF12QeRp8auTxI8OO-QXEljopNwU4fLOFi9XyidoOpgbw24R3Co00c0HenHbLlQ2IdtO7d42J',
  pharmacy:  'https://lh3.googleusercontent.com/aida-public/AB6AXuCbEu3lgn2Uev4Fs8gEm1bdnrLBqI2K6YTdv9aZQwakFb2lreDKFchKj6gQ7VK4DIPAFQM9ICZP6fi4b3es4C7AKxA3Jvu8qY7w5eH-IrJ61bP0UscfryFmbaZZBK37IPVv50ASslseIMABttglch20CBpH7m6uJht6yZFyWDG7SM8mI3_UOLuQ6m28-mnPrLV6HEzZTQC0-wDGptc-uaI1TtzMlatnFwWT-hzaqgTNMld1OC9K-tXZxSl45jWSLZ6GCNCCrIcmKkOi',
} as const;

// Map branch name → Stitch shop image fallback
function shopImage(branch: BranchWithMerchant): string {
  const n = (branch.merchants?.business_name || branch.name).toLowerCase();
  if (n.includes('قهو') || n.includes('مليون') || n.includes('coffee')) return IMG.coffee;
  if (n.includes('بيتزا') || n.includes('pizza') || n.includes('مايسترو') || n.includes('جليلة')) return IMG.pizza;
  if (n.includes('صيدل') || n.includes('دواء') || n.includes('pharmacy')) return IMG.pharmacy;
  if (n.includes('تميمي') || n.includes('بقال') || n.includes('سوبر') || n.includes('market')) return IMG.grocery;
  return IMG.foodHero;
}

// Fixed ratings per branch for stable display
const RATINGS = ['4.9', '4.7', '4.8', '4.6', '4.9', '4.7'];
function branchRating(idx: number): string { return RATINGS[idx % RATINGS.length]; }

export const HomeScreen = ({ onSelectRestaurant, customerId }: HomeScreenProps) => {
  const [branches,        setBranches]        = useState<BranchWithMerchant[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [loading,         setLoading]         = useState(true);
  const [walletPoints,    setWalletPoints]    = useState<number>(2450);

  useEffect(() => { fetchBranches(); fetchWalletBalance(); }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('merchant_branches')
        .select('id,name,merchant_id,zone_id,is_active,merchants(business_name,logo_url),zones(name)');
      if (data) setBranches(data as unknown as BranchWithMerchant[]);
    } catch (e) {
      console.error('fetchBranches error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const { data } = await supabase.from('wallets').select('balance')
        .eq('owner_type', 'customer').eq('owner_id', customerId).maybeSingle();
      if (data && Number(data.balance) > 0) setWalletPoints(Math.round(Number(data.balance) * 10));
    } catch (_e) { /* silent — keep default 2,450 */ }
  };

  const filteredBranches = branches.filter((branch) => {
    const q = searchQuery.toLowerCase();
    const nameMatch =
      !q ||
      branch.merchants?.business_name?.toLowerCase().includes(q) ||
      branch.name?.toLowerCase().includes(q);
    if (!selectedService) return nameMatch;
    const svc = STITCH_SERVICES.find(s => s.id === selectedService);
    if (!svc || svc.patterns.length === 0) return false;
    const pMatch = svc.patterns.some(p =>
      branch.name.toLowerCase().includes(p.toLowerCase()) ||
      (branch.merchants?.business_name || '').toLowerCase().includes(p.toLowerCase())
    );
    return nameMatch && pMatch;
  });

  const pointsFormatted = walletPoints.toLocaleString('ar-SA');

  return (
    <div id="home_screen_portal" style={{ position: 'relative' }}>

      {/* ── Atmospheric corner orbs (Stitch pro_v2_1 spec) ── */}
      <div
        className="fixed rounded-full pointer-events-none animate-neon-pulse"
        style={{
          top: '-10%', right: '-10%',
          width: '400px', height: '400px',
          background: 'rgba(163,249,91,0.05)',
          filter: 'blur(120px)',
          zIndex: 0,
        }}
      />
      <div
        className="fixed rounded-full pointer-events-none animate-neon-pulse"
        style={{
          bottom: '10%', left: '-10%',
          width: '300px', height: '300px',
          background: 'rgba(163,249,91,0.05)',
          filter: 'blur(100px)',
          zIndex: 0,
        }}
      />

      {/* ════════════════════════════════════════════
          HERO — Platinum Exclusive Banner
      ════════════════════════════════════════════ */}
      <section className="mb-section-gap">
        <div
          className="platinum-gradient rounded-xl p-6 md:p-8 border border-white/10"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 80px rgba(163,249,91,0.07)' }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">

            {/* Text side */}
            <div className="w-full md:w-2/3 text-right z-10">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
                style={{ background: 'rgba(163,249,91,0.12)', border: '1px solid rgba(163,249,91,0.3)' }}
              >
                <span
                  className="material-symbols-outlined text-[var(--color-primary-fixed)]"
                  style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}
                >workspace_premium</span>
                <span
                  className="text-[var(--color-primary-fixed)] font-bold uppercase tracking-wider"
                  style={{ fontSize: '11px' }}
                >Platinum Exclusive</span>
              </div>

              <h1 className="text-headline-lg-mobile text-[var(--color-on-surface)] mb-2">
                ارتق بتجربتك مع{' '}
                <span className="text-[var(--color-primary-fixed)] neon-text-glow">HAAT NOW Platinum</span>
              </h1>

              <p className="text-body-md text-[var(--color-on-surface-variant)] max-w-sm">
                توصيل فاخر من أفضل المطاعم مع خصومات حصرية وأولوية في الخدمة الفاخرة.
              </p>

              <button
                className="mt-6 px-8 py-3 rounded-full text-label-md font-bold transition-all active:scale-95 hover:scale-105"
                style={{
                  background: 'var(--color-primary-fixed)',
                  color: 'var(--color-on-primary-fixed)',
                  textTransform: 'none',
                  letterSpacing: 0,
                  boxShadow: '0 0 20px rgba(163,249,91,0.35), 0 4px 16px rgba(0,0,0,0.5)',
                }}
              >
                اطلب الآن
              </button>
            </div>

            {/* Card visual */}
            <div className="relative flex justify-center md:justify-end">
              <div
                className="absolute w-48 h-48 rounded-full blur-3xl animate-neon-pulse"
                style={{ background: 'rgba(163,249,91,0.12)' }}
              />
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCYat7stVwKGvHnJ2NlX7_2wPhaldQPrhpBV_P6P98uR1SMMQZQC6H_26hlq7SeNbyI1inLMrqvpQO0eONiu8wD_ze-Qpc8tKLXbUHhdKKN5BlqM-yIMgFKARlNN7mTsQPG3giEM98NQQYxqWb_wX46JZMvgI_9POblSztNyD_JcMk7sPn-NYD_qfJiE8GmIegmPtb-FcH46KE5CYuPIxRnnXbcJh7OA2oKRczkLPUVT9hAhqsUuhtl86-1OPIsrkFn-nJmBLeCr7YF"
                alt="Haat Now Platinum Card"
                className="w-56 h-auto relative z-10 drop-shadow-2xl"
                style={{ transform: 'rotate(12deg)' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SEARCH BAR
      ════════════════════════════════════════════ */}
      <section className="mb-section-gap">
        <div className="relative group transition-all">
          <span
            className="absolute end-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[var(--color-on-surface-variant)] group-focus-within:text-[var(--color-primary-fixed)] transition-colors pointer-events-none z-10"
            style={{ fontSize: '20px' }}
          >search</span>
          <input
            type="text"
            placeholder="ماذا تريد أن تطلب اليوم؟"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="home_search_input"
            className="w-full rounded-xl py-4 pe-12 ps-12 text-body-md text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]/50 focus:outline-none transition-all shadow-sm"
            style={{
              background: 'var(--color-surface-container)',
              border: 'none',
              boxShadow: 'none',
            }}
            onFocus={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.transform = 'scale(1.01)';
            }}
            onBlur={(e) => {
              (e.currentTarget.parentElement as HTMLElement).style.transform = '';
            }}
          />
          <button
            className="absolute start-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <span className="material-symbols-outlined text-[var(--color-on-surface)]" style={{ fontSize: '16px' }}>tune</span>
          </button>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          الخدمات المميزة — Service Categories Grid
      ════════════════════════════════════════════ */}
      <section className="mb-section-gap">
        <div className="flex items-center justify-between mb-4">
          <a
            className="text-[var(--color-primary-fixed)] hover:underline cursor-pointer"
            style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
          >رؤية الكل</a>
          <h2
            className="text-headline-sm text-[var(--color-on-surface)]"
            style={{ textTransform: 'none', letterSpacing: 0 }}
          >الخدمات المميزة</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" id="services_grid">
          {STITCH_SERVICES.map((svc) => {
            const isActive = selectedService === svc.id;
            return (
              <button
                key={svc.id}
                onClick={() => setSelectedService(isActive ? null : svc.id)}
                className={`glass-card rounded-xl p-5 flex flex-col items-center text-center cursor-pointer group transition-all duration-200 ${isActive ? 'neon-glow-sm' : 'glass-hover'}`}
                style={isActive ? { borderColor: 'rgba(163,249,91,0.45)' } : {}}
                id={`svc_${svc.id}`}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ background: isActive ? 'rgba(163,249,91,0.18)' : 'rgba(163,249,91,0.08)' }}
                >
                  <span
                    className="material-symbols-outlined text-[var(--color-primary-fixed)] neon-text-glow"
                    style={{ fontSize: '28px', fontVariationSettings: "'FILL' 1" }}
                  >{svc.icon}</span>
                </div>
                <span
                  className="font-bold text-[var(--color-on-surface)]"
                  style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                >{svc.label}</span>
                <span
                  className="text-[var(--color-on-surface-variant)] mt-1"
                  style={{ fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}
                >{svc.sub}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          عروض مختارة لك — Featured Offers Bento
      ════════════════════════════════════════════ */}
      <section className="mb-section-gap">
        <h2
          className="text-headline-sm text-[var(--color-on-surface)] mb-4"
          style={{ textTransform: 'none', letterSpacing: 0 }}
        >عروض مختارة لك</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ gridAutoRows: '200px' }}>

          {/* Large food card — spans 2 cols × 2 rows on md+ */}
          <div
            className="glass-card rounded-xl overflow-hidden relative group cursor-pointer md:col-span-2 md:row-span-2"
            style={{ minHeight: '200px' }}
          >
            <img
              src={IMG.foodHero}
              alt="عرض المذاق العالمي"
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(17,20,23,0.92) 0%, rgba(17,20,23,0.3) 60%, transparent 100%)' }}
            />
            <div className="absolute bottom-0 p-6 w-full text-right">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold mb-2 inline-block"
                style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}
              >50% خصم</span>
              <h3
                className="text-headline-sm text-[var(--color-on-surface)]"
                style={{ textTransform: 'none', letterSpacing: 0 }}
              >المذاق العالمي</h3>
              <p
                className="text-body-md text-[var(--color-on-surface-variant)]"
                style={{ textTransform: 'none', letterSpacing: 0 }}
              >أفضل المطاعم العالمية في مكان واحد</p>
            </div>
          </div>

          {/* Grocery split card */}
          <div className="glass-card rounded-xl overflow-hidden relative group cursor-pointer md:col-span-2">
            <div className="flex h-full">
              <div className="w-1/2 p-6 flex flex-col justify-center text-right">
                <h3
                  className="font-bold text-[var(--color-on-surface)]"
                  style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                >سوبر ماركت هافت</h3>
                <p
                  className="text-[var(--color-on-surface-variant)] mt-1"
                  style={{ fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}
                >توصيل خلال 20 دقيقة</p>
                <button
                  className="mt-4 flex items-center justify-end gap-1 text-[var(--color-primary-fixed)]"
                  style={{ fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}
                >
                  اطلب الآن
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_left</span>
                </button>
              </div>
              <div className="w-1/2 relative overflow-hidden">
                <img
                  src={IMG.grocery}
                  alt="بقالة"
                  className="h-full w-full object-cover opacity-70"
                />
              </div>
            </div>
          </div>

          {/* Rewards card */}
          <div
            className="glass-card rounded-xl p-6 flex flex-col justify-between cursor-pointer"
            style={{ borderLeft: '4px solid var(--color-primary-fixed)' }}
          >
            <div>
              <span
                className="material-symbols-outlined text-[var(--color-primary-fixed)]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >stars</span>
              <h3
                className="font-bold text-[var(--color-on-surface)] mt-2"
                style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
              >نقاط المكافآت</h3>
            </div>
            <div className="text-right">
              <p className="text-display-md text-[var(--color-primary-fixed)] neon-text-glow">
                {pointsFormatted}
              </p>
              <p
                className="text-[var(--color-on-surface-variant)]"
                style={{ fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}
              >نقطة متاحة</p>
            </div>
          </div>

          {/* Order tracking card */}
          <div className="glass-card rounded-xl p-6 flex flex-col justify-between overflow-hidden relative cursor-pointer">
            <div className="z-10">
              <h3
                className="font-bold text-[var(--color-on-surface)]"
                style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
              >تتبع طلبك</h3>
              <p
                className="text-[var(--color-on-surface-variant)] mt-1"
                style={{ fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}
              >في الطريق إليك</p>
            </div>
            <div className="mt-4 z-10 flex items-center gap-2">
              <div
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--color-surface-variant)' }}
              >
                <div
                  className="h-full w-2/3 rounded-full"
                  style={{ background: 'var(--color-primary-fixed)', boxShadow: '0 0 8px rgba(163,249,91,0.5)' }}
                />
              </div>
            </div>
            <span
              className="absolute -bottom-4 -start-4 material-symbols-outlined text-white/5 rotate-12"
              style={{ fontSize: '64px' }}
            >schedule</span>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════
          متاجر قريبة منك — Nearby Shops (horizontal scroll)
      ════════════════════════════════════════════ */}
      <section className="mb-section-gap">
        <div className="flex items-center justify-between mb-4">
          <a
            className="text-[var(--color-primary-fixed)] hover:underline cursor-pointer"
            style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
          >المزيد</a>
          <h2
            className="text-headline-sm text-[var(--color-on-surface)]"
            style={{ textTransform: 'none', letterSpacing: 0 }}
          >متاجر قريبة منك</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <span
              className="material-symbols-outlined text-[var(--color-primary-fixed)] animate-spin-slow"
              style={{ fontSize: '32px' }}
            >refresh</span>
            <span className="text-body-md text-[var(--color-on-surface-variant)]">جاري تصفح المتاجر...</span>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span
              className="material-symbols-outlined text-[var(--color-on-surface-variant)]/30"
              style={{ fontSize: '48px' }}
            >storefront</span>
            <p className="text-body-md text-[var(--color-on-surface-variant)]">لا توجد متاجر تطابق بحثك</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar" id="shops_scroll">
            {filteredBranches.map((branch, idx) => (
              <div
                key={branch.id}
                onClick={() => onSelectRestaurant(branch.id, branch.merchants?.business_name || branch.name)}
                className="min-w-[280px] glass-card rounded-xl overflow-hidden cursor-pointer glass-hover flex-shrink-0 transition-all"
                id={`shop_card_${branch.id}`}
              >
                {/* Photo */}
                <div className="w-full h-40 relative overflow-hidden">
                  {branch.merchants?.logo_url ? (
                    <img
                      src={branch.merchants.logo_url}
                      alt={branch.merchants.business_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={shopImage(branch)}
                      alt={branch.merchants?.business_name || branch.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Info */}
                <div className="p-4 text-right">
                  <div className="flex justify-between items-start">
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[var(--color-primary-fixed)]"
                      style={{ background: 'rgba(163,249,91,0.1)', fontSize: '10px' }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '10px', fontVariationSettings: "'FILL' 1" }}
                      >star</span>
                      {branchRating(idx)}
                    </span>
                    <h3
                      className="font-bold text-[var(--color-on-surface)]"
                      style={{ fontSize: '14px', textTransform: 'none', letterSpacing: 0 }}
                    >
                      {branch.merchants?.business_name || branch.name}
                    </h3>
                  </div>
                  <p
                    className="text-[var(--color-on-surface-variant)] mt-1"
                    style={{ fontSize: '12px', textTransform: 'none', letterSpacing: 0 }}
                  >
                    {branch.zones?.name || 'الرياض'} • 15-30 دقيقة
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};
