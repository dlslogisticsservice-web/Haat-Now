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
  { match: '#home_hero, #home_campaign_hero, #campaign_hero_banner', metadata: { id: 'customer.home.hero', type: 'banner', cmsSection: 'hero', displayName: t('بانر الهيرو', 'Hero Banner'),
    editableProps: [
      { key: 'title', label: t('العنوان', 'Title'), type: 'text', selector: 'p', validation: { required: true, maxLength: 40 }, binding: { source: 'content', path: 'hero.title' } },
      { key: 'subtitle', label: t('العنوان الفرعي', 'Subtitle'), type: 'text', selector: 'p:nth-of-type(2)', validation: { maxLength: 80 }, binding: { source: 'content', path: 'hero.subtitle' } },
      { key: 'image', label: t('الصورة', 'Image'), type: 'image', selector: 'img', binding: { source: 'content', path: 'hero.image_url' } },
      { key: 'cta', label: t('زر الإجراء', 'CTA label'), type: 'text', selector: 'button', binding: { source: 'content', path: 'hero.cta_label' } },
      { key: 'accent', label: t('لون التمييز', 'Accent color'), type: 'color', token: '--color-primary-fixed', binding: { source: 'theme', path: 'theme.primary', readonly: true } },
    ],
    bindings: [{ source: 'data', path: 'campaign.hero', readonly: true }], events: [{ name: 'cta.click', label: t('نقر الزر', 'CTA click') }], themeTokens: ['--color-primary-fixed'], animations: ['fade'] } },
  { match: '#home_search', metadata: { id: 'customer.home.search', type: 'search', displayName: t('شريط البحث', 'Search Bar'),
    editableProps: [{ key: 'placeholder', label: t('النص التلميحي', 'Placeholder'), type: 'text', binding: { source: 'i18n', path: 'home.searchPlaceholder' } }],
    bindings: [], events: [{ name: 'search.submit', label: t('بحث', 'Search') }], themeTokens: [], animations: [] } },
  { match: '#home_categories', metadata: { id: 'customer.home.categories', type: 'grid', cmsSection: 'categories', displayName: t('شبكة الفئات', 'Category Grid'),
    editableProps: [{ key: 'items', label: t('عدد الفئات', 'Category count'), type: 'select', selector: '.category-card', binding: { source: 'data', path: 'catalog.categories', readonly: true } }],
    bindings: [{ source: 'data', path: 'catalog.categories', readonly: true }], events: [{ name: 'category.select', label: t('اختيار فئة', 'Select category') }], themeTokens: [], animations: [], children: ['customer.home.category_card'] } },
  { match: '.category-card', metadata: { id: 'customer.home.category_card', type: 'card', displayName: t('بطاقة فئة', 'Category Card'),
    editableProps: [
      { key: 'name', label: t('الاسم', 'Name'), type: 'text', selector: 'span', validation: { required: true, maxLength: 30 }, binding: { source: 'data', path: 'category.name' } },
      { key: 'image', label: t('الصورة', 'Image'), type: 'image', selector: 'img', binding: { source: 'data', path: 'category.cover' } },
      { key: 'active', label: t('الحالة (نشط)', 'State (active)'), type: 'boolean', binding: { source: 'data', path: 'category.active', readonly: true } },
    ], bindings: [{ source: 'data', path: 'category', readonly: true }], events: [], themeTokens: [], animations: ['scale'], parent: 'customer.home.categories' } },
  { match: '#home_offers', metadata: { id: 'customer.home.offers', type: 'carousel', cmsSection: 'offers', displayName: t('كاروسيل العروض', 'Offer Carousel'),
    editableProps: [{ key: 'items', label: t('عدد العروض', 'Offer count'), type: 'select', selector: '[id^="offer_"]:not([id^="offer_cta_"])', binding: { source: 'data', path: 'marketing.offers', readonly: true } }],
    bindings: [{ source: 'data', path: 'marketing.offers', readonly: true }], events: [{ name: 'offer.open', label: t('فتح عرض', 'Open offer') }], themeTokens: [], animations: [], children: ['customer.home.offer_card'] } },
  { match: '[id^="offer_"]:not([id^="offer_cta_"])', metadata: { id: 'customer.home.offer_card', type: 'card', displayName: t('بطاقة عرض', 'Offer Card'),
    editableProps: [
      { key: 'title', label: t('العنوان', 'Title'), type: 'text', selector: 'p:nth-of-type(2)', binding: { source: 'data', path: 'offer.title' } },
      { key: 'cta', label: t('زر الإجراء', 'CTA label'), type: 'text', selector: 'button', binding: { source: 'data', path: 'offer.cta' } },
    ], bindings: [{ source: 'data', path: 'offer', readonly: true }], events: [], themeTokens: [], animations: [], parent: 'customer.home.offers' } },
  { match: '#home_restaurants', metadata: { id: 'customer.home.restaurants', type: 'list', cmsSection: 'merchants', displayName: t('قائمة المطاعم', 'Restaurant List'),
    editableProps: [{ key: 'items', label: t('عدد المطاعم', 'Merchant count'), type: 'select', selector: '[id^="branch_"]', binding: { source: 'data', path: 'catalog.merchants', readonly: true } }],
    bindings: [{ source: 'data', path: 'catalog.merchants', readonly: true }], events: [{ name: 'merchant.open', label: t('فتح مطعم', 'Open merchant') }], themeTokens: [], animations: [], children: ['customer.home.restaurant_card'] } },
  { match: '#restaurants_list > div', metadata: { id: 'customer.home.restaurant_card', type: 'card', displayName: t('بطاقة مطعم', 'Restaurant Card'),
    editableProps: [
      { key: 'name', label: t('الاسم', 'Name'), type: 'text', selector: 'h3', binding: { source: 'data', path: 'merchant.name' } },
      { key: 'rating', label: t('التقييم', 'Rating'), type: 'number', binding: { source: 'data', path: 'merchant.rating', readonly: true } },
      { key: 'logo', label: t('الشعار', 'Logo'), type: 'image', selector: 'img', binding: { source: 'data', path: 'merchant.logo_url' } },
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
    editableProps: [
      { key: 'title', label: t('عنوان الأداة', 'Widget title'), type: 'text', selector: 'h1', validation: { required: true, maxLength: 60 }, binding: { source: 'data', path: 'branch.name' } },
      { key: 'accent', label: t('لون التمييز', 'Accent color'), type: 'color', token: '--color-primary-fixed', binding: { source: 'theme', path: 'theme.primary', readonly: true } },
    ],
    bindings: [{ source: 'data', path: 'branch', readonly: true }], events: [], themeTokens: ['--color-primary-fixed'], animations: [] } },
  { match: '#merchant_kpi_area, #merchant_analytics_row', metadata: { id: 'merchant.analytics', type: 'widget', displayName: t('أداة تحليلات التاجر', 'Merchant Analytics Widget'),
    editableProps: [{ key: 'metrics', label: t('المؤشرات الحالية', 'Current metrics'), type: 'text', binding: { source: 'data', path: 'merchant.analytics', readonly: true } }],
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
    editableProps: [
      { key: 'status', label: t('الحالة الحالية', 'Current status'), type: 'text', binding: { source: 'data', path: 'driver.status', readonly: true } },
      { key: 'accent', label: t('لون التمييز', 'Accent color'), type: 'color', token: '--color-primary-fixed', binding: { source: 'theme', path: 'theme.primary', readonly: true } },
    ], bindings: [{ source: 'data', path: 'driver.profile', readonly: true }], events: [], themeTokens: ['--color-primary-fixed'], animations: [] } },
  { match: '#toggle_online_presence', metadata: { id: 'driver.online_toggle', type: 'toggle', displayName: t('مفتاح الاتصال', 'Online Presence Toggle'),
    editableProps: [{ key: 'online', label: t('متصل', 'Online'), type: 'boolean', binding: { source: 'data', path: 'driver.online', readonly: true } }],
    bindings: [{ source: 'data', path: 'driver.presence', readonly: true }], events: [{ name: 'presence.toggle', label: t('تبديل الحالة', 'Toggle presence') }], themeTokens: [], animations: [] } },
  { match: '#available_jobs_scroller', metadata: { id: 'driver.available_jobs', type: 'list', displayName: t('الطلبات المتاحة', 'Available Jobs'),
    editableProps: [], bindings: [{ source: 'data', path: 'driver.availableJobs', readonly: true }], events: [{ name: 'job.accept', label: t('قبول طلب', 'Accept job') }], themeTokens: [], animations: [] } },
  { match: '#active_job_actions', metadata: { id: 'driver.active_job', type: 'card', displayName: t('بطاقة الطلب النشط', 'Active Job Card'),
    editableProps: [{ key: 'status', label: t('الحالة', 'Status'), type: 'text', binding: { source: 'data', path: 'driver.activeJob.status', readonly: true } }],
    bindings: [{ source: 'data', path: 'driver.activeJob', readonly: true }], events: [{ name: 'job.advance', label: t('تقدّم الطلب', 'Advance job') }], themeTokens: [], animations: [] } },
];

// ── Entry Experience (Phase 8I) — the animated entry screens. Every animated layer is an
// editable CSS-var prop (scope:'self' → written on the component element) so the Studio's
// transaction engine edits it LIVE. One component set, shared by all five entry screens. ──
const EASING_OPTIONS = [
  { value: 'ease-out', label: t('انسيابي للخارج', 'ease-out') },
  { value: 'ease-in-out', label: t('انسيابي', 'ease-in-out') },
  { value: 'linear', label: t('خطّي', 'linear') },
  { value: 'cubic-bezier(.22,1,.36,1)', label: t('مرن', 'spring') },
];
const ENTRY_COMPONENTS: MappedComponent[] = [
  { match: '#entry_experience', metadata: { id: 'customer.entry.root', type: 'screen', displayName: t('تجربة الدخول', 'Entry Experience'),
    editableProps: [
      { key: 'background', label: t('الخلفية', 'Background'), type: 'color', scope: 'self', token: '--entry-bg', binding: { source: 'content', path: 'entry.background' } },
      { key: 'gradient_from', label: t('التدرّج (من)', 'Gradient from'), type: 'color', scope: 'self', token: '--entry-grad-a', binding: { source: 'content', path: 'entry.gradientFrom' } },
      { key: 'gradient_to', label: t('التدرّج (إلى)', 'Gradient to'), type: 'color', scope: 'self', token: '--entry-grad-b', binding: { source: 'content', path: 'entry.gradientTo' } },
      { key: 'glow_color', label: t('لون التوهّج', 'Glow color'), type: 'color', scope: 'self', token: '--entry-glow-color', binding: { source: 'content', path: 'entry.glow.color' } },
      { key: 'glow_intensity', label: t('شدّة التوهّج', 'Glow intensity'), type: 'range', scope: 'self', token: '--entry-glow-intensity', min: 0, max: 1, step: 0.05, binding: { source: 'content', path: 'entry.glow.intensity' } },
      { key: 'particle_color', label: t('لون الجزيئات', 'Particle color'), type: 'color', scope: 'self', token: '--entry-particle-color', binding: { source: 'content', path: 'entry.particles.color' } },
      { key: 'particle_count', label: t('عدد الجزيئات', 'Particle count'), type: 'range', scope: 'self', token: '--entry-particles', min: 0, max: 16, step: 1, binding: { source: 'content', path: 'entry.particles.count' } },
      { key: 'particle_speed', label: t('سرعة الجزيئات', 'Particle speed'), type: 'range', scope: 'self', token: '--entry-particle-speed', min: 2, max: 12, step: 0.5, unit: 's', binding: { source: 'content', path: 'entry.particles.speed' } },
      { key: 'ring_color', label: t('لون الحلقات', 'Ring color'), type: 'color', scope: 'self', token: '--entry-ring-color', binding: { source: 'content', path: 'entry.rings.color' } },
      { key: 'ring_count', label: t('عدد الحلقات', 'Ring count'), type: 'range', scope: 'self', token: '--entry-rings', min: 0, max: 5, step: 1, binding: { source: 'content', path: 'entry.rings.count' } },
      { key: 'ring_thickness', label: t('سماكة الحلقات', 'Ring thickness'), type: 'range', scope: 'self', token: '--entry-ring-thickness', min: 1, max: 8, step: 1, unit: 'px', binding: { source: 'content', path: 'entry.rings.thickness' } },
      { key: 'duration', label: t('مدّة الانتقال', 'Transition duration'), type: 'range', scope: 'self', token: '--entry-duration', min: 200, max: 2000, step: 50, unit: 'ms', binding: { source: 'content', path: 'entry.timing.duration' } },
      { key: 'easing', label: t('منحنى الانتقال', 'Transition easing'), type: 'option', scope: 'self', token: '--entry-easing', options: EASING_OPTIONS, binding: { source: 'content', path: 'entry.timing.easing' } },
    ], bindings: [{ source: 'content', path: 'entry.model', readonly: true }], events: [], themeTokens: ['--entry-glow-color'], animations: ['float', 'spin', 'pulse', 'enter'],
    children: ['customer.entry.logo', 'customer.entry.title', 'customer.entry.cta'] } },
  { match: '#entry_logo', metadata: { id: 'customer.entry.logo', type: 'image', displayName: t('الشعار', 'Logo'),
    editableProps: [
      { key: 'image', label: t('الصورة', 'Image'), type: 'image', selector: 'img', binding: { source: 'content', path: 'entry.logo.src' } },
      { key: 'size', label: t('الحجم', 'Size'), type: 'range', scope: 'self', token: '--entry-logo-size', min: 48, max: 160, step: 4, unit: 'px', binding: { source: 'content', path: 'entry.logo.size' } },
    ], bindings: [], events: [], themeTokens: [], animations: [], parent: 'customer.entry.root' } },
  { match: '#entry_title', metadata: { id: 'customer.entry.title', type: 'text', displayName: t('العنوان', 'Title'),
    editableProps: [{ key: 'title', label: t('العنوان', 'Title'), type: 'text', validation: { required: true, maxLength: 40 }, binding: { source: 'content', path: 'entry.text.title' } }],
    bindings: [], events: [], themeTokens: [], animations: [], parent: 'customer.entry.root' } },
  { match: '#entry_subtitle', metadata: { id: 'customer.entry.subtitle', type: 'text', displayName: t('العنوان الفرعي', 'Subtitle'),
    editableProps: [{ key: 'subtitle', label: t('العنوان الفرعي', 'Subtitle'), type: 'text', validation: { maxLength: 80 }, binding: { source: 'content', path: 'entry.text.subtitle' } }],
    bindings: [], events: [], themeTokens: [], animations: [], parent: 'customer.entry.root' } },
  { match: '#entry_cta', metadata: { id: 'customer.entry.cta', type: 'button', displayName: t('زر الإجراء', 'CTA Button'),
    editableProps: [
      { key: 'label', label: t('النص', 'Label'), type: 'text', validation: { maxLength: 24 }, binding: { source: 'content', path: 'entry.cta.label' } },
      { key: 'visible', label: t('ظاهر', 'Visible'), type: 'boolean', scope: 'self', token: '--entry-cta-visible', binding: { source: 'content', path: 'entry.cta.visible' } },
    ], bindings: [], events: [{ name: 'cta.click', label: t('نقر الزر', 'CTA click') }], themeTokens: [], animations: [], parent: 'customer.entry.root' } },
];

// Privacy & Security → Delete Account (Apple compliance UI). The delete row is selectable/editable.
const PRIVACY_COMPONENTS: MappedComponent[] = [
  { match: '#delete_account_row', metadata: { id: 'customer.privacy.delete', type: 'card', displayName: t('حذف الحساب', 'Delete Account'),
    editableProps: [{ key: 'title', label: t('العنوان', 'Title'), type: 'text', selector: 'span span', validation: { required: true, maxLength: 30 }, binding: { source: 'i18n', path: 'privacy.deleteAccount' } }],
    bindings: [{ source: 'static', path: 'apple.compliance', readonly: true }], events: [{ name: 'delete.start', label: t('بدء الحذف', 'Start deletion') }], themeTokens: [], animations: [] } },
];

/** channel:screen → declared components. Website is served by the Website Studio's block model. */
export const COMPONENT_MAP: Record<string, MappedComponent[]> = {
  'customer:splash': ENTRY_COMPONENTS,
  'customer:intro': ENTRY_COMPONENTS,
  'customer:welcome': ENTRY_COMPONENTS,
  'customer:landing': ENTRY_COMPONENTS,
  'customer:onboarding': ENTRY_COMPONENTS,
  'customer:privacy': PRIVACY_COMPONENTS,
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
