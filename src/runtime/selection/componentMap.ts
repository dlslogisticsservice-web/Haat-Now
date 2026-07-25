// ─────────────────────────────────────────────────────────────────────────────
// Runtime Component Map (Phase 8B · Runtime Component Mapping).
//
// Declared metadata that turns a selected DOM region into a REAL Studio component — a
// business identity (Hero Banner, Category Grid, Restaurant Card…), not a DOM tag.
//
// Each entry pairs a StudioComponentMetadata declaration with a `match` CSS selector that
// identifies the component's root in the live app. The selectors target ids/classes the
// real screens ALREADY render (e.g. #home_offers, .category-card, [id^="branch_"]) — so
// nothing in the app is edited or instrumented for the Studio; the map simply declares
// "this stable anchor IS this component". Resolution (walking the DOM, matching) lives in
// the Studio overlay; this module is pure data + lookups (no DOM, no React).
//
// Website reuses the Website Studio's own block model (block.type → label) and is not
// duplicated here.
// ─────────────────────────────────────────────────────────────────────────────
import type { StudioComponentMetadata } from '../StudioMetadata';

export interface MappedComponent {
  /** CSS selector matching the component root in the live DOM (an existing app anchor). */
  match: string;
  metadata: StudioComponentMetadata;
}

const t = (ar: string, en: string) => ({ ar, en });

// Customer · Home — the flagship screen, richly mapped.
const CUSTOMER_HOME: MappedComponent[] = [
  { match: '#home_screen_portal', metadata: { id: 'customer.home.root', type: 'screen', displayName: t('شاشة الرئيسية', 'Home Screen'), editableProps: [], bindings: [], events: [], themeTokens: [], animations: [] } },
  { match: '#home_campaign_hero, #campaign_hero_banner', metadata: { id: 'customer.home.hero', type: 'banner', cmsSection: 'hero', displayName: t('بانر الهيرو', 'Hero Banner'),
    editableProps: [
      { key: 'title', label: t('العنوان', 'Title'), type: 'text', binding: { source: 'content', path: 'hero.title' } },
      { key: 'subtitle', label: t('العنوان الفرعي', 'Subtitle'), type: 'text', binding: { source: 'content', path: 'hero.subtitle' } },
      { key: 'image', label: t('الصورة', 'Image'), type: 'image', binding: { source: 'content', path: 'hero.image_url' } },
      { key: 'cta', label: t('زر الإجراء', 'CTA label'), type: 'text', binding: { source: 'content', path: 'hero.cta_label' } },
    ],
    bindings: [{ source: 'data', path: 'campaign.hero', readonly: true }], events: [{ name: 'cta.click', label: t('نقر الزر', 'CTA click') }], themeTokens: ['--color-primary-fixed'], animations: ['fade'] } },
  { match: '#home_search', metadata: { id: 'customer.home.search', type: 'search', displayName: t('شريط البحث', 'Search Bar'),
    editableProps: [{ key: 'placeholder', label: t('النص التلميحي', 'Placeholder'), type: 'text', binding: { source: 'i18n', path: 'home.searchPlaceholder' } }],
    bindings: [], events: [{ name: 'search.submit', label: t('بحث', 'Search') }], themeTokens: [], animations: [] } },
  { match: '#home_categories', metadata: { id: 'customer.home.categories', type: 'grid', cmsSection: 'categories', displayName: t('شبكة الفئات', 'Category Grid'),
    editableProps: [{ key: 'items', label: t('الفئات', 'Categories'), type: 'select', binding: { source: 'data', path: 'catalog.categories', readonly: true } }],
    bindings: [{ source: 'data', path: 'catalog.categories', readonly: true }], events: [{ name: 'category.select', label: t('اختيار فئة', 'Select category') }], themeTokens: [], animations: [], children: ['customer.home.category_card'] } },
  { match: '.category-card', metadata: { id: 'customer.home.category_card', type: 'card', displayName: t('بطاقة فئة', 'Category Card'),
    editableProps: [
      { key: 'name', label: t('الاسم', 'Name'), type: 'text', binding: { source: 'data', path: 'category.name', readonly: true } },
      { key: 'image', label: t('الصورة', 'Image'), type: 'image', binding: { source: 'data', path: 'category.cover' } },
    ], bindings: [{ source: 'data', path: 'category', readonly: true }], events: [], themeTokens: [], animations: ['scale'], parent: 'customer.home.categories' } },
  { match: '#home_offers', metadata: { id: 'customer.home.offers', type: 'carousel', cmsSection: 'offers', displayName: t('كاروسيل العروض', 'Offer Carousel'),
    editableProps: [{ key: 'items', label: t('العروض', 'Offers'), type: 'select', binding: { source: 'data', path: 'marketing.offers', readonly: true } }],
    bindings: [{ source: 'data', path: 'marketing.offers', readonly: true }], events: [{ name: 'offer.open', label: t('فتح عرض', 'Open offer') }], themeTokens: [], animations: [], children: ['customer.home.offer_card'] } },
  { match: '[id^="offer_"]:not([id^="offer_cta_"])', metadata: { id: 'customer.home.offer_card', type: 'card', displayName: t('بطاقة عرض', 'Offer Card'),
    editableProps: [
      { key: 'title', label: t('العنوان', 'Title'), type: 'text', binding: { source: 'data', path: 'offer.title', readonly: true } },
      { key: 'discount', label: t('الخصم', 'Discount'), type: 'text', binding: { source: 'data', path: 'offer.discount', readonly: true } },
    ], bindings: [{ source: 'data', path: 'offer', readonly: true }], events: [], themeTokens: [], animations: [], parent: 'customer.home.offers' } },
  { match: '#home_restaurants', metadata: { id: 'customer.home.restaurants', type: 'list', cmsSection: 'merchants', displayName: t('قائمة المطاعم', 'Restaurant List'),
    editableProps: [{ key: 'items', label: t('المطاعم', 'Merchants'), type: 'select', binding: { source: 'data', path: 'catalog.merchants', readonly: true } }],
    bindings: [{ source: 'data', path: 'catalog.merchants', readonly: true }], events: [{ name: 'merchant.open', label: t('فتح مطعم', 'Open merchant') }], themeTokens: [], animations: [], children: ['customer.home.restaurant_card'] } },
  { match: '[id^="branch_"]', metadata: { id: 'customer.home.restaurant_card', type: 'card', displayName: t('بطاقة مطعم', 'Restaurant Card'),
    editableProps: [
      { key: 'name', label: t('الاسم', 'Name'), type: 'text', binding: { source: 'data', path: 'merchant.name', readonly: true } },
      { key: 'rating', label: t('التقييم', 'Rating'), type: 'number', binding: { source: 'data', path: 'merchant.rating', readonly: true } },
      { key: 'logo', label: t('الشعار', 'Logo'), type: 'image', binding: { source: 'data', path: 'merchant.logo_url' } },
    ], bindings: [{ source: 'data', path: 'merchant', readonly: true }], events: [{ name: 'card.open', label: t('فتح', 'Open') }], themeTokens: [], animations: ['scale'], parent: 'customer.home.restaurants' } },
  { match: '#home_featured_circles', metadata: { id: 'customer.home.featured', type: 'rail', cmsSection: 'featured', displayName: t('المميزون', 'Featured Merchants'), editableProps: [], bindings: [{ source: 'data', path: 'catalog.featured', readonly: true }], events: [], themeTokens: [], animations: [] } },
  { match: '#home_benefits', metadata: { id: 'customer.home.benefits', type: 'section', displayName: t('المزايا', 'Benefits Strip'), editableProps: [], bindings: [], events: [], themeTokens: [], animations: [] } },
  { match: '#home_experience_surfaces', metadata: { id: 'customer.home.experiences', type: 'section', displayName: t('أسطح التجربة', 'Experience Surfaces'), editableProps: [], bindings: [{ source: 'data', path: 'experience.decision', readonly: true }], events: [], themeTokens: [], animations: [] } },
];

// Merchant · Dashboard.
const MERCHANT_DASHBOARD: MappedComponent[] = [
  { match: '#merchant_portal_full', metadata: { id: 'merchant.root', type: 'screen', displayName: t('بوابة التاجر', 'Merchant Portal'), editableProps: [], bindings: [], events: [], themeTokens: [], animations: [] } },
  { match: '#merchant_topbar', metadata: { id: 'merchant.topbar', type: 'appbar', displayName: t('الشريط العلوي للتاجر', 'Merchant Top Bar'), editableProps: [], bindings: [{ source: 'data', path: 'merchant.profile', readonly: true }], events: [], themeTokens: ['--color-primary-fixed'], animations: [] } },
  { match: '#merchant_branch_header_card', metadata: { id: 'merchant.branch_header', type: 'card', displayName: t('بطاقة الفرع', 'Branch Header Card'),
    editableProps: [{ key: 'name', label: t('اسم الفرع', 'Branch name'), type: 'text', binding: { source: 'data', path: 'branch.name', readonly: true } }],
    bindings: [{ source: 'data', path: 'branch', readonly: true }], events: [], themeTokens: [], animations: [] } },
  { match: '#merchant_kpi_area, #merchant_analytics_row', metadata: { id: 'merchant.analytics', type: 'widget', displayName: t('أداة تحليلات التاجر', 'Merchant Analytics Widget'),
    editableProps: [{ key: 'metrics', label: t('المؤشرات', 'Metrics'), type: 'select', binding: { source: 'data', path: 'merchant.analytics', readonly: true } }],
    bindings: [{ source: 'data', path: 'merchant.analytics', readonly: true }], events: [], themeTokens: [], animations: [] } },
  { match: '#earnings_balance_box', metadata: { id: 'merchant.earnings', type: 'widget', displayName: t('رصيد الأرباح', 'Earnings Balance'),
    editableProps: [{ key: 'balance', label: t('الرصيد', 'Balance'), type: 'number', binding: { source: 'data', path: 'merchant.wallet.balance', readonly: true } }],
    bindings: [{ source: 'data', path: 'merchant.wallet', readonly: true }], events: [{ name: 'payout.request', label: t('طلب سحب', 'Request payout') }], themeTokens: [], animations: [] } },
  { match: '#merchant_revenue_hero', metadata: { id: 'merchant.revenue', type: 'widget', displayName: t('أداة الإيرادات', 'Revenue Widget'),
    editableProps: [{ key: 'revenue', label: t('الإيرادات', 'Revenue'), type: 'number', binding: { source: 'data', path: 'merchant.revenue', readonly: true } }],
    bindings: [{ source: 'data', path: 'merchant.revenue', readonly: true }], events: [], themeTokens: [], animations: [] } },
  { match: '#active_orders_list_wrapper, #active_orders_grid', metadata: { id: 'merchant.active_orders', type: 'list', cmsSection: 'orders', displayName: t('قائمة الطلبات النشطة', 'Active Orders List'),
    editableProps: [], bindings: [{ source: 'data', path: 'merchant.activeOrders', readonly: true }], events: [{ name: 'order.advance', label: t('تقدّم الطلب', 'Advance order') }], themeTokens: [], animations: [] } },
  { match: '#merchant_experience_surfaces', metadata: { id: 'merchant.experiences', type: 'section', displayName: t('أسطح التجربة', 'Experience Surfaces'), editableProps: [], bindings: [{ source: 'data', path: 'experience.decision', readonly: true }], events: [], themeTokens: [], animations: [] } },
  { match: '#merchant_logo_card', metadata: { id: 'merchant.logo', type: 'card', displayName: t('بطاقة شعار التاجر', 'Merchant Logo Card'),
    editableProps: [{ key: 'logo', label: t('الشعار', 'Logo'), type: 'image', binding: { source: 'data', path: 'merchant.logo_url' } }],
    bindings: [{ source: 'data', path: 'merchant', readonly: true }], events: [], themeTokens: [], animations: [] } },
];

// Driver · Home.
const DRIVER_HOME: MappedComponent[] = [
  { match: '#driver_app_container', metadata: { id: 'driver.root', type: 'screen', displayName: t('تطبيق المندوب', 'Driver App'), editableProps: [], bindings: [], events: [], themeTokens: [], animations: [] } },
  { match: '#driver_topbar', metadata: { id: 'driver.topbar', type: 'appbar', displayName: t('الشريط العلوي للمندوب', 'Driver Top Bar'),
    editableProps: [], bindings: [{ source: 'data', path: 'driver.profile', readonly: true }], events: [], themeTokens: ['--color-primary-fixed'], animations: [] } },
  { match: '#toggle_online_presence', metadata: { id: 'driver.online_toggle', type: 'toggle', displayName: t('مفتاح الاتصال', 'Online Presence Toggle'),
    editableProps: [{ key: 'online', label: t('متصل', 'Online'), type: 'boolean', binding: { source: 'data', path: 'driver.online', readonly: true } }],
    bindings: [{ source: 'data', path: 'driver.presence', readonly: true }], events: [{ name: 'presence.toggle', label: t('تبديل الحالة', 'Toggle presence') }], themeTokens: [], animations: [] } },
  { match: '#available_jobs_scroller', metadata: { id: 'driver.available_jobs', type: 'list', displayName: t('الطلبات المتاحة', 'Available Jobs'),
    editableProps: [], bindings: [{ source: 'data', path: 'driver.availableJobs', readonly: true }], events: [{ name: 'job.accept', label: t('قبول طلب', 'Accept job') }], themeTokens: [], animations: [] } },
  { match: '#active_job_actions', metadata: { id: 'driver.active_job', type: 'card', displayName: t('بطاقة الطلب النشط', 'Active Job Card'),
    editableProps: [{ key: 'status', label: t('الحالة', 'Status'), type: 'text', binding: { source: 'data', path: 'driver.activeJob.status', readonly: true } }],
    bindings: [{ source: 'data', path: 'driver.activeJob', readonly: true }], events: [{ name: 'job.advance', label: t('تقدّم الطلب', 'Advance job') }], themeTokens: [], animations: [] } },
];

/** channel:screen → declared components. Website is served by the Website Studio's block model. */
export const COMPONENT_MAP: Record<string, MappedComponent[]> = {
  'customer:home': CUSTOMER_HOME,
  'customer:landing': CUSTOMER_HOME,
  'merchant:dashboard': MERCHANT_DASHBOARD,
  'merchant:orders': MERCHANT_DASHBOARD,
  'merchant:products': MERCHANT_DASHBOARD,
  'merchant:analytics': MERCHANT_DASHBOARD,
  'merchant:finance': MERCHANT_DASHBOARD,
  'merchant:settings': MERCHANT_DASHBOARD,
  'driver:home': DRIVER_HOME,
};

export function componentsFor(channel: string, screen: string): MappedComponent[] {
  return COMPONENT_MAP[`${channel}:${screen}`] ?? [];
}
