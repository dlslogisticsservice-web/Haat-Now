// ─────────────────────────────────────────────────────────────────────────────
// Experience Content — the ONE source of truth for what every experience surface says.
//
// Before this module the copy for each experience lived inline, duplicated across the
// live Customer/Merchant/Driver screens AND the Studio preview. That is exactly the
// duplication the Visual Authoring sprint had to remove: the Studio and the live app
// must render the SAME content, so authoring in the Studio changes the live app.
//
// This file holds the shipped DEFAULTS. Operator edits are stored as overrides in the
// existing persistence (experience-content.service, via adminCrud) and merged here by
// `resolveContent`. Both the live screens and the Studio read through this one function.
//
// PURE: no React, no services, no DOM, no clock. Icons are names (resolved to lucide
// components by the UI), so this stays importable by tests and by any layer.
// ─────────────────────────────────────────────────────────────────────────────

export type ExperienceKind = 'banner' | 'hint';
export interface Bilingual { ar: string; en: string }

export interface ExperienceContent {
  id: string;
  kind: ExperienceKind;
  /** lucide-react icon name; the UI resolves it (keeps this module pure). */
  icon: string;
  title: Bilingual;
  body?: Bilingual;
  cta?: { label: Bilingual; href: string };
  /** A fixed visual treatment ('highlight' | 'warm' | undefined). */
  variant?: string;
  /** An experiment that supplies the variant at runtime (overrides `variant`). */
  variantExp?: string;
  /** For the welcome experience: an alternate title when the experiment arm is 'warm'. */
  variantTitles?: { [arm: string]: Bilingual };
  /** Interaction signals emitted when this surface is shown (Wave 20.1). */
  signals?: { [k: string]: string };
}

/** A partial override an operator can author. Only the fields present are changed. */
export interface ExperienceContentOverride {
  icon?: string;
  title?: Partial<Bilingual>;
  body?: Partial<Bilingual>;
  cta?: { label?: Partial<Bilingual>; href?: string };
  variant?: string;
}

// ── Shipped defaults ─────────────────────────────────────────────────────────────
// These are the EXACT strings the live screens shipped with, moved here (not copied):
// HomeScreen, MerchantApp and DriverApp now read them from this module.
export const EXPERIENCE_CONTENT_DEFAULTS: Record<string, ExperienceContent> = {
  'flag.customer_welcome': {
    id: 'flag.customer_welcome', kind: 'banner', icon: 'Sparkles',
    title: { ar: 'مرحباً بك', en: 'Welcome back' },
    body: { ar: 'توصيل سريع من مطاعم ومتاجر قريبة منك.', en: 'Fast delivery from restaurants and stores near you.' },
    variantExp: 'exp.welcome_tone',
    variantTitles: { warm: { ar: 'أهلاً بك في هات ناو 👋', en: 'Welcome to HaaT Now 👋' } },
  },
  'flag.customer_offers': {
    id: 'flag.customer_offers', kind: 'banner', icon: 'Tag',
    title: { ar: 'عروض متاحة الآن', en: 'Offers available now' },
    body: { ar: 'اكتشف الخصومات النشطة في منطقتك.', en: 'Discover active discounts in your area.' },
    variantExp: 'exp.offer_emphasis',
    signals: { campaign: 'offers' },
  },
  'flag.customer_feature_tour': {
    id: 'flag.customer_feature_tour', kind: 'hint', icon: 'Compass',
    title: { ar: 'جرّب البحث للعثور على متجرك المفضّل بسرعة.', en: 'Tip: use search to jump straight to your favourite store.' },
  },
  'flag.merchant_announcements': {
    id: 'flag.merchant_announcements', kind: 'banner', icon: 'Megaphone',
    title: { ar: 'إعلان للتجّار', en: 'Merchant announcement' },
    body: { ar: 'تحديثات المنصّة والمزايا الجديدة تظهر هنا لحسابك ومنطقتك.', en: 'Platform updates and new capabilities appear here for your account and region.' },
  },
  'flag.merchant_beta_dashboard': {
    id: 'flag.merchant_beta_dashboard', kind: 'banner', icon: 'FlaskConical', variant: 'highlight',
    title: { ar: 'لوحة التحليلات التجريبية', en: 'Beta analytics dashboard' },
    body: { ar: 'تجربة مبكّرة للوحة التحليلات الجديدة — مفعّلة لحسابك عبر مركز التجربة.', en: 'Early access to the next-generation analytics dashboard — enabled for your account from the Experience Center.' },
  },
  'flag.merchant_education': {
    id: 'flag.merchant_education', kind: 'banner', icon: 'GraduationCap',
    title: { ar: 'تعلّم المزيد عن لوحة التاجر', en: 'Learn your merchant portal' },
    body: { ar: 'دليل سريع لإدارة الطلبات وأوقات العمل والقائمة من داخل اللوحة.', en: 'A short guide to managing orders, opening hours and your menu from the portal.' },
  },
  'flag.driver_beta_tools': {
    id: 'flag.driver_beta_tools', kind: 'banner', icon: 'Rocket', variant: 'highlight',
    title: { ar: 'مزايا المندوب التجريبية', en: 'Driver beta tools' },
    body: { ar: 'حسابك ضمن الموجة الحالية من الطرح التدريجي. المزايا الجديدة مفعّلة لك.', en: 'Your account is in the current rollout wave — new tools are enabled for you.' },
  },
  'flag.driver_safety': {
    id: 'flag.driver_safety', kind: 'banner', icon: 'ShieldCheck',
    title: { ar: 'تذكير السلامة', en: 'Safety reminder' },
    body: { ar: 'التزم بحدود السرعة ولا تستخدم الهاتف أثناء القيادة — راجع الطلب بعد التوقّف.', en: 'Keep to the speed limit and do not use your phone while riding — check the order after you stop.' },
  },
  'flag.driver_training': {
    id: 'flag.driver_training', kind: 'banner', icon: 'GraduationCap',
    title: { ar: 'تدريب المندوب', en: 'Driver training' },
    body: { ar: 'خطوات قبول الطلب والاستلام والتسليم، وكيف ترفع تقييمك.', en: 'How to accept, pick up and deliver an order — and how to raise your rating.' },
  },
};

const clone = (c: ExperienceContent): ExperienceContent => JSON.parse(JSON.stringify(c));

/**
 * Merge an override onto the shipped default. Only fields present in the override are
 * changed; an empty override yields the default verbatim. Missing ids return null (an
 * experience the platform does not define has no content).
 */
export function resolveContent(id: string, override?: ExperienceContentOverride | null): ExperienceContent | null {
  const base = EXPERIENCE_CONTENT_DEFAULTS[id];
  if (!base) return null;
  if (!override) return clone(base);
  const out = clone(base);
  if (override.icon) out.icon = override.icon;
  if (override.variant !== undefined) out.variant = override.variant;
  if (override.title) out.title = { ...out.title, ...override.title };
  if (override.body) out.body = { ...(out.body ?? { ar: '', en: '' }), ...override.body };
  if (override.cta) {
    out.cta = {
      label: { ...(out.cta?.label ?? { ar: '', en: '' }), ...(override.cta.label ?? {}) },
      href: override.cta.href ?? out.cta?.href ?? '',
    };
  }
  return out;
}

/** The title for a locale, honouring the experiment arm when the content has variant titles. */
export function contentTitle(content: ExperienceContent, lang: 'ar' | 'en', variant?: string | null): string {
  if (variant && content.variantTitles?.[variant]) return content.variantTitles[variant][lang];
  return content.title[lang];
}

export function contentBody(content: ExperienceContent, lang: 'ar' | 'en'): string | undefined {
  return content.body ? content.body[lang] : undefined;
}

/** Every experience id that has authored content. */
export const CONTENT_IDS: string[] = Object.keys(EXPERIENCE_CONTENT_DEFAULTS);
