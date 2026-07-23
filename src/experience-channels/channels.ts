// ─────────────────────────────────────────────────────────────────────────────
// Experience Channels · the registry that turns the Website Studio into an
// Experience Studio.
//
// This is the SINGLE source of truth for what channels exist, what screens each
// channel has, and which Experience Engine surface drives each screen. The Studio
// navigator, the multi-channel preview, the channel-aware inspector and the
// cross-channel Marketing OS all read from HERE — none of them re-declare a channel.
//
// It is deliberately PURE: no React, no services, no DOM. A channel is data, so that
// exactly one place decides "these are the channels" and everything else follows.
//
// Website is NOT special-cased away — it is simply the first channel in the registry.
// The Experience Engine already routes every `surface` through the one Runtime
// (see experience-platform.service `decideFor`), so nothing here forks execution;
// it only names what was always addressable.
// ─────────────────────────────────────────────────────────────────────────────

/** Channel ids align 1:1 with the engine's `Surface` union for the four live channels. */
export type ChannelId =
  | 'website' | 'customer' | 'merchant' | 'driver'
  | 'email' | 'push' | 'sms' | 'whatsapp' | 'kiosk' | 'voice' | 'tv';

/** Which engine surface a channel decides against. Future channels have no surface yet. */
export type ChannelSurface = 'website' | 'customer' | 'merchant' | 'driver';

export type ChannelStatus = 'active' | 'planned';

/**
 * How the inspector should shape itself for this channel. The website inspector is
 * the existing Blocks/SEO/Theme editor and is untouched; the others inspect the
 * experience surfaces the engine places on that channel.
 */
export type InspectorKind = 'website' | 'customer' | 'merchant' | 'driver';

/** The device frame a channel previews in by default. */
export type ChannelForm = 'mobile' | 'desktop';

export interface ChannelScreen {
  id: string;
  ar: string;
  en: string;
  /**
   * The experience ids (flags) the engine can place on this screen. Empty means the
   * screen is structural context with no engine-placed experience yet — the preview
   * still renders it, it simply shows no surface. These map to real PLATFORM_FLAGS.
   */
  experiences: string[];
  /** One-line description of what this screen is, shown in the inspector. */
  ar_desc?: string;
  en_desc?: string;
}

export interface ChannelDef {
  id: ChannelId;
  ar: string;
  en: string;
  /** lucide-react icon name, resolved by the UI (keeps this file icon-free/pure). */
  icon: string;
  status: ChannelStatus;
  /** Present only for active channels; the engine surface they decide against. */
  surface?: ChannelSurface;
  inspector?: InspectorKind;
  form?: ChannelForm;
  screens: ChannelScreen[];
  /** Future channels carry a short note on why they are not live yet. */
  ar_note?: string;
  en_note?: string;
}

// ── Active channels ─────────────────────────────────────────────────────────────
// Screen → experience mappings use the SAME flag ids the product screens already
// read (PLATFORM_FLAGS in experience-platform.service). The preview therefore shows
// the real engine decision, not an invented one.

const WEBSITE: ChannelDef = {
  id: 'website', ar: 'الموقع', en: 'Website', icon: 'Globe',
  status: 'active', surface: 'website', inspector: 'website', form: 'desktop',
  // Website screens are the CMS pages themselves; the existing Studio owns them, so
  // the registry lists only the canonical entry point. The Website path renders the
  // existing page/section editor unchanged.
  screens: [
    { id: 'pages', ar: 'الصفحات', en: 'Pages', experiences: [], en_desc: 'The CMS pages — edited by the existing Website Studio.' },
  ],
};

const CUSTOMER: ChannelDef = {
  id: 'customer', ar: 'تطبيق العميل', en: 'Customer App', icon: 'Smartphone',
  status: 'active', surface: 'customer', inspector: 'customer', form: 'mobile',
  screens: [
    { id: 'splash', ar: 'الشاشة الافتتاحية', en: 'Splash', experiences: [], en_desc: 'App launch splash.' },
    { id: 'onboarding', ar: 'التعريف', en: 'Onboarding', experiences: [], en_desc: 'First-run onboarding.' },
    { id: 'landing', ar: 'الترحيب', en: 'Landing', experiences: ['flag.customer_welcome'], en_desc: 'Signed-out landing / gateway.' },
    { id: 'home', ar: 'الرئيسية', en: 'Home', experiences: ['flag.customer_welcome', 'flag.customer_offers', 'flag.customer_feature_tour'], en_desc: 'Marketplace home — the primary surface for personalized experiences.' },
    { id: 'categories', ar: 'الفئات', en: 'Categories', experiences: [], en_desc: 'Category grid.' },
    { id: 'search', ar: 'البحث', en: 'Search', experiences: [], en_desc: 'Search & discovery.' },
    { id: 'restaurant', ar: 'تفاصيل المطعم', en: 'Restaurant Details', experiences: [], en_desc: 'Restaurant / branch menu.' },
    { id: 'store', ar: 'تفاصيل المتجر', en: 'Store Details', experiences: [], en_desc: 'Store / grocery details.' },
    { id: 'offers', ar: 'العروض', en: 'Offers', experiences: ['flag.customer_offers'], en_desc: 'Offers & coupons.' },
    { id: 'coupons', ar: 'الكوبونات', en: 'Coupons', experiences: ['flag.customer_offers'], en_desc: 'Applied and available coupons.' },
    { id: 'checkout', ar: 'الدفع', en: 'Checkout', experiences: [], en_desc: 'Cart → checkout.' },
    { id: 'orders', ar: 'الطلبات', en: 'Orders', experiences: [], en_desc: 'Active and past orders / tracking.' },
    { id: 'wallet', ar: 'المحفظة', en: 'Wallet', experiences: [], en_desc: 'Balance and transactions.' },
    { id: 'notifications', ar: 'الإشعارات', en: 'Notifications', experiences: [], en_desc: 'In-app notifications.' },
    { id: 'profile', ar: 'الملف الشخصي', en: 'Profile', experiences: ['flag.customer_feature_tour'], en_desc: 'Account and preferences.' },
  ],
};

const MERCHANT: ChannelDef = {
  id: 'merchant', ar: 'تطبيق التاجر', en: 'Merchant App', icon: 'Store',
  status: 'active', surface: 'merchant', inspector: 'merchant', form: 'desktop',
  screens: [
    { id: 'dashboard', ar: 'لوحة التحكم', en: 'Dashboard', experiences: ['flag.merchant_announcements', 'flag.merchant_beta_dashboard', 'flag.merchant_education'], en_desc: 'Portal home — announcements, beta and education surfaces.' },
    { id: 'orders', ar: 'الطلبات', en: 'Orders', experiences: [], en_desc: 'Incoming order queue.' },
    { id: 'products', ar: 'المنتجات', en: 'Products', experiences: [], en_desc: 'Menu / catalog management.' },
    { id: 'analytics', ar: 'التحليلات', en: 'Analytics', experiences: ['flag.merchant_beta_dashboard'], en_desc: 'Performance analytics (beta surface).' },
    { id: 'finance', ar: 'المالية', en: 'Finance', experiences: [], en_desc: 'Payouts and settlements.' },
    { id: 'campaigns', ar: 'الحملات', en: 'Campaigns', experiences: [], en_desc: 'Merchant-facing campaigns.' },
    { id: 'announcements', ar: 'الإعلانات', en: 'Announcements', experiences: ['flag.merchant_announcements'], en_desc: 'Platform announcement strip.' },
    { id: 'settings', ar: 'الإعدادات', en: 'Settings', experiences: ['flag.merchant_education'], en_desc: 'Hours, profile, education cards.' },
  ],
};

const DRIVER: ChannelDef = {
  id: 'driver', ar: 'تطبيق المندوب', en: 'Driver App', icon: 'Bike',
  status: 'active', surface: 'driver', inspector: 'driver', form: 'mobile',
  screens: [
    { id: 'home', ar: 'الرئيسية', en: 'Home', experiences: ['flag.driver_beta_tools', 'flag.driver_safety', 'flag.driver_training'], en_desc: 'Driver home — rollout, safety and training surfaces.' },
    { id: 'orders', ar: 'الطلبات', en: 'Orders', experiences: [], en_desc: 'Assigned deliveries.' },
    { id: 'map', ar: 'الخريطة', en: 'Map', experiences: [], en_desc: 'Live map view.' },
    { id: 'navigation', ar: 'الملاحة', en: 'Navigation', experiences: [], en_desc: 'Turn-by-turn to pickup / dropoff.' },
    { id: 'wallet', ar: 'المحفظة', en: 'Wallet', experiences: [], en_desc: 'Earnings and payouts.' },
    { id: 'training', ar: 'التدريب', en: 'Training', experiences: ['flag.driver_training'], en_desc: 'Training cards.' },
    { id: 'safety', ar: 'السلامة', en: 'Safety', experiences: ['flag.driver_safety'], en_desc: 'Safety announcements.' },
    { id: 'announcements', ar: 'الإعلانات', en: 'Announcements', experiences: ['flag.driver_beta_tools'], en_desc: 'Rollout / beta announcements.' },
  ],
};

// ── Future channels · placeholders only ─────────────────────────────────────────
// Present so the Studio and Marketing OS can SEE where the platform is going, and so
// nobody builds a parallel "email studio" later. They render a "planned" state — no
// surface, no fabricated preview.
const future = (id: ChannelId, ar: string, en: string, icon: string, arNote: string, enNote: string): ChannelDef =>
  ({ id, ar, en, icon, status: 'planned', screens: [], ar_note: arNote, en_note: enNote });

const FUTURE: ChannelDef[] = [
  future('email', 'البريد', 'Email', 'Mail', 'يحتاج ناقل بريد', 'Needs an email transport'),
  future('push', 'الإشعارات الفورية', 'Push', 'Bell', 'يحتاج FCM/APNs', 'Needs FCM/APNs'),
  future('sms', 'الرسائل', 'SMS', 'MessageSquare', 'يحتاج مزوّد SMS', 'Needs an SMS provider'),
  future('whatsapp', 'واتساب', 'WhatsApp', 'MessageCircle', 'يحتاج WhatsApp Business API', 'Needs WhatsApp Business API'),
  future('kiosk', 'الكشك', 'Kiosk', 'MonitorSmartphone', 'قناة مخطّطة', 'Planned in-store channel'),
  future('voice', 'الصوت', 'Voice', 'Mic', 'قناة مخطّطة', 'Planned voice channel'),
  future('tv', 'التلفزيون', 'TV', 'Tv', 'قناة مخطّطة', 'Planned TV channel'),
];

/** The registry, in navigator order. */
export const CHANNELS: ChannelDef[] = [WEBSITE, CUSTOMER, MERCHANT, DRIVER, ...FUTURE];

export const ACTIVE_CHANNELS: ChannelDef[] = CHANNELS.filter(c => c.status === 'active');
export const FUTURE_CHANNELS: ChannelDef[] = CHANNELS.filter(c => c.status === 'planned');

export function getChannel(id: ChannelId): ChannelDef | undefined {
  return CHANNELS.find(c => c.id === id);
}

export function getScreen(channelId: ChannelId, screenId: string): ChannelScreen | undefined {
  return getChannel(channelId)?.screens.find(s => s.id === screenId);
}

/** Every experience id referenced across all channels, de-duplicated. */
export function allChannelExperiences(): string[] {
  const set = new Set<string>();
  for (const c of CHANNELS) for (const s of c.screens) for (const e of s.experiences) set.add(e);
  return [...set];
}

/** Channels an experience id appears on — used to answer "where does this run?". */
export function channelsForExperience(experienceId: string): ChannelId[] {
  return CHANNELS
    .filter(c => c.screens.some(s => s.experiences.includes(experienceId)))
    .map(c => c.id);
}
