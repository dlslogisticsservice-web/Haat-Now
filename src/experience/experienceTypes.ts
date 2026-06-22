// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW — Visual Experience Builder (VEB) schema.
// Schema-driven definitions for Splash / Login / Onboarding screens.
// `enabled: false` => the app renders the original hardcoded screen (zero-risk
// fallback). Defaults mirror the current production screens, so enabling a screen
// with default data looks identical to today.
// ─────────────────────────────────────────────────────────────────────────────

export type ScreenType = 'splash' | 'login' | 'onboarding';

// Countries supported by the platform (aligned with src/config/countries.ts).
export type CountryCode = 'EG' | 'SA' | 'AE' | 'KW' | 'QA' | 'BH' | 'OM' | 'JO';
export const EXPERIENCE_COUNTRIES: { code: CountryCode; nameAr: string; flag: string }[] = [
  { code: 'EG', nameAr: 'مصر', flag: '🇪🇬' },
  { code: 'SA', nameAr: 'السعودية', flag: '🇸🇦' },
  { code: 'AE', nameAr: 'الإمارات', flag: '🇦🇪' },
  { code: 'KW', nameAr: 'الكويت', flag: '🇰🇼' },
  { code: 'QA', nameAr: 'قطر', flag: '🇶🇦' },
  { code: 'BH', nameAr: 'البحرين', flag: '🇧🇭' },
  { code: 'OM', nameAr: 'عُمان', flag: '🇴🇲' },
];

// A media reference — the editor can point any slot at an icon, image, Lottie or video.
export type MediaKind = 'icon' | 'image' | 'lottie' | 'video';
export interface MediaRef {
  kind: MediaKind;
  /** lucide icon name when kind==='icon' */
  icon?: string;
  /** CDN url when kind==='image' | 'lottie' | 'video' */
  url?: string;
  /** poster image url for video */
  poster?: string;
}

export type SplashAnimation = 'fade' | 'scale' | 'slide' | 'none';

export interface BackgroundSpec {
  color: string;
  /** optional full-bleed video background */
  videoUrl?: string;
  posterUrl?: string;
}

// ── Splash ───────────────────────────────────────────────────────────────────
export interface SplashExperience {
  enabled: boolean;
  brandText: string;       // e.g. "HAAT NOW"
  tagline: string;         // e.g. "فاخر · سريع · حصري"
  media: MediaRef;         // logo / lottie / image at center
  background: BackgroundSpec;
  durationMs: number;      // total on-screen time before auto-advance
  animation: SplashAnimation;
  showDots: boolean;
  footnote: string;
}

// ── Onboarding ───────────────────────────────────────────────────────────────
export interface OnboardingSlide {
  id: string;
  media: MediaRef;
  badge: string;
  title: string;
  description: string;
}
export interface OnboardingExperience {
  enabled: boolean;
  slides: OnboardingSlide[];
  background: BackgroundSpec;
  ctaNextLabel: string;
  ctaStartLabel: string;
  skipLabel: string;
}

// ── Login ────────────────────────────────────────────────────────────────────
export type LoginLayout = 'centered' | 'hero' | 'video';
export interface LoginExperience {
  enabled: boolean;
  layout: LoginLayout;
  brandText: string;
  tagline: string;
  media: MediaRef;
  background: BackgroundSpec;
  methods: { phone: boolean; email: boolean; google: boolean; guest: boolean };
}

// A full per-country experience set.
export interface ExperienceSet {
  splash: SplashExperience;
  onboarding: OnboardingExperience;
  login: LoginExperience;
}

// ── Defaults — mirror the current hardcoded screens ──────────────────────────
export const DEFAULT_SPLASH: SplashExperience = {
  enabled: false,
  brandText: 'HAAT NOW',
  tagline: 'فاخر · سريع · حصري',
  media: { kind: 'icon', icon: 'two_wheeler' },
  background: { color: '#0b0e11' },
  durationMs: 2750,
  animation: 'scale',
  showDots: true,
  footnote: 'Phase 2 · Luminous Precision',
};

export const DEFAULT_ONBOARDING: OnboardingExperience = {
  enabled: false,
  background: { color: '#0b0e11' },
  ctaNextLabel: 'التالي',
  ctaStartLabel: 'ابدأ التجربة',
  skipLabel: 'تخطي',
  slides: [
    { id: 'delivery',  media: { kind: 'icon', icon: 'two_wheeler' }, badge: 'سريع الفائق',     title: 'توصيل في 30 دقيقة',            description: 'أسرع توصيل في المدينة. اطلب الآن واستمتع بوجبتك الفاخرة طازجة على باب منزلك.' },
    { id: 'selection', media: { kind: 'icon', icon: 'storefront' },  badge: 'كل شيء هنا',       title: 'مطاعم، سوبر ماركت، صيدلية',   description: 'كل ما تحتاجه في تطبيق واحد. أشهى المطاعم، البقالة اليومية، والأدوية بنقرة واحدة.' },
    { id: 'rewards',   media: { kind: 'icon', icon: 'workspace_premium' }, badge: 'Platinum Member', title: 'نقاط مكافآت حصرية',       description: 'اكسب نقاطاً مع كل طلب واستمتع بخصومات حصرية وعروض Platinum لا مثيل لها.' },
  ],
};

export const DEFAULT_LOGIN: LoginExperience = {
  enabled: false,
  layout: 'centered',
  brandText: 'HAAT NOW',
  tagline: 'فاخر · سريع · حصري',
  media: { kind: 'icon', icon: 'bolt' },
  background: { color: '#0b0e11' },
  methods: { phone: true, email: true, google: true, guest: true },
};

export const DEFAULT_EXPERIENCE: ExperienceSet = {
  splash: DEFAULT_SPLASH,
  onboarding: DEFAULT_ONBOARDING,
  login: DEFAULT_LOGIN,
};

export function mergeExperience(base: ExperienceSet, patch: Partial<ExperienceSet>): ExperienceSet {
  return {
    splash: { ...base.splash, ...patch.splash },
    onboarding: { ...base.onboarding, ...patch.onboarding },
    login: { ...base.login, ...patch.login },
  };
}

export function cloneExperience(e: ExperienceSet): ExperienceSet {
  return structuredClone(e);
}
